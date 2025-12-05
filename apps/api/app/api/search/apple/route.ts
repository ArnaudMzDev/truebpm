import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const TEAM_ID = process.env.APPLE_MUSIC_TEAM_ID!;
const KEY_ID = process.env.APPLE_MUSIC_KEY_ID!;
const PRIVATE_KEY = process.env.APPLE_MUSIC_PRIVATE_KEY!;

function generateToken() {
    return jwt.sign(
        {
            iss: TEAM_ID,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600,
        },
        PRIVATE_KEY,
        {
            algorithm: "ES256",
            header: {
                alg: "ES256",
                kid: KEY_ID,
            },
        }
    );
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);

        const query = searchParams.get("q");
        const type = searchParams.get("type") ?? "song";

        if (!query) {
            return NextResponse.json({ items: [] }, { status: 200 });
        }

        const token = generateToken();

        // Définition du type Apple Music
        let amType =
            type === "album"
                ? "albums"
                : type === "artist"
                    ? "artists"
                    : "songs";

        const url = `https://api.music.apple.com/v1/catalog/fr/search?term=${encodeURIComponent(
            query
        )}&types=${amType}&limit=25`;

        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        const json = await res.json();

        if (!res.ok) {
            console.log("❌ Apple error:", json);
            return NextResponse.json({ error: "Apple Music API error" }, { status: 500 });
        }

        // Transformation des résultats Apple en format simple
        let items: any[] = [];

        const data =
            json.results[amType]?.data || [];

        if (type === "song") {
            items = data.map((item: any) => ({
                id: item.id,
                title: item.attributes.name,
                artist: item.attributes.artistName,
                cover: item.attributes.artwork?.url
                    ?.replace("{w}", "200")
                    .replace("{h}", "200"),
                previewUrl: item.attributes.previews?.[0]?.url ?? null,
            }));
        }

        if (type === "album") {
            items = data.map((item: any) => ({
                id: item.id,
                title: item.attributes.name,
                artist: item.attributes.artistName,
                cover: item.attributes.artwork?.url
                    ?.replace("{w}", "300")
                    .replace("{h}", "300"),
            }));
        }

        if (type === "artist") {
            items = data.map((item: any) => ({
                id: item.id,
                name: item.attributes.name,
                cover: item.attributes.artwork?.url
                    ?.replace("{w}", "300")
                    .replace("{h}", "300") ?? null,
            }));
        }

        return NextResponse.json({ items }, { status: 200 });

    } catch (err) {
        console.error("❌ Search error:", err);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}