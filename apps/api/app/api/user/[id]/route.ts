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

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return NextResponse.json(
                { error: "ID utilisateur invalide." },
                { status: 400 }
            );
        }

        const user = await User.findById(userId)
            .select("_id pseudo email avatarUrl bannerUrl bio followers following followersList followingList notesCount createdAt isOnline lastSeenAt pinnedTrack favoriteArtists favoriteAlbums favoriteTracks")
            .lean();

        if (!user) {
            return NextResponse.json(
                { error: "Utilisateur introuvable." },
                { status: 404 }
            );
        }

        return NextResponse.json({ user }, { status: 200 });
    } catch (err) {
        console.error("❌ GET /api/user/[id] error:", err);
        return NextResponse.json(
            { error: "Erreur interne serveur." },
            { status: 500 }
        );
    }
}