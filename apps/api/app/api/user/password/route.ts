import "@/lib/loadModels";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { verifyToken } from "@/lib/auth";
import { PasswordSchema } from "@/lib/validators/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
    try {
        await connectDB();

        const userId = await verifyToken(req);
        if (!userId) {
            return NextResponse.json(
                { error: "Non authentifié." },
                { status: 401, headers: { "Cache-Control": "no-store" } }
            );
        }

        const body = await req.json().catch(() => null);
        const currentPassword =
            typeof body?.currentPassword === "string" ? body.currentPassword.trim() : "";
        const newPassword =
            typeof body?.newPassword === "string" ? body.newPassword.trim() : "";

        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { error: "Champs manquants." },
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

        if (currentPassword === newPassword) {
            return NextResponse.json(
                { error: "Le nouveau mot de passe doit être différent de l'ancien." },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        const user: any = await User.findById(userId).select("_id password");
        if (!user) {
            return NextResponse.json(
                { error: "Utilisateur introuvable." },
                { status: 404, headers: { "Cache-Control": "no-store" } }
            );
        }

        const isValid = await bcrypt.compare(currentPassword, user.password || "");
        if (!isValid) {
            return NextResponse.json(
                { error: "Mot de passe actuel incorrect." },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        user.password = hashedPassword;
        await user.save();

        return NextResponse.json(
            { success: true },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    } catch (err) {
        console.error("❌ PATCH /api/user/password error:", err);
        return NextResponse.json(
            { error: "Erreur interne serveur." },
            { status: 500, headers: { "Cache-Control": "no-store" } }
        );
    }
}
