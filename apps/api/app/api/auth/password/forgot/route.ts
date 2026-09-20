import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import PasswordResetToken from "@/models/PasswordResetToken";
import { createSecurityToken, hashSecurityToken, minutesFromNow } from "@/lib/securityTokens";
import { getPublicAppUrl, sendTransactionalEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const GENERIC_RESPONSE = {
    success: true,
    message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.",
};

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export async function POST(req: Request) {
    try {
        await connectDB();

        const body = await req.json().catch(() => null);
        const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

        if (!email || email.length > 320) {
            return NextResponse.json(GENERIC_RESPONSE, { status: 200, headers: { "Cache-Control": "no-store" } });
        }

        const user: any = await User.findOne({ email }).select("_id email pseudo").lean();
        if (!user) {
            return NextResponse.json(GENERIC_RESPONSE, { status: 200, headers: { "Cache-Control": "no-store" } });
        }

        await PasswordResetToken.updateMany(
            { userId: user._id, usedAt: null },
            { $set: { usedAt: new Date() } }
        );

        const token = createSecurityToken();
        const tokenHash = hashSecurityToken(token);
        const expiresAt = minutesFromNow(30);

        await PasswordResetToken.create({
            userId: user._id,
            tokenHash,
            expiresAt,
        });

        const resetUrl = `${getPublicAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;
        const pseudo = user.pseudo || "";
        const safePseudo = escapeHtml(pseudo);
        await sendTransactionalEmail({
            to: user.email,
            subject: "Réinitialise ton mot de passe TrueBPM",
            text: `Salut ${pseudo},\n\nPour réinitialiser ton mot de passe TrueBPM, ouvre ce lien dans les 30 prochaines minutes :\n${resetUrl}\n\nSi tu n'es pas à l'origine de cette demande, ignore cet email.`,
            html: `
                <p>Salut ${safePseudo},</p>
                <p>Pour réinitialiser ton mot de passe TrueBPM, ouvre ce lien dans les 30 prochaines minutes :</p>
                <p><a href="${resetUrl}">Réinitialiser mon mot de passe</a></p>
                <p>Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>
            `,
        });

        return NextResponse.json(GENERIC_RESPONSE, { status: 200, headers: { "Cache-Control": "no-store" } });
    } catch (err) {
        console.error("POST /api/auth/password/forgot error:", err);
        return NextResponse.json(GENERIC_RESPONSE, { status: 200, headers: { "Cache-Control": "no-store" } });
    }
}
