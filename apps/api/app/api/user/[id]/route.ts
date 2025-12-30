import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import mongoose from "mongoose";

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        await connectDB();

        const userId = params.id;

        // Vérification de l'ID MongoDB
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return NextResponse.json(
                { error: "ID utilisateur invalide." },
                { status: 400 }
            );
        }

        // Sélection stricte pour sécurité
        const user = await User.findById(userId)
            .select("pseudo avatarUrl bannerUrl bio followers following notesCount createdAt")
            .lean();

        if (!user) {
            return NextResponse.json(
                { error: "Utilisateur introuvable." },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { user },
            { status: 200 }
        );

    } catch (err) {
        console.error("❌ GET /api/user/[id] error:", err);
        return NextResponse.json(
            { error: "Erreur interne serveur." },
            { status: 500 }
        );
    }
}