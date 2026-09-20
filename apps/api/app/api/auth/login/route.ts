import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { loginSchema } from "@/lib/validators/auth";
import { signToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const INVALID_CREDENTIALS = "Identifiants invalides.";
const LOGIN_LOCK_MINUTES = 15;
const LOGIN_MAX_FAILED_ATTEMPTS = 5;
const DUMMY_PASSWORD_HASH =
    "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

function formatBanRemaining(bannedUntil: Date | null) {
    if (!bannedUntil) return "durée indéterminée";

    const ms = bannedUntil.getTime() - Date.now();
    if (ms <= 0) return "";

    const minutes = Math.ceil(ms / 60000);
    if (minutes < 60) return `${minutes} min`;

    const hours = Math.ceil(minutes / 60);
    if (hours < 24) return `${hours} h`;

    const days = Math.ceil(hours / 24);
    return `${days} j`;
}

function buildBanMessage(userDoc: any, bannedUntil: Date | null) {
    const reason = typeof userDoc?.banReason === "string" ? userDoc.banReason.trim() : "";
    const remaining = formatBanRemaining(bannedUntil);
    const details = [];

    if (reason) details.push(`Raison : ${reason}`);
    if (remaining) details.push(`Durée restante : ${remaining}`);

    return details.length > 0
        ? `Ce compte est suspendu. ${details.join(". ")}.`
        : "Ce compte est suspendu.";
}

export async function POST(req: Request) {
    try {
        await connectDB();

        const body = await req.json().catch(() => null);

        const parsed = loginSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Email ou mot de passe invalide." }, { status: 400 });
        }

        const email = parsed.data.email.trim().toLowerCase();
        const password = parsed.data.password;

        const userDoc = await User.findOne({ email });
        const passwordHash = userDoc?.password || DUMMY_PASSWORD_HASH;
        const match = await bcrypt.compare(password, passwordHash);
        const lockedUntil = userDoc?.loginLockedUntil ? new Date(userDoc.loginLockedUntil) : null;
        const isLocked = !!lockedUntil && lockedUntil.getTime() > Date.now();

        if (!userDoc || !match) {
            if (userDoc && !isLocked) {
                const failedCount = Math.max(0, Number(userDoc.loginFailedCount || 0)) + 1;
                const update: any = { loginFailedCount: failedCount };

                if (failedCount >= LOGIN_MAX_FAILED_ATTEMPTS) {
                    update.loginLockedUntil = new Date(Date.now() + LOGIN_LOCK_MINUTES * 60_000);
                }

                await User.updateOne({ _id: userDoc._id }, { $set: update }).catch(() => null);
            }
            return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
        }

        if (isLocked) {
            return NextResponse.json(
                { error: `Trop de tentatives. Réessaie dans ${LOGIN_LOCK_MINUTES} min.` },
                { status: 429 }
            );
        }

        const bannedUntil = userDoc.bannedUntil ? new Date(userDoc.bannedUntil) : null;
        if (userDoc.isBanned && (!bannedUntil || bannedUntil.getTime() > Date.now())) {
            return NextResponse.json(
                {
                    error: buildBanMessage(userDoc, bannedUntil),
                    ban: {
                        reason: userDoc.banReason || "",
                        bannedUntil: bannedUntil?.toISOString() || null,
                        remaining: formatBanRemaining(bannedUntil),
                    },
                },
                { status: 403 }
            );
        }

        if (userDoc.loginFailedCount || userDoc.loginLockedUntil) {
            await User.updateOne(
                { _id: userDoc._id },
                { $set: { loginFailedCount: 0 }, $unset: { loginLockedUntil: "" } }
            ).catch(() => null);
        }

        const requireVerifiedEmail = process.env.REQUIRE_EMAIL_VERIFICATION === "1";
        if (requireVerifiedEmail && !userDoc.emailVerifiedAt) {
            return NextResponse.json(
                {
                    error: "Adresse e-mail non vérifiée.",
                    code: "EMAIL_NOT_VERIFIED",
                },
                { status: 403 }
            );
        }

        const token = signToken(userDoc._id.toString(), userDoc.sessionVersion || 0);

        // ✅ user complet (source de vérité)
        const user = await User.findById(userDoc._id)
            .select("_id pseudo email emailVerifiedAt avatarUrl bannerUrl bio followers following followersList followingList notesCount createdAt")
            .lean();

        if (!user) {
            return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
        }

        return NextResponse.json({ success: true, token, user }, { status: 200 });
    } catch (err) {
        console.error("❌ POST /api/auth/login error:", err);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}
