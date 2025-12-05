import { NextResponse } from "next/server";
import { generateAppleMusicToken } from "@/lib/appleMusic";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get("q");
        const type = searchParams.get("type") || "songs";

        if (!query) {
            return NextResponse.json({ error: "Missing query" }, { status: 400 });
        }

        const token = generateAppleMusicToken();

        const url = `https://api.music.apple.com/v1/catalog/fr/search?term=${encodeURIComponent(
            query
        )}&types=${type}&limit=25`;

        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        const data = await res.json();

        return NextResponse.json({ data }, { status: 200 });
    } catch (err: any) {
    console.error("APPLE SEARCH ERROR:", err);
    return NextResponse.json({ error: err.message || "Erreur serveur (détails en console)" }, { status: 500 });
}

}