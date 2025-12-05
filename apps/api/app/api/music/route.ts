import { NextResponse } from "next/server";
import axios from "axios";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);

        const term = searchParams.get("term");
        const type = searchParams.get("type") || "songs";

        if (!term) {
            return NextResponse.json(
                { error: "Missing search term" },
                { status: 400 }
            );
        }

        const APPLE_MUSIC_STORE = "fr";
        const DEVELOPER_TOKEN = process.env.APPLE_MUSIC_TOKEN;

        if (!DEVELOPER_TOKEN) {
            return NextResponse.json(
                { error: "Apple Music token missing" },
                { status: 500 }
            );
        }

        const url = `https://api.music.apple.com/v1/catalog/${APPLE_MUSIC_STORE}/search`;

        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${DEVELOPER_TOKEN}`,
            },
            params: {
                term,
                types: type,
                limit: 15,
            },
        });

        return NextResponse.json(response.data);
    } catch (err) {
        console.error("❌ Apple Music Search Error :", err);
        return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }
}