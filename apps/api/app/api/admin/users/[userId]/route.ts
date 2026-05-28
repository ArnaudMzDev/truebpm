import "@/lib/loadModels";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAdminRequest, writeAdminAuditLog } from "@/lib/adminAuth";
import { cleanText } from "@/lib/sanitize";
import User from "@/models/User";

export const dynamic = "force-dynamic";

function parseBanUntil(value: unknown) {
    if (!value) return null;
    if (typeof value !== "string") return "invalid";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) return "invalid";
    return date;
}

export async function PATCH(req: Request, { params }: { params: { userId: string } }) {
    const auth = requireAdminRequest(req, { csrf: true });
    if (auth.response) return auth.response;

    try {
        await connectDB();

        const { userId } = params;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return NextResponse.json({ error: "userId invalide." }, { status: 400 });
        }

        const body = await req.json().catch(() => null);
        const action = cleanText(body?.action, 30);
        const reason = cleanText(body?.reason, 500);

        if (action === "ban") {
            const bannedUntil = parseBanUntil(body?.bannedUntil);
            if (bannedUntil === "invalid") {
                return NextResponse.json({ error: "Date de fin de ban invalide." }, { status: 400 });
            }

            const user = await User.findByIdAndUpdate(
                userId,
                {
                    $set: {
                        isBanned: true,
                        bannedAt: new Date(),
                        bannedUntil,
                        banReason: reason || "Modération TrueBPM",
                        bannedBy: auth.session!.adminId,
                        isOnline: false,
                        lastSeenAt: new Date(),
                    },
                },
                { new: true }
            )
                .select("_id pseudo email avatarUrl isBanned bannedAt bannedUntil banReason bannedBy")
                .lean();

            if (!user) return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });

            await writeAdminAuditLog({
                req,
                adminId: auth.session!.adminId,
                action: "user_ban",
                targetType: "user",
                targetId: userId,
                reason,
                metadata: { bannedUntil },
            });

            return NextResponse.json({ success: true, user });
        }

        if (action === "unban") {
            const user = await User.findByIdAndUpdate(
                userId,
                {
                    $set: { isBanned: false },
                    $unset: { bannedAt: "", bannedUntil: "", banReason: "", bannedBy: "" },
                },
                { new: true }
            )
                .select("_id pseudo email avatarUrl isBanned bannedAt bannedUntil banReason bannedBy")
                .lean();

            if (!user) return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });

            await writeAdminAuditLog({
                req,
                adminId: auth.session!.adminId,
                action: "user_unban",
                targetType: "user",
                targetId: userId,
                reason,
            });

            return NextResponse.json({ success: true, user });
        }

        return NextResponse.json({ error: "Action admin invalide." }, { status: 400 });
    } catch (e) {
        console.error("PATCH /api/admin/users/[userId] error:", e);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}
