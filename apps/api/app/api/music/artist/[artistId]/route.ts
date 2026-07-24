import { NextResponse } from "next/server";
import { generateAppleMusicToken } from "@/lib/appleMusic";

export const dynamic = "force-dynamic";

const STOREFRONT = "fr";

function artwork(url?: string, size = 900) {
    return url?.replace("{w}", String(size))?.replace("{h}", String(size)) || null;
}

function cleanBio(value: unknown) {
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

async function appleFetch(path: string, token: string) {
    const res = await fetch(`https://api.music.apple.com/v1/catalog/${STOREFRONT}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 3600 },
    });

    if (!res.ok) {
        const text = await res.text();
        console.error("Apple artist API error:", res.status, text.slice(0, 300));
        return null;
    }

    return res.json();
}

async function fetchWikipediaBio(name: string) {
    const query = name.trim();
    if (!query) return "";

    async function fetchSummary(title: string, lang: string) {
        const res = await fetch(
            `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
            {
                headers: { Accept: "application/json" },
                next: { revalidate: 86400 },
            }
        );

        if (!res.ok) return "";
        const json = await res.json();
        if (json?.type === "disambiguation") return "";

        return cleanBio(json?.extract);
    }

    async function searchTitle(lang: string) {
        const params = new URLSearchParams({
            action: "query",
            format: "json",
            list: "search",
            origin: "*",
            srlimit: "3",
            srsearch: `${query} artiste chanteur musicien`,
        });

        const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?${params.toString()}`, {
            headers: { Accept: "application/json" },
            next: { revalidate: 86400 },
        });

        if (!res.ok) return "";
        const json = await res.json();
        return cleanBio(json?.query?.search?.[0]?.title);
    }

    for (const lang of ["fr", "en"]) {
        try {
            const exactBio = await fetchSummary(query, lang);
            if (exactBio) return exactBio;

            const title = await searchTitle(lang);
            const bio = title ? await fetchSummary(title, lang) : "";
            if (bio) return bio;
        } catch (err) {
            console.error("Wikipedia artist bio error:", err);
        }
    }

    return "";
}

async function fetchArtistView(artistId: string, viewName: string, token: string, limit = 24) {
    return appleFetch(
        `/artists/${encodeURIComponent(artistId)}/view/${viewName}?limit=${limit}`,
        token
    );
}

function mapAlbum(item: any) {
    const attr = item?.attributes || {};
    return {
        id: String(item?.id || ""),
        type: "album",
        title: attr.name || "",
        artist: attr.artistName || "",
        cover: artwork(attr.artwork?.url, 500),
        releaseDate: attr.releaseDate || null,
        trackCount: attr.trackCount || null,
        albumType: attr.albumType || "",
    };
}

function mapSong(item: any) {
    const attr = item?.attributes || {};
    return {
        id: String(item?.id || ""),
        type: "song",
        title: attr.name || "",
        artist: attr.artistName || "",
        cover: artwork(attr.artwork?.url, 500),
        previewUrl: attr.previews?.[0]?.url || null,
        releaseDate: attr.releaseDate || null,
    };
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

async function resolveArtistId(rawId: string, name: string, token: string) {
    if (rawId && !rawId.startsWith("artist:")) return rawId;
    const query = name || rawId.replace(/^artist:/, "").replace(/-/g, " ");
    if (!query.trim()) return rawId;

    const json = await appleFetch(
        `/search?term=${encodeURIComponent(query)}&types=artists&limit=1`,
        token
    );

    return String(json?.results?.artists?.data?.[0]?.id || rawId);
}

export async function GET(
    req: Request,
    { params }: { params: { artistId: string } }
) {
    const { searchParams } = new URL(req.url);
    const encodedArtistId = params.artistId;
    const rawArtistId = decodeURIComponent(encodedArtistId || "");
    const fallbackName = searchParams.get("name") || "";

    try {
        const token = generateAppleMusicToken();
        const artistId = await resolveArtistId(rawArtistId, fallbackName, token);

        const [
            artistJson,
            fullAlbumsJson,
            featuredAlbumsJson,
            relationshipAlbumsJson,
            singlesJson,
            topSongsJson,
        ] = await Promise.all([
            appleFetch(`/artists/${encodeURIComponent(artistId)}?extend=editorialNotes`, token),
            fetchArtistView(artistId, "full-albums", token),
            fetchArtistView(artistId, "featured-albums", token, 12),
            appleFetch(`/artists/${encodeURIComponent(artistId)}/albums?limit=24`, token),
            fetchArtistView(artistId, "singles", token),
            fetchArtistView(artistId, "top-songs", token, 12),
        ]);

        const artist = artistJson?.data?.[0];
        if (!artist) {
            return NextResponse.json({ error: "Artiste introuvable." }, { status: 404 });
        }

        const attr = artist.attributes || {};
        const topSongs = (topSongsJson?.data || []).map(mapSong).filter((x: any) => x.id && x.title);
        const albumItems = [
            ...(fullAlbumsJson?.data || []),
            ...(featuredAlbumsJson?.data || []),
            ...(!fullAlbumsJson?.data?.length && !featuredAlbumsJson?.data?.length
                ? relationshipAlbumsJson?.data || []
                : []),
        ];
        const albums = uniqueById(albumItems.map(mapAlbum))
            .filter((x: any) => x.id && x.title)
            .sort((a, b) => {
                const aTime = a.releaseDate ? Date.parse(a.releaseDate) : 0;
                const bTime = b.releaseDate ? Date.parse(b.releaseDate) : 0;
                return bTime - aTime;
            });
        const singles = uniqueById((singlesJson?.data || []).map(mapAlbum))
            .filter((x: any) => x.id && x.title)
            .sort((a, b) => {
                const aTime = a.releaseDate ? Date.parse(a.releaseDate) : 0;
                const bTime = b.releaseDate ? Date.parse(b.releaseDate) : 0;
                return bTime - aTime;
            });

        const fallbackCover = albums[0]?.cover || singles[0]?.cover || topSongs[0]?.cover || null;
        const notes = attr.editorialNotes || {};
        const artistName = attr.name || fallbackName || "Artiste";
        const appleBio = cleanBio(notes.standard || notes.short);
        const fallbackBio = appleBio ? "" : await fetchWikipediaBio(artistName);

        return NextResponse.json({
            artist: {
                id: String(artist.id || artistId),
                type: "artist",
                name: artistName,
                cover: artwork(attr.artwork?.url, 900) || fallbackCover,
                genres: attr.genreNames || [],
                bio: appleBio || fallbackBio,
                bioSource: appleBio ? "apple" : fallbackBio ? "wikipedia" : "",
                url: attr.url || "",
            },
            albums,
            singles,
            topSongs,
        });
    } catch (err) {
        console.error("GET /api/music/artist/[artistId] error:", err);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}
