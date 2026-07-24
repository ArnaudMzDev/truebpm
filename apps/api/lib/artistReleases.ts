import Notification from "@/models/Notification";
import User from "@/models/User";
import ArtistRelease from "@/models/ArtistRelease";
import { sendPushToUser } from "@/lib/push";
import { generateAppleMusicToken } from "@/lib/appleMusic";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/lib/notifications";

const STOREFRONT = "fr";
const PROFILE_RELEASE_DAYS = 365;
const NOTIFICATION_RELEASE_DAYS = 14;
const MAX_PROFILE_RELEASES_PER_ARTIST = 40;

type MusicRef = {
    entityId?: string;
    title?: string;
    artist?: string;
    coverUrl?: string;
};

type ReleaseItem = {
    itemId: string;
    itemType: "song" | "album";
    title: string;
    artistName: string;
    coverUrl: string;
    previewUrl: string;
    releaseDate: string;
};

type SyncOptions = {
    notify?: boolean;
    user?: any;
    maxArtists?: number;
};

function artwork(url?: string, size = 500) {
    return url?.replace("{w}", String(size))?.replace("{h}", String(size)) || "";
}

function normalizeSettings(settings: any) {
    return {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...(settings && typeof settings === "object" ? settings : {}),
    };
}

function isRecentRelease(releaseDate: string, days: number) {
    if (!releaseDate) return false;
    const releaseTime = Date.parse(`${releaseDate}T00:00:00.000Z`);
    if (!Number.isFinite(releaseTime)) return false;

    const now = new Date();
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const oldestUtc = todayUtc - days * 24 * 60 * 60 * 1000;

    return releaseTime <= todayUtc && releaseTime >= oldestUtc;
}

function sortByReleaseDate(items: ReleaseItem[]) {
    return [...items].sort((a, b) => {
        const aTime = a.releaseDate ? Date.parse(a.releaseDate) : 0;
        const bTime = b.releaseDate ? Date.parse(b.releaseDate) : 0;
        return bTime - aTime;
    });
}

function uniqueByRelease(items: ReleaseItem[]) {
    const seen = new Set<string>();
    const out: ReleaseItem[] = [];

    for (const item of items) {
        const key = `${item.itemType}:${item.itemId}`;
        if (!item.itemId || seen.has(key)) continue;
        seen.add(key);
        out.push(item);
    }

    return out;
}

