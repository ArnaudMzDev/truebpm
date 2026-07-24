import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import { syncFavoriteArtistReleasesForUser } from "@/lib/artistReleases";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        await connectDB();

        const userId = await requireUserId(req);
        if (!userId) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        const result = await syncFavoriteArtistReleasesForUser(userId, {
            notify: false,
        });

        return NextResponse.json(
            { success: true, ...result },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    } catch (err) {
        console.error("POST /api/artist-releases/sync error:", err);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}
