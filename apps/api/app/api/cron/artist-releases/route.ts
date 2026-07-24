import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { syncFavoriteArtistReleasesForUsers } from "@/lib/artistReleases";

export const dynamic = "force-dynamic";

function isAuthorized(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return true;
    return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        await connectDB();
        const result = await syncFavoriteArtistReleasesForUsers();
        return NextResponse.json({ success: true, ...result }, { status: 200 });
    } catch (err) {
        console.error("GET /api/cron/artist-releases error:", err);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}
