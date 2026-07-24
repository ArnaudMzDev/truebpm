import { randomInt } from "crypto";
import BlindTest from "@/models/BlindTest";
import BlindTestTrack from "@/models/BlindTestTrack";
import { generateAppleMusicToken } from "@/lib/appleMusic";
import { buildArtistAliases, buildTitleAliases } from "@/lib/blindTest/answer";

const TRACK_FRESHNESS_MS = 12 * 60 * 60 * 1000;

const OFFICIAL_BLIND_TESTS = [
    {
        slug: "hits-france",
        title: "Hits France",
        description: "Les morceaux qui tournent en France en ce moment.",
        difficulty: "normal",
        region: "france",
        tags: ["hits", "france", "actuel"],
        featured: true,
        source: { provider: "apple", storefront: "fr", chartId: 0 },
    },
    {
        slug: "hits-internationaux",
        title: "Hits internationaux",
        description: "Les titres qui traversent les frontières.",
        difficulty: "normal",
        region: "international",
        tags: ["hits", "monde", "actuel"],
        featured: true,
        source: { provider: "apple", storefront: "us", chartId: 0 },
    },
    {
        slug: "rap",
        title: "Rap",
        description: "Classiques récents, têtes d’affiche et nouveaux noms.",
        difficulty: "hard",
        region: "mixed",
        tags: ["rap", "hip-hop"],
        featured: false,
        source: { provider: "deezer", storefront: "fr", chartId: 116 },
    },
    {
        slug: "pop",
        title: "Pop",
        description: "Refrains immédiats et morceaux incontournables.",
        difficulty: "normal",
        region: "mixed",
        tags: ["pop"],
        featured: false,
        source: { provider: "deezer", storefront: "fr", chartId: 132 },
    },
    {
        slug: "rnb",
        title: "R&B",
        description: "Voix, grooves et productions à reconnaître dès l’intro.",
        difficulty: "hard",
        region: "mixed",
        tags: ["rnb", "soul"],
        featured: false,
        source: { provider: "deezer", storefront: "fr", chartId: 165 },
    },
    {
        slug: "electro",
        title: "Électro",
        description: "Des clubs aux grands classiques électroniques.",
        difficulty: "hard",
        region: "mixed",
        tags: ["electro", "dance"],
        featured: false,
        source: { provider: "deezer", storefront: "fr", chartId: 106 },
    },
];

type ProviderTrack = {
    provider: "apple" | "deezer";
    providerId: string;
    storefront: string;
    title: string;
    artist: string;
    album: string;
    year: number | null;
    artworkUrl: string;
    previewUrl: string;
    territory: string;
};

function secureUrl(value: unknown) {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    return trimmed.startsWith("https://") ? trimmed : "";
}

function artworkUrl(value: unknown, size = 600) {
    const url = secureUrl(value);
    return url.replace("{w}", String(size)).replace("{h}", String(size));
}

function yearFromDate(value: unknown) {
    if (typeof value !== "string") return null;
    const year = Number(value.slice(0, 4));
    return Number.isInteger(year) && year >= 1900 && year <= 2200 ? year : null;
}

async function fetchJson(url: string, headers: Record<string, string> = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
        const response = await fetch(url, {
            headers: { Accept: "application/json", ...headers },
            cache: "no-store",
            signal: controller.signal,
        });
        if (!response.ok) return null;
        return response.json().catch(() => null);
    } finally {
        clearTimeout(timeout);
    }
}

async function fetchAppleChart(storefront: string): Promise<ProviderTrack[]> {
    const token = generateAppleMusicToken();
    const json = await fetchJson(
        `https://api.music.apple.com/v1/catalog/${storefront}/charts?types=songs&limit=100`,
        { Authorization: `Bearer ${token}` }
    );
    const rows = Array.isArray(json?.results?.songs?.[0]?.data)
        ? json.results.songs[0].data
        : [];

    return rows
        .map((row: any) => {
            const attributes = row?.attributes || {};
            return {
                provider: "apple" as const,
                providerId: String(row?.id || ""),
                storefront,
                title: String(attributes.name || "").trim(),
                artist: String(attributes.artistName || "").trim(),
                album: String(attributes.albumName || "").trim(),
                year: yearFromDate(attributes.releaseDate),
                artworkUrl: artworkUrl(attributes.artwork?.url),
                previewUrl: secureUrl(attributes.previews?.[0]?.url),
                territory: storefront,
            };
        })
        .filter((track: ProviderTrack) => track.providerId && track.title && track.artist && track.previewUrl);
}

async function fetchDeezerChart(chartId: number): Promise<ProviderTrack[]> {
    const json = await fetchJson(`https://api.deezer.com/chart/${chartId}/tracks?limit=100`);
    const rows = Array.isArray(json?.data) ? json.data : [];

    return rows
        .map((row: any) => ({
            provider: "deezer" as const,
            providerId: String(row?.id || ""),
            storefront: "fr",
            title: String(row?.title_short || row?.title || "").trim(),
            artist: String(row?.artist?.name || "").trim(),
            album: String(row?.album?.title || "").trim(),
            year: null,
            artworkUrl: secureUrl(row?.album?.cover_xl || row?.album?.cover_big || row?.album?.cover_medium),
            previewUrl: secureUrl(row?.preview),
            territory: "fr",
        }))
        .filter((track: ProviderTrack) => track.providerId && track.title && track.artist && track.previewUrl);
}

