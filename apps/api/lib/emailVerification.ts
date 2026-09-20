import EmailVerificationToken from "@/models/EmailVerificationToken";
import { sendTransactionalEmail } from "@/lib/email";
import { createVerificationCode, hashSecurityToken, minutesFromNow } from "@/lib/securityTokens";

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export async function sendEmailVerification(input: {
    userId: string;
    email: string;
    pseudo?: string;
}) {
    const email = input.email.trim().toLowerCase();
    const code = createVerificationCode();
    const tokenHash = hashSecurityToken(`${email}:${code}`);
    const expiresAt = minutesFromNow(15);

    await EmailVerificationToken.updateMany(
        { userId: input.userId, email, usedAt: null },
        { $set: { usedAt: new Date() } }
    );

    await EmailVerificationToken.create({
        userId: input.userId,
        email,
        tokenHash,
        expiresAt,
    });

    const pseudo = input.pseudo || "";
    const safePseudo = escapeHtml(pseudo);

    await sendTransactionalEmail({
        to: email,
        subject: "Ton code TrueBPM",
        text: `Salut ${pseudo},\n\nTon code de vérification TrueBPM est : ${code}\n\nIl expire dans 15 minutes.`,
        html: `
            <p>Salut ${safePseudo},</p>
            <p>Ton code de vérification TrueBPM est :</p>
            <p style="font-size: 28px; font-weight: 800; letter-spacing: 8px;">${code}</p>
            <p>Il expire dans 15 minutes.</p>
        `,
    });

    return { sent: true };
}
