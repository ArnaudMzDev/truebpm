import { NextResponse } from "next/server";
import crypto from "crypto";

const TEAM_ID = process.env.APPLE_MUSIC_TEAM_ID!;
const KEY_ID = process.env.APPLE_MUSIC_KEY_ID!;
const PRIVATE_KEY = process.env.APPLE_MUSIC_PRIVATE_KEY!.replace(/\\n/g, "\n");

const STOREFRONT = "fr";

/* -------------------------------------------------------------------------- */
/*                🔐 GENERATE APPLE MUSIC JWT USING ES256 (CORRECT)          */
/* -------------------------------------------------------------------------- */

function generateAppleToken() {
    const header = {
        alg: "ES256",
        kid: KEY_ID,
    };

    const payload = {
        iss: TEAM_ID,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const base64url = (input: any) =>
        Buffer.from(JSON.stringify(input))
            .toString("base64")
            .replace(/=/g, "")
            .replace(/\+/g, "-")
            .replace(/\//g, "_");

    const unsigned = `${base64url(header)}.${base64url(payload)}`;

    // ❗ SIGNATURE EN ES256 (ECDSA) – PAS RSA
    const sign = crypto.createSign("SHA256");
    sign.update(unsigned);
    sign.end();

    const signature = sign
        .sign({
            key: PRIVATE_KEY,
            dsaEncoding: "ieee-p1363", // 🔥 obligatoire pour Apple
        })
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

    return `${unsigned}.${signature}`;
}

/* -------------------------------------------------------------------------- */
/*                             🔍 SEARCH HANDLER                              */
/* -------------------------------------------------------------------------- */

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const type = searchParams.get("type") || "song";

    if (!q.trim()) {
        return NextResponse.json({ items: [] });
    }

    try {
        const devToken = generateAppleToken();

        const res = await fetch(
            `https://api.music.apple.com/v1/catalog/${STOREFRONT}/search?term=${encodeURIComponent(
                q
            )}&types=${type}s&limit=20`,
            {
                headers: { Authorization: `Bearer ${devToken}` },
            }
        );

        if (!res.ok) {
            console.error("❌ Apple search error:", await res.text());
            return NextResponse.json({ error: "Apple API error" }, { status: 500 });
        }

        const json = await res.json();

        if (type === "song") {
            const songs = json.results?.songs?.data || [];
            return NextResponse.json({
                items: songs.map((s: any) => {
                    const a = s.attributes;
                    return {
                        id: s.id,
                        type: "song",
                        title: a.name,
                        artist: a.artistName,
                        cover: a.artwork?.url
                            ?.replace("{w}", "300")
                            ?.replace("{h}", "300"),
                        previewUrl: a.previews?.[0]?.url || null,
                    };
                }),
            });
        }

        if (type === "album") {
            const albums = json.results?.albums?.data || [];
            return NextResponse.json({
                items: albums.map((a: any) => ({
                    id: a.id,
                    type: "album",
                    title: a.attributes.name,
                    artist: a.attributes.artistName,
                    cover: a.attributes.artwork?.url
                        ?.replace("{w}", "300")
                        ?.replace("{h}", "300"),
                })),
            });
        }

        if (type === "artist") {
            const artists = json.results?.artists?.data || [];
            return NextResponse.json({
                items: artists.map((a: any) => ({
                    id: a.id,
                    type: "artist",
                    name: a.attributes.name,
                    cover: a.attributes.artwork?.url
                        ?.replace("{w}", "400")
                        ?.replace("{h}", "400") || null,
                })),
            });
        }

        return NextResponse.json({ items: [] });
    } catch (err) {
        console.error("❌ Search route error:", err);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}