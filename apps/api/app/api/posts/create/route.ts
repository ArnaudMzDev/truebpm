import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import { verifyToken } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        await connectDB();

        const userId = await verifyToken(req);
        if (!userId) {
            return NextResponse.json(
                { error: "Non authentifié." },
                { status: 401 }
            );
        }

        const body = await req.json();

        const {
            trackTitle,
            artist,
            coverUrl,
            rating,
            prod,
            lyrics,
            emotion,
            comment,
            mode,
        } = body;

        // Vérif basique
        if (!trackTitle || !artist || !mode) {
            return NextResponse.json(
                { error: "Champs requis manquants (trackTitle, artist, mode)." },
                { status: 400 }
            );
        }

        const post = await Post.create({
            userId,
            trackTitle,
            artist,
            coverUrl: coverUrl || null,
            rating: mode === "general" ? rating : null,
            prod: mode === "multi" ? prod : null,
            lyrics: mode === "multi" ? lyrics : null,
            emotion: mode === "multi" ? emotion : null,
            comment: comment || "",
            mode,
        });

        return NextResponse.json({ success: true, post }, { status: 201 });
    } catch (err) {
        console.error("❌ POST create error:", err);
        return NextResponse.json(
            { error: "Erreur interne serveur." },
            { status: 500 }
        );
    }
}