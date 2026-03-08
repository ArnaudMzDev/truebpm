import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { verifyToken } from "@/lib/auth";

const SELECT_USER =
    "_id pseudo email bio avatarUrl bannerUrl followers following followersList followingList notesCount createdAt isOnline lastSeenAt pinnedTrack favoriteArtists favoriteAlbums favoriteTracks";

function normalizeMusicRef(input: any, expectedType?: "song" | "album" | "artist") {
    if (!input || typeof input !== "object") return null;

    const entityType = String(input.entityType || "").trim() as "song" | "album" | "artist";
    if (!["song", "album", "artist"].includes(entityType)) return null;
    if (expectedType && entityType !== expectedType) return null;

    return {
        entityId: String(input.entityId || "").trim(),
        entityType,
        title: String(input.title || "").trim(),
        artist: String(input.artist || "").trim(),
        coverUrl: String(input.coverUrl || "").trim(),
        previewUrl: String(input.previewUrl || "").trim(),
    };
}

function normalizeMusicArray(input: any, expectedType?: "song" | "album" | "artist") {
    if (!Array.isArray(input)) return null;

    const clean = input
        .map((item) => normalizeMusicRef(item, expectedType))
        .filter(Boolean)
        .slice(0, 3);

    return clean;
}

export async function PATCH(req: Request) {
    try {
        await connectDB();

        const userId = await verifyToken(req);
        if (!userId) {
            return NextResponse.json(
                { error: "Non authentifié." },
                { status: 401, headers: { "Cache-Control": "no-store" } }
            );
        }

        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object") {
            return NextResponse.json(
                { error: "Requête invalide." },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        const {
            pseudo,
            bio,
            avatarUrl,
            bannerUrl,
            pinnedTrack,
            favoriteArtists,
            favoriteAlbums,
            favoriteTracks,
        } = body as {
            pseudo?: unknown;
            bio?: unknown;
            avatarUrl?: unknown;
            bannerUrl?: unknown;
            pinnedTrack?: unknown;
            favoriteArtists?: unknown;
            favoriteAlbums?: unknown;
            favoriteTracks?: unknown;
        };

        const update: Record<string, any> = {};

        if (typeof pseudo === "string") {
            const p = pseudo.trim();
            if (p.length > 0) update.pseudo = p;
        }

        if (typeof bio === "string") {
            update.bio = bio.trim();
        }

        if (avatarUrl === null) {
            update.avatarUrl = "";
        } else if (typeof avatarUrl === "string") {
            const a = avatarUrl.trim();
            if (a.length > 0) update.avatarUrl = a;
        }

        if (bannerUrl === null) {
            update.bannerUrl = "";
        } else if (typeof bannerUrl === "string") {
            const b = bannerUrl.trim();
            if (b.length > 0) update.bannerUrl = b;
        }

        // ✅ pinned track
        if (pinnedTrack === null) {
            update.pinnedTrack = null;
        } else if (typeof pinnedTrack === "object") {
            const normalized = normalizeMusicRef(pinnedTrack, "song");
            if (normalized) update.pinnedTrack = normalized;
        }

        // ✅ favorites
        if (favoriteArtists !== undefined) {
            const normalized = normalizeMusicArray(favoriteArtists, "artist");
            if (normalized) update.favoriteArtists = normalized;
        }

        if (favoriteAlbums !== undefined) {
            const normalized = normalizeMusicArray(favoriteAlbums, "album");
            if (normalized) update.favoriteAlbums = normalized;
        }

        if (favoriteTracks !== undefined) {
            const normalized = normalizeMusicArray(favoriteTracks, "song");
            if (normalized) update.favoriteTracks = normalized;
        }

        let user: any = null;

        if (Object.keys(update).length > 0) {
            user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true })
                .select(SELECT_USER)
                .lean();
        } else {
            user = await User.findById(userId).select(SELECT_USER).lean();
        }

        if (!user) {
            return NextResponse.json(
                { error: "Utilisateur introuvable." },
                { status: 404, headers: { "Cache-Control": "no-store" } }
            );
        }

        return NextResponse.json(
            { success: true, user },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    } catch (err) {
        console.error("❌ PATCH /api/user/profile error:", err);
        return NextResponse.json(
            { error: "Erreur interne serveur." },
            { status: 500, headers: { "Cache-Control": "no-store" } }
        );
    }
}