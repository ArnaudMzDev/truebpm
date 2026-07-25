import "@/lib/loadModels";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { requireAdminRequest, writeAdminAuditLog } from "@/lib/adminAuth";
import { cleanText } from "@/lib/sanitize";
import { deleteUserCascade } from "@/lib/deleteUserCascade";
import { PasswordSchema } from "@/lib/validators/auth";
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

        if (action === "reset_password") {
            const newPassword =
                typeof body?.newPassword === "string" ? body.newPassword.trim() : "";

            if (!reason) {
                return NextResponse.json({ error: "Raison de modification obligatoire." }, { status: 400 });
            }

            const parsedPassword = PasswordSchema.safeParse(newPassword);
            if (!parsedPassword.success) {
                return NextResponse.json(
                    { error: parsedPassword.error.issues[0]?.message || "Mot de passe invalide." },
                    { status: 400 }
                );
            }

            const hashedPassword = await bcrypt.hash(newPassword, 12);
            const user = await User.findByIdAndUpdate(
                userId,
                { $set: { password: hashedPassword } },
                { new: true }
            )
                .select("_id pseudo email avatarUrl isBanned bannedAt bannedUntil banReason bannedBy")
                .lean();

            if (!user) return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });

            await writeAdminAuditLog({
                req,
                adminId: auth.session!.adminId,
                action: "user_password_reset",
                targetType: "user",
                targetId: userId,
                reason,
                metadata: { pseudo: (user as any).pseudo || "", email: (user as any).email || "" },
            });

            return NextResponse.json({ success: true, user });
        }

        return NextResponse.json({ error: "Action admin invalide." }, { status: 400 });
    } catch (e) {
        console.error("PATCH /api/admin/users/[userId] error:", e);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { userId: string } }) {
    const auth = requireAdminRequest(req, { csrf: true });
    if (auth.response) return auth.response;

    try {
        await connectDB();

        const { userId } = params;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return NextResponse.json({ error: "userId invalide." }, { status: 400 });
        }

        const body = await req.json().catch(() => null);
        const reason = cleanText(body?.reason, 500);
        const confirmation = cleanText(body?.confirmation, 80);

        if (confirmation !== "SUPPRIMER") {
            return NextResponse.json({ error: "Confirmation invalide." }, { status: 400 });
        }

        if (!reason) {
            return NextResponse.json({ error: "Raison de suppression obligatoire." }, { status: 400 });
        }

        const result = await deleteUserCascade(userId);
        if (!result) {
            return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
        }

        await writeAdminAuditLog({
            req,
            adminId: auth.session!.adminId,
            action: "user_delete",
            targetType: "user",
            targetId: userId,
            reason,
            metadata: {
                pseudo: (result.user as any).pseudo || "",
                email: (result.user as any).email || "",
                counts: result.counts,
            },
        });

        return NextResponse.json({
            success: true,
            deletedId: userId,
            user: result.user,
            counts: result.counts,
        });
    } catch (e) {
        console.error("DELETE /api/admin/users/[userId] error:", e);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}
