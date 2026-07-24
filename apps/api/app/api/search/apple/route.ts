import { NextResponse } from "next/server";
import { generateAppleMusicToken } from "@/lib/appleMusic";

export const dynamic = "force-dynamic";

const STOREFRONT = "fr";
const FRANCE_RELEASE_EDITORIALS = [116, 52, 132];
const INTERNATIONAL_RELEASE_EDITORIALS = [0];

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
        releaseDate: a.releaseDate || null,
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
        releaseDate: attr.releaseDate || null,
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

async function appleFetch(path: string, token: string, storefront = STOREFRONT) {
    const res = await fetch(`https://api.music.apple.com/v1/catalog/${storefront}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        console.error("❌ Apple API error:", await res.text());
        return null;
    }
    return res.json();
}

function sortByReleaseDate(items: any[]) {
    return [...items].sort((a, b) => {
        const aTime = a?.releaseDate ? Date.parse(a.releaseDate) : 0;
        const bTime = b?.releaseDate ? Date.parse(b.releaseDate) : 0;
        return bTime - aTime;
    });
}

function mapDeezerAlbum(album: any) {
    return {
        id: `deezer:album:${album?.id || ""}`,
        type: "album",
        title: album?.title || "",
        artist: album?.artist?.name || "",
        cover: album?.cover_big || album?.cover_medium || album?.cover || null,
        releaseDate: album?.release_date || null,
    };
}

function releasedTodayOrBefore(item: any) {
    if (!item?.releaseDate) return false;
    const releaseTime = Date.parse(`${item.releaseDate}T00:00:00.000Z`);
    if (!Number.isFinite(releaseTime)) return false;

    const now = new Date();
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return releaseTime <= todayUtc;
}

async function deezerReleaseFetch(editorialId: number) {
    const res = await fetch(`https://api.deezer.com/editorial/${editorialId}/releases?limit=32`, {
        headers: { Accept: "application/json" },
    });
    if (!res.ok) {
        console.error("❌ Deezer releases error:", await res.text());
        return [];
    }
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data.map(mapDeezerAlbum) : [];
}

function mapDeezerTrack(track: any) {
    return {
        id: `deezer:track:${track?.id || ""}`,
        type: "song",
        title: track?.title_short || track?.title || "",
        artist: track?.artist?.name || "",
        cover: track?.album?.cover_big || track?.album?.cover_medium || track?.album?.cover || null,
        previewUrl: track?.preview || null,
        releaseDate: null,
    };
}

function mapDeezerSearchAlbum(album: any) {
    return {
        id: `deezer:album:${album?.id || ""}`,
        type: "album",
        title: album?.title || "",
        artist: album?.artist?.name || "",
        cover: album?.cover_big || album?.cover_medium || album?.cover || null,
        releaseDate: album?.release_date || null,
    };
}

function mapDeezerArtist(artist: any) {
    return {
        id: `artist:${String(artist?.name || artist?.id || "").toLowerCase()}`,
        type: "artist",
        name: artist?.name || "",
        cover: artist?.picture_big || artist?.picture_medium || artist?.picture || null,
    };
}

async function deezerJson(url: string) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return res.json().catch(() => null);
}

async function deezerDiscoverItems(type: string) {
    if (type === "album") {
        const items = await latestReleasesFromDeezer(FRANCE_RELEASE_EDITORIALS);
        return items.slice(0, 24);
    }

    const json = await deezerJson("https://api.deezer.com/chart/0/tracks?limit=30");
    const tracks = Array.isArray(json?.data) ? json.data : [];

    if (type === "artist") {
        const byName = new Map<string, any>();
        for (const track of tracks) {
            const artist = track?.artist;
            const name = artist?.name || "";
            if (!name || byName.has(name.toLowerCase())) continue;
            byName.set(name.toLowerCase(), mapDeezerArtist(artist));
        }
        return Array.from(byName.values()).slice(0, 24);
    }

    return tracks.map(mapDeezerTrack).filter((item: any) => item.id && item.title).slice(0, 24);
}

async function deezerSearchItems(query: string, type: string) {
    const endpoint =
        type === "album"
            ? "album"
            : type === "artist"
                ? "artist"
                : "track";

    const json = await deezerJson(
        `https://api.deezer.com/search/${endpoint}?q=${encodeURIComponent(query)}&limit=24`
    );
    const rows = Array.isArray(json?.data) ? json.data : [];

    if (type === "album") return rows.map(mapDeezerSearchAlbum).filter((item: any) => item.id && item.title);
    if (type === "artist") return rows.map(mapDeezerArtist).filter((item: any) => item.id && item.name);
    return rows.map(mapDeezerTrack).filter((item: any) => item.id && item.title);
}

async function latestReleasesFromDeezer(editorialIds: number[]) {
    const groups = await Promise.all(editorialIds.map((id) => deezerReleaseFetch(id)));
    return sortByReleaseDate(
        uniqueById(groups.flat())
            .filter((item) => item.id && item.title && item.artist)
            .filter(releasedTodayOrBefore)
    ).slice(0, 18);
}

async function latestReleaseSections() {
    const [france, international] = await Promise.all([
        latestReleasesFromDeezer(FRANCE_RELEASE_EDITORIALS),
        latestReleasesFromDeezer(INTERNATIONAL_RELEASE_EDITORIALS),
    ]);

    return [
        {
            id: "france",
            title: "Dernières sorties en France",
            subtitle: "Rap, pop et chanson française sorties récemment.",
            items: france,
        },
        {
            id: "international",
            title: "Dernières sorties internationales",
            subtitle: "Les nouveautés globales fraîchement publiées.",
            items: international,
        },
    ];
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
    const mode = searchParams.get("mode") || "";

    try {
        if (mode === "releases") {
            const sections = await latestReleaseSections();
            return NextResponse.json({ sections, mode: "releases" });
        }

        let devToken = "";
        try {
            devToken = generateAppleMusicToken();
        } catch (tokenError) {
            console.error("Apple Music token unavailable, using Deezer fallback:", tokenError);
        }

        if (!q.trim()) {
            const items = devToken
                ? await discoverItems(type, devToken)
                : await deezerDiscoverItems(type);
            if (items.length > 0) {
                return NextResponse.json({ items, mode: "discover" });
            }

            const fallbackItems = await deezerDiscoverItems(type);
            return NextResponse.json({ items: fallbackItems, mode: "discover" });
        }

        const variants = buildQueryVariants(q);
        const mapped: any[] = [];

        for (const variant of variants) {
            const json = devToken
                ? await appleFetch(
                    `/search?term=${encodeURIComponent(variant)}&types=${appleType(type)}&limit=20`,
                    devToken
                )
                : null;
            if (!json) continue;

            if (type === "album") mapped.push(...(json.results?.albums?.data || []).map(mapAlbum));
            else if (type === "artist") mapped.push(...(json.results?.artists?.data || []).map(mapArtist));
            else mapped.push(...(json.results?.songs?.data || []).map(mapSong));

            if (mapped.length >= 18) break;
        }

        const items = uniqueById(mapped)
            .filter((item) => item.title || item.name)
            .slice(0, 24);

        if (items.length > 0) {
            return NextResponse.json({ items, mode: "search" });
        }

        const fallbackItems = await deezerSearchItems(q, type);
        return NextResponse.json({ items: fallbackItems.slice(0, 24), mode: "search" });
    } catch (err) {
        console.error("❌ Search route error:", err);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}
