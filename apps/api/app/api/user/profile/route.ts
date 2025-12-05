import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { verifyToken } from "@/lib/auth";

async function upsertProfile(req: Request) {
    try {
        const userId = await verifyToken(req);
        if (!userId) {
            return NextResponse.json(
                { error: "Non authentifié." },
                { status: 401 }
            );
        }

        await connectDB();

        const { bio, avatarUrl, bannerUrl } = await req.json();

        const update: Record<string, any> = {};

        if (typeof bio === "string") update.bio = bio;
        if (typeof avatarUrl === "string") update.avatarUrl = avatarUrl;
        if (typeof bannerUrl === "string") update.bannerUrl = bannerUrl;

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: update },
            { new: true }
        ).select("-password");

        if (!user) {
            return NextResponse.json(
                { error: "Utilisateur introuvable." },
                { status: 404 }
            );
        }

        return NextResponse.json({ user }, { status: 200 });
    } catch (err) {
        console.error("❌ Profile upsert error:", err);
        return NextResponse.json(
            { error: "Erreur serveur." },
            { status: 500 }
        );
    }
}

export async function GET(req: Request) {
    try {
        const userId = await verifyToken(req);
        if (!userId) {
            return NextResponse.json(
                { error: "Non authentifié." },
                { status: 401 }
            );
        }

        await connectDB();

        const user = await User.findById(userId).select("-password");

        if (!user) {
            return NextResponse.json(
                { error: "Utilisateur introuvable." },
                { status: 404 }
            );
        }

        return NextResponse.json({ user }, { status: 200 });
    } catch (err) {
        console.error("❌ Profile GET error:", err);
        return NextResponse.json(
            { error: "Erreur serveur." },
            { status: 500 }
        );
    }
}

// Pour compat avec ProfileSetup (POST) et Edit (PATCH)
export async function POST(req: Request) {
    return upsertProfile(req);
}

export async function PATCH(req: Request) {
    return upsertProfile(req);
}