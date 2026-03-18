import "@/lib/loadModels";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { verifyToken } from "@/lib/auth";

function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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
        const currentEmail =
            typeof body?.currentEmail === "string" ? body.currentEmail.trim().toLowerCase() : "";
        const newEmail =
            typeof body?.newEmail === "string" ? body.newEmail.trim().toLowerCase() : "";
        const password =
            typeof body?.password === "string" ? body.password.trim() : "";

        if (!currentEmail || !newEmail || !password) {
            return NextResponse.json(
                { error: "Champs manquants." },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        if (!isValidEmail(currentEmail) || !isValidEmail(newEmail)) {
            return NextResponse.json(
                { error: "Adresse e-mail invalide." },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        if (currentEmail === newEmail) {
            return NextResponse.json(
                { error: "La nouvelle adresse e-mail doit être différente de l'actuelle." },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        const user: any = await User.findById(userId).select("_id email password");
        if (!user) {
            return NextResponse.json(
                { error: "Utilisateur introuvable." },
                { status: 404, headers: { "Cache-Control": "no-store" } }
            );
        }

        if (String(user.email || "").trim().toLowerCase() !== currentEmail) {
            return NextResponse.json(
                { error: "L'adresse e-mail actuelle ne correspond pas." },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        const emailAlreadyUsed = await User.findOne({
            _id: { $ne: userId },
            email: newEmail,
        })
            .select("_id")
            .lean();

        if (emailAlreadyUsed) {
            return NextResponse.json(
                { error: "Cette adresse e-mail est déjà utilisée." },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        const isValidPassword = await bcrypt.compare(password, user.password || "");
        if (!isValidPassword) {
            return NextResponse.json(
                { error: "Mot de passe incorrect." },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        user.email = newEmail;
        await user.save();

        return NextResponse.json(
            { success: true, email: newEmail },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    } catch (err) {
        console.error("❌ PATCH /api/user/email error:", err);
        return NextResponse.json(
            { error: "Erreur interne serveur." },
            { status: 500, headers: { "Cache-Control": "no-store" } }
        );
    }
}