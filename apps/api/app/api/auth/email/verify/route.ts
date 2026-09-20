import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import EmailVerificationToken from "@/models/EmailVerificationToken";
import { hashSecurityToken } from "@/lib/securityTokens";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        await connectDB();

        const body = await req.json().catch(() => null);
        const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
        const code =
            typeof body?.code === "string"
                ? body.code.replace(/\D/g, "").slice(0, 6)
                : "";
        const token = typeof body?.token === "string" ? body.token.trim() : "";

        if ((!email || !code) && (!token || token.length > 300)) {
            return NextResponse.json(
                { error: "Code de vérification invalide." },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        const tokenHash = email && code
            ? hashSecurityToken(`${email}:${code}`)
            : hashSecurityToken(token);

        const verification: any = await EmailVerificationToken.findOne({
            tokenHash,
            ...(email ? { email } : {}),
            usedAt: null,
            expiresAt: { $gt: new Date() },
        }).lean();

        if (!verification) {
            return NextResponse.json(
                { error: "Code expiré ou incorrect." },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        const user: any = await User.findById(verification.userId)
            .select("_id email emailVerifiedAt")
            .lean();

        if (!user || String(user.email || "").toLowerCase() !== String(verification.email || "").toLowerCase()) {
            await EmailVerificationToken.updateOne(
                { _id: verification._id },
                { $set: { usedAt: new Date() } }
            );

            return NextResponse.json(
                { error: "Cette vérification ne correspond plus à l'adresse du compte." },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        const emailVerifiedAt = user.emailVerifiedAt || new Date();
        const verifiedUser: any = await User.findByIdAndUpdate(
            user._id,
            { $set: { emailVerifiedAt } },
            { new: true }
        )
            .select(
                "_id pseudo email emailVerifiedAt avatarUrl bannerUrl bio followers following followersList followingList notesCount createdAt"
            )
            .lean();

        await EmailVerificationToken.updateMany(
            { userId: user._id, email: user.email, usedAt: null },
            { $set: { usedAt: new Date() } }
        );

        return NextResponse.json(
            { success: true, user: verifiedUser || { _id: user._id, email: user.email, emailVerifiedAt } },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    } catch (err) {
        console.error("POST /api/auth/email/verify error:", err);
        return NextResponse.json(
            { error: "Erreur serveur." },
            { status: 500, headers: { "Cache-Control": "no-store" } }
        );
    }
}
