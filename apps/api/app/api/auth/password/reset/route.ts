import "@/lib/loadModels";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import PasswordResetToken from "@/models/PasswordResetToken";
import { PasswordSchema } from "@/lib/validators/auth";
import { hashSecurityToken } from "@/lib/securityTokens";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        await connectDB();

        const body = await req.json().catch(() => null);
        const token = typeof body?.token === "string" ? body.token.trim() : "";
        const newPassword = typeof body?.newPassword === "string" ? body.newPassword.trim() : "";

        if (!token || token.length > 300) {
            return NextResponse.json(
                { error: "Lien de réinitialisation invalide." },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        const parsedPassword = PasswordSchema.safeParse(newPassword);
        if (!parsedPassword.success) {
            return NextResponse.json(
                { error: parsedPassword.error.issues[0]?.message || "Mot de passe invalide." },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        const tokenHash = hashSecurityToken(token);
        const resetToken: any = await PasswordResetToken.findOne({
            tokenHash,
            usedAt: null,
            expiresAt: { $gt: new Date() },
        }).lean();

        if (!resetToken) {
            return NextResponse.json(
                { error: "Lien de réinitialisation expiré ou déjà utilisé." },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        const user = await User.findByIdAndUpdate(
            resetToken.userId,
            {
                $set: {
                    password: hashedPassword,
                    passwordChangedAt: new Date(),
                    loginFailedCount: 0,
                },
                $unset: { loginLockedUntil: "" },
                $inc: { sessionVersion: 1 },
            },
            { new: true }
        )
            .select("_id")
            .lean();

        if (!user) {
            return NextResponse.json(
                { error: "Utilisateur introuvable." },
                { status: 404, headers: { "Cache-Control": "no-store" } }
            );
        }

        await PasswordResetToken.updateMany(
            { userId: resetToken.userId, usedAt: null },
            { $set: { usedAt: new Date() } }
        );

        return NextResponse.json(
            { success: true },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    } catch (err) {
        console.error("POST /api/auth/password/reset error:", err);
        return NextResponse.json(
            { error: "Erreur serveur." },
            { status: 500, headers: { "Cache-Control": "no-store" } }
        );
    }
}