async function appleFetch(path: string, token: string) {
    const res = await fetch(`https://api.music.apple.com/v1/catalog/${STOREFRONT}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 3600 },
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Apple releases API error:", res.status, text.slice(0, 300));
        return null;
    }

    return res.json();
}

function mapSong(item: any): ReleaseItem | null {
    const attr = item?.attributes || {};
    const itemId = String(item?.id || "");
    const title = String(attr.name || "").trim();
    const artistName = String(attr.artistName || "").trim();

    if (!itemId || !title || !artistName) return null;

    return {
        itemId,
        itemType: "song",
        title,
        artistName,
        coverUrl: artwork(attr.artwork?.url, 500),
        previewUrl: attr.previews?.[0]?.url || "",
        releaseDate: attr.releaseDate || "",
    };
}

function mapAlbum(item: any): ReleaseItem | null {
    const attr = item?.attributes || {};
    const itemId = String(item?.id || "");
    const title = String(attr.name || "").trim();
    const artistName = String(attr.artistName || "").trim();

    if (!itemId || !title || !artistName) return null;

    return {
        itemId,
        itemType: "album",
        title,
        artistName,
        coverUrl: artwork(attr.artwork?.url, 500),
        previewUrl: "",
        releaseDate: attr.releaseDate || "",
    };
}

async function resolveArtistId(rawId: string, name: string, token: string) {
    if (rawId && !rawId.startsWith("artist:")) return rawId;

    const fallback = rawId.replace(/^artist:/, "").replace(/[-_]/g, " ");
    const query = (name || fallback).trim();
    if (!query) return rawId;

    const json = await appleFetch(
        `/search?term=${encodeURIComponent(query)}&types=artists&limit=1`,
        token
    );

    return String(json?.results?.artists?.data?.[0]?.id || rawId);
}

async function fetchArtistReleases(artist: MusicRef, token: string) {
    const artistName = String(artist.title || artist.artist || "").trim();
    const artistId = await resolveArtistId(String(artist.entityId || ""), artistName, token);
    if (!artistId) return { artistId, artistName, releases: [] as ReleaseItem[] };

    const [singlesJson, albumsJson] = await Promise.all([
        appleFetch(`/artists/${encodeURIComponent(artistId)}/view/singles?limit=40`, token),
        appleFetch(`/artists/${encodeURIComponent(artistId)}/view/full-albums?limit=40`, token),
    ]);

    const songs = (singlesJson?.data || []).map(mapSong).filter(Boolean) as ReleaseItem[];
    const albums = (albumsJson?.data || []).map(mapAlbum).filter(Boolean) as ReleaseItem[];
    const releases = sortByReleaseDate(
        uniqueByRelease([...songs, ...albums]).filter((item) =>
            isRecentRelease(item.releaseDate, PROFILE_RELEASE_DAYS)
        )
    ).slice(0, MAX_PROFILE_RELEASES_PER_ARTIST);

    return {
        artistId,
        artistName: artistName || releases[0]?.artistName || "Artiste",
        releases,
    };
}

async function sendArtistReleaseNotification(user: any, release: any) {
    const settings = normalizeSettings(user?.notificationSettings);
    if (settings.enabled === false || settings.artistReleases === false) return false;

    const body =
        release.itemType === "album"
            ? `${release.artistName} vient de sortir ${release.title}.`
            : `${release.artistName} a sorti un nouveau son : ${release.title}.`;

    await Notification.create({
        recipientId: user._id,
        actorId: null,
        type: "artist_release",
        isRead: false,
        metadata: {
            releaseId: String(release._id),
            artistId: release.artistId,
            artistName: release.artistName,
            itemId: release.itemId,
            itemType: release.itemType,
            title: release.title,
            coverUrl: release.coverUrl,
            previewUrl: release.previewUrl,
        },
    });

    await sendPushToUser({
        recipientId: String(user._id),
        title: "Nouvelle sortie",
        body,
        data: {
            type: "artist_release",
            releaseId: String(release._id),
            artistId: release.artistId,
            artistName: release.artistName,
            itemId: release.itemId,
            itemType: release.itemType,
            title: release.title,
            coverUrl: release.coverUrl,
            previewUrl: release.previewUrl,
        },
    });

    return true;
}

export async function syncFavoriteArtistReleasesForUser(
    userId: string,
    options: SyncOptions = {}
) {
    const { notify = false, user: providedUser = null, maxArtists = 3 } = options;
    const user =
        providedUser ||
        (await User.findById(userId)
            .select("_id favoriteArtists notificationSettings")
            .lean());

    if (!user) return { created: 0, notified: 0, scannedArtists: 0 };

    const favoriteArtists = Array.isArray(user.favoriteArtists)
        ? user.favoriteArtists.slice(0, maxArtists)
        : [];

    if (!favoriteArtists.length) return { created: 0, notified: 0, scannedArtists: 0 };

    const token = generateAppleMusicToken();
    let created = 0;
    let notified = 0;
    let scannedArtists = 0;

    for (const artist of favoriteArtists) {
        const result = await fetchArtistReleases(artist, token);
        scannedArtists += 1;

        for (const item of result.releases) {
            const existing = await ArtistRelease.findOne({
                userId: user._id,
                artistId: result.artistId,
                itemId: item.itemId,
            })
                .select("_id")
                .lean();

            if (existing) continue;

            let release: any = null;
            try {
                release = await ArtistRelease.create({
                        userId: user._id,
                        artistId: result.artistId,
                        artistName: result.artistName || item.artistName,
                        itemId: item.itemId,
                        itemType: item.itemType,
                        title: item.title,
                        coverUrl: item.coverUrl,
                        previewUrl: item.previewUrl,
                        releaseDate: item.releaseDate,
                        source: "apple",
                });
            } catch (err: any) {
                if (err?.code === 11000) continue;
                throw err;
            }

            if (!release) continue;

            created += 1;

            if (notify && isRecentRelease(release.releaseDate, NOTIFICATION_RELEASE_DAYS)) {
                const delivered = await sendArtistReleaseNotification(user, release);
                if (delivered) {
                    notified += 1;
                    await ArtistRelease.updateOne(
                        { _id: release._id },
                        { $set: { notifiedAt: new Date() } }
                    );
                }
            }
        }
    }

    return { created, notified, scannedArtists };
}

export async function syncFavoriteArtistReleasesForUsers(limit = 60) {
    const users: any[] = await User.find({ "favoriteArtists.0": { $exists: true } })
        .select("_id favoriteArtists notificationSettings")
        .limit(limit)
        .lean();

    let created = 0;
    let notified = 0;

    for (const user of users) {
        const result = await syncFavoriteArtistReleasesForUser(String(user._id), {
            user,
            notify: true,
        });
        created += result.created;
        notified += result.notified;
    }

    return { users: users.length, created, notified };
}