export async function ensureBlindTestCover(blindTest: any) {
    const savedCover = secureUrl(blindTest?.coverUrl);
    if (savedCover) return savedCover;

    const storedTrack = await BlindTestTrack.findOne({
        available: true,
        sourceCategories: blindTest.slug,
        artworkUrl: { $ne: "" },
    })
        .sort({ lastCheckedAt: -1 })
        .select("artworkUrl")
        .lean();
    let cover = secureUrl((storedTrack as any)?.artworkUrl);

    if (!cover) {
        try {
            const candidates = blindTest.source?.provider === "apple"
                ? await fetchAppleChart(blindTest.source?.storefront || "fr")
                : await fetchDeezerChart(Number(blindTest.source?.chartId || 0));
            cover = candidates.find((track) => !!track.artworkUrl)?.artworkUrl || "";
        } catch (error) {
            console.error(`Blind test cover ${blindTest.slug} unavailable:`, error);
        }
    }

    if (cover) {
        await BlindTest.updateOne({ _id: blindTest._id }, { $set: { coverUrl: cover } });
    }
    return cover;
}

async function verifyPreview(url: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
        const response = await fetch(url, {
            headers: { Range: "bytes=0-1023" },
            cache: "no-store",
            signal: controller.signal,
        });
        const contentType = response.headers.get("content-type") || "";
        await response.body?.cancel().catch(() => {});
        return response.ok && (!contentType || contentType.includes("audio") || contentType.includes("octet-stream"));
    } catch {
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

async function filterPlayable(tracks: ProviderTrack[], wanted: number) {
    const playable: ProviderTrack[] = [];
    const maxChecks = Math.min(tracks.length, Math.max(wanted * 2, 24));

    for (let start = 0; start < maxChecks && playable.length < wanted; start += 8) {
        const batch = tracks.slice(start, start + 8);
        const checks = await Promise.all(batch.map(async (track) => ({
            track,
            playable: await verifyPreview(track.previewUrl),
        })));
        playable.push(...checks.filter((check) => check.playable).map((check) => check.track));
    }

    return playable;
}

function shuffled<T>(items: T[]) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
        const swapIndex = randomInt(index + 1);
        [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
}

export async function ensureOfficialBlindTests() {
    await BlindTest.bulkWrite(
        OFFICIAL_BLIND_TESTS.map((definition) => ({
            updateOne: {
                filter: { slug: definition.slug },
                update: {
                    $set: { ...definition, active: true, supportedRoundCounts: [5, 10, 20, 30] },
                    $setOnInsert: { gamesCount: 0, scoreTotal: 0, bestScore: 0 },
                },
                upsert: true,
            },
        }))
    );

    return BlindTest.find({ active: true })
        .sort({ featured: -1, gamesCount: -1, title: 1 })
        .lean();
}

async function refreshTrackPool(blindTest: any, wanted: number) {
    let providerTracks: ProviderTrack[] = [];

    try {
        providerTracks = blindTest.source?.provider === "apple"
            ? await fetchAppleChart(blindTest.source?.storefront || "fr")
            : await fetchDeezerChart(Number(blindTest.source?.chartId || 0));
    } catch (error) {
        console.error(`Blind test provider ${blindTest.slug} unavailable:`, error);
    }

    if (providerTracks.length < wanted && blindTest.source?.provider === "apple") {
        const fallback = await fetchDeezerChart(0).catch(() => []);
        providerTracks = [...providerTracks, ...fallback];
    }

    const deduplicated = Array.from(
        new Map(providerTracks.map((track) => [`${track.provider}:${track.providerId}`, track])).values()
    );
    const playable = await filterPlayable(shuffled(deduplicated), wanted);
    const checkedAt = new Date();

    if (playable.length) {
        await BlindTestTrack.bulkWrite(
            playable.map((track) => ({
                updateOne: {
                    filter: {
                        provider: track.provider,
                        providerId: track.providerId,
                        storefront: track.storefront,
                    },
                    update: {
                        $set: {
                            ...track,
                            titleAliases: buildTitleAliases(track.title),
                            artistAliases: buildArtistAliases(track.artist),
                            previewDurationMs: 30000,
                            available: true,
                            lastCheckedAt: checkedAt,
                        },
                        $addToSet: { sourceCategories: blindTest.slug },
                    },
                    upsert: true,
                },
            }))
        );
    }
}

export async function getPlayableTracks(blindTest: any, roundCount: number) {
    const freshAfter = new Date(Date.now() - TRACK_FRESHNESS_MS);
    let tracks = await BlindTestTrack.find({
        available: true,
        sourceCategories: blindTest.slug,
        lastCheckedAt: { $gte: freshAfter },
    })
        .limit(100)
        .lean();

    if (tracks.length < roundCount) {
        await refreshTrackPool(blindTest, Math.min(80, Math.max(roundCount + 8, roundCount * 2)));
        tracks = await BlindTestTrack.find({
            available: true,
            sourceCategories: blindTest.slug,
            lastCheckedAt: { $gte: freshAfter },
        })
            .limit(100)
            .lean();
    }

    if (tracks.length < roundCount) {
        throw new Error("Pas assez d’extraits vérifiés pour lancer cette partie.");
    }

    return shuffled(tracks).slice(0, roundCount);
}
