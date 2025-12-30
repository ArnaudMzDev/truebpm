import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";

/* -------------------- HELPERS -------------------- */

function clampRating(value: number) {
    return Math.min(5, Math.max(1, value));
}

function sanitizeRatings(ratings: Record<string, any>) {
    const clean: Record<string, number> = {};

    for (const key in ratings) {
        const val = Number(ratings[key]);
        if (!isNaN(val)) {
            clean[key] = clampRating(val);
        }
    }

    return clean;
}

/* -------------------- ROUTE -------------------- */

export async function POST(req: Request) {
    try {
        await connectDB();

        const userId = req.headers.get("x-user-id")!;        if (!userId) {
            return NextResponse.json(
                { error: "Non authentifié." },
                { status: 401 }
            );
        }

        const body = await req.json();

        const {
            entityType = "song",
            entityId = null,

            trackTitle,
            artist,
            coverUrl,

            mode,
            rating,
            ratings,

            comment,
        } = body;

        /* -------------------- BASIC VALIDATION -------------------- */

        if (!trackTitle || !artist || !mode) {
            return NextResponse.json(
                { error: "Champs requis manquants." },
                { status: 400 }
            );
        }

        if (!["song", "album", "artist"].includes(entityType)) {
            return NextResponse.json(
                { error: "entityType invalide." },
                { status: 400 }
            );
        }

        if (!["general", "multi"].includes(mode)) {
            return NextResponse.json(
                { error: "mode invalide." },
                { status: 400 }
            );
        }

        /* -------------------- RATING LOGIC -------------------- */

        let finalRating: number | null = null;
        let finalRatings: Record<string, number> = {};

        if (mode === "general") {
            if (typeof rating !== "number") {
                return NextResponse.json(
                    { error: "rating requis pour le mode général." },
                    { status: 400 }
                );
            }

            finalRating = clampRating(rating);
        }

        if (mode === "multi") {
            if (!ratings || typeof ratings !== "object") {
                return NextResponse.json(
                    { error: "ratings requis pour le mode multi." },
                    { status: 400 }
                );
            }

            finalRatings = sanitizeRatings(ratings);

            if (Object.keys(finalRatings).length === 0) {
                return NextResponse.json(
                    { error: "ratings invalides." },
                    { status: 400 }
                );
            }
        }

        /* -------------------- CREATE POST -------------------- */

        const post = await Post.create({
            userId,

            entityType,
            entityId,

            trackTitle,
            artist,
            coverUrl: coverUrl || null,

            mode,
            rating: finalRating,
            ratings: finalRatings,

            comment: comment?.trim() || "",
        });

        return NextResponse.json(
            { success: true, post },
            { status: 201 }
        );
    } catch (err) {
        console.error("❌ POST create error:", err);
        return NextResponse.json(
            { error: "Erreur interne serveur." },
            { status: 500 }
        );
    }
}