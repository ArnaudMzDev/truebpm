import { NextResponse } from "next/server";
import { generateAppleMusicToken } from "@/lib/appleMusic";

export const dynamic = "force-dynamic";

const STOREFRONT = "fr";

function appleType(type: string) {
    if (type === "album") return "albums";
    if (type === "artist") return "artists";
    return "songs";
}

function artwork(url?: string, size = 400) {
    return url?.replace("{w}", String(size))?.replace("{h}", String(size)) || null;
}

function mapSong(s: any) {
    const a = s?.attributes || {};
    return {
        id: String(s?.id || ""),
        type: "song",
        title: a.name || "",
        artist: a.artistName || "",
        cover: artwork(a.artwork?.url, 400),
        previewUrl: a.previews?.[0]?.url || null,
    };
}

function mapAlbum(a: any) {
    const attr = a?.attributes || {};
    return {
        id: String(a?.id || ""),
        type: "album",
        title: attr.name || "",
        artist: attr.artistName || "",
        cover: artwork(attr.artwork?.url, 400),
    };
}

function mapArtist(a: any) {
    const attr = a?.attributes || {};
    return {
        id: String(a?.id || attr.url || attr.name || ""),
        type: "artist",
        name: attr.name || "",
        cover: artwork(attr.artwork?.url, 400),
    };
}

function normalizeQuery(q: string) {
    return q
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}\s'&.-]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function buildQueryVariants(raw: string) {
    const clean = raw.trim().replace(/\s+/g, " ");
    const normalized = normalizeQuery(clean);
    const tokens = normalized.split(" ").filter(Boolean);
    const variants = [
        clean,
        normalized,
        tokens.slice(0, 4).join(" "),
        tokens.filter((t) => t.length > 2).join(" "),
    ].filter((v) => v.length >= 2);

    return Array.from(new Set(variants));
}

function uniqueById(items: any[]) {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const item of items) {
        const id = String(item?.id || "");
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(item);
    }
    return out;
}

async function appleFetch(path: string, token: string) {
    const res = await fetch(`https://api.music.apple.com/v1/catalog/${STOREFRONT}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        console.error("❌ Apple API error:", await res.text());
        return null;
    }
    return res.json();
}

async function discoverItems(type: string, token: string) {
    if (type === "album") {
        const json = await appleFetch("/charts?types=albums&limit=24", token);
        const albums = json?.results?.albums?.[0]?.data || [];
        return albums.map(mapAlbum).filter((x: any) => x.id && x.title);
    }

    const json = await appleFetch("/charts?types=songs&limit=30", token);
    const songs = json?.results?.songs?.[0]?.data || [];

    if (type === "artist") {
        const byName = new Map<string, any>();
        for (const song of songs) {
            const a = song?.attributes || {};
            const name = a.artistName || "";
            if (!name || byName.has(name.toLowerCase())) continue;
            byName.set(name.toLowerCase(), {
                id: `artist:${name.toLowerCase()}`,
                type: "artist",
                name,
                cover: artwork(a.artwork?.url, 400),
            });
        }
        return Array.from(byName.values()).slice(0, 18);
    }

    return songs.map(mapSong).filter((x: any) => x.id && x.title);
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const type = searchParams.get("type") || "song";

    try {
        const devToken = generateAppleMusicToken();

        if (!q.trim()) {
            const items = await discoverItems(type, devToken);
            return NextResponse.json({ items, mode: "discover" });
        }

        const variants = buildQueryVariants(q);
        const mapped: any[] = [];

        for (const variant of variants) {
            const json = await appleFetch(
                `/search?term=${encodeURIComponent(variant)}&types=${appleType(type)}&limit=20`,
                devToken
            );
            if (!json) continue;

            if (type === "album") mapped.push(...(json.results?.albums?.data || []).map(mapAlbum));
            else if (type === "artist") mapped.push(...(json.results?.artists?.data || []).map(mapArtist));
            else mapped.push(...(json.results?.songs?.data || []).map(mapSong));

            if (mapped.length >= 18) break;
        }

        const items = uniqueById(mapped)
            .filter((item) => item.title || item.name)
            .slice(0, 24);

        return NextResponse.json({ items, mode: "search" });
    } catch (err) {
        console.error("❌ Search route error:", err);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}
