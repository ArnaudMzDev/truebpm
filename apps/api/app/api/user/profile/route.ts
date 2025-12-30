import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { verifyToken } from "@/lib/auth";

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
        if (!body || typeof body !== "object") {
            return NextResponse.json(
                { error: "Requête invalide." },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        const { pseudo, bio, avatarUrl, bannerUrl } = body as {
            pseudo?: unknown;
            bio?: unknown;
            avatarUrl?: unknown; // string | null
            bannerUrl?: unknown; // string | null
        };

        const update: Record<string, any> = {};

        // pseudo: string non vide
        if (typeof pseudo === "string") {
            const p = pseudo.trim();
            if (p.length > 0) update.pseudo = p;
        }

        // bio: string (peut être vide si tu veux autoriser une bio vide)
        if (typeof bio === "string") {
            update.bio = bio.trim();
        }

        // avatarUrl:
        // - null => effacer
        // - "" => ignorer (anti-reset)
        // - "https://..." => set
        if (avatarUrl === null) {
            update.avatarUrl = "";
        } else if (typeof avatarUrl === "string") {
            const a = avatarUrl.trim();
            if (a.length > 0) update.avatarUrl = a;
        }

        // bannerUrl: même logique
        if (bannerUrl === null) {
            update.bannerUrl = "";
        } else if (typeof bannerUrl === "string") {
            const b = bannerUrl.trim();
            if (b.length > 0) update.bannerUrl = b;
        }

        // Si aucun champ valide -> on renvoie l'user actuel (évite un update vide)
        const user = (Object.keys(update).length > 0
                ? await User.findByIdAndUpdate(userId, { $set: update }, { new: true })
                : await User.findById(userId)
        )
            ?.select(
                "_id pseudo email bio avatarUrl bannerUrl followers following followersList followingList notesCount createdAt"
            )
            .lean();

        if (!user) {
            return NextResponse.json(
                { error: "Utilisateur introuvable." },
                { status: 404, headers: { "Cache-Control": "no-store" } }
            );
        }

        return NextResponse.json(
            { success: true, user },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    } catch (err) {
        console.error("❌ PATCH /api/user/profile error:", err);
        return NextResponse.json(
            { error: "Erreur interne serveur." },
            { status: 500, headers: { "Cache-Control": "no-store" } }
        );
    }
}