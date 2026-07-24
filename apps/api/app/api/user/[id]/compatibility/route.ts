import "@/lib/loadModels";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import Post from "@/models/Post";
import User from "@/models/User";

export const dynamic = "force-dynamic";

function idString(value: any) {
    return value?._id?.toString?.() || value?.toString?.() || "";
}

function getRatingAverage(post: any) {
    if (typeof post?.rating === "number") return post.rating;

    if (post?.ratings && typeof post.ratings === "object") {
        const values = Object.values(post.ratings).filter((v) => typeof v === "number") as number[];
        if (values.length) return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    return 0;
}

function entityKey(post: any) {
    if (post?.entityType && post?.entityId) return `${post.entityType}:${post.entityId}`;
    return `${post?.entityType || "song"}:${post?.trackTitle || ""}:${post?.artist || ""}`.toLowerCase();
}

function musicRefKey(ref: any) {
    if (!ref) return "";
    if (ref.entityType && ref.entityId) return `${ref.entityType}:${ref.entityId}`;
    return `${ref.entityType || "song"}:${ref.title || ""}:${ref.artist || ""}`.toLowerCase();
}

function normalizeArtist(value: any) {
    return String(value || "")
        .trim()
        .toLowerCase();
}

function buildPostMap(posts: any[]) {
    const map = new Map<string, any>();
    for (const post of posts) {
        const rating = getRatingAverage(post);
        if (!rating) continue;
        const key = entityKey(post);
        if (!map.has(key)) {
            map.set(key, {
                key,
                entityType: post.entityType || "song",
                entityId: post.entityId || null,
                title: post.trackTitle || "",
                artist: post.artist || "",
                coverUrl: post.coverUrl || null,
                rating,
            });
        }
    }
    return map;
}

function collectFavoriteKeys(user: any) {
    return [
        user?.pinnedTrack,
        ...(Array.isArray(user?.favoriteArtists) ? user.favoriteArtists : []),
        ...(Array.isArray(user?.favoriteAlbums) ? user.favoriteAlbums : []),
        ...(Array.isArray(user?.favoriteTracks) ? user.favoriteTracks : []),
    ]
        .map(musicRefKey)
        .filter(Boolean);
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        await connectDB();

        const targetId = params.id;
        if (!mongoose.Types.ObjectId.isValid(targetId)) {
            return NextResponse.json({ error: "ID utilisateur invalide." }, { status: 400 });
        }

        const meId = await requireUserId(req);
        if (!meId) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        if (String(meId) === String(targetId)) {
            return NextResponse.json({ compatibility: null }, { status: 200 });
        }

        const [me, target] = await Promise.all([
            User.findById(meId)
                .select("_id favoriteArtists favoriteAlbums favoriteTracks pinnedTrack")
                .lean(),
            User.findById(targetId)
                .select("_id pseudo isPrivate followersList favoriteArtists favoriteAlbums favoriteTracks pinnedTrack")
                .lean(),
        ]);

        if (!target) {
            return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
        }

        const isFollowing =
            Array.isArray((target as any).followersList) &&
            (target as any).followersList.some((id: any) => String(id) === String(meId));
        const locked = !!(target as any).isPrivate && !isFollowing;

        if (locked) {
            return NextResponse.json({ compatibility: { locked: true } }, { status: 200 });
        }

        const [myPosts, targetPosts] = await Promise.all([
            Post.find({ userId: meId, type: "post" }).sort({ _id: -1 }).limit(180).lean(),
            Post.find({ userId: targetId, type: "post" }).sort({ _id: -1 }).limit(180).lean(),
        ]);

        const myMap = buildPostMap(myPosts);
        const targetMap = buildPostMap(targetPosts);

        const sharedEntities = Array.from(myMap.keys())
            .filter((key) => targetMap.has(key))
            .map((key) => {
                const mine = myMap.get(key);
                const theirs = targetMap.get(key);
                return {
                    key,
                    entityType: mine.entityType,
                    entityId: mine.entityId,
                    title: mine.title || theirs.title,
                    artist: mine.artist || theirs.artist,
                    coverUrl: mine.coverUrl || theirs.coverUrl,
                    myRating: mine.rating,
                    theirRating: theirs.rating,
                    diff: Math.abs(mine.rating - theirs.rating),
                };
            });

        const myArtists = new Set([
            ...myPosts.map((post) => normalizeArtist(post.artist)),
            ...((me as any)?.favoriteArtists || []).map((ref: any) => normalizeArtist(ref.title || ref.artist)),
        ].filter(Boolean));
        const targetArtists = new Set([
            ...targetPosts.map((post) => normalizeArtist(post.artist)),
            ...((target as any)?.favoriteArtists || []).map((ref: any) => normalizeArtist(ref.title || ref.artist)),
        ].filter(Boolean));
        const sharedArtists = Array.from(myArtists)
            .filter((artist) => targetArtists.has(artist))
            .slice(0, 6);

        const myFavoriteKeys = new Set(collectFavoriteKeys(me));
        const targetFavoriteKeys = new Set(collectFavoriteKeys(target));
        const sharedFavorites = Array.from(myFavoriteKeys)
            .filter((key) => targetFavoriteKeys.has(key))
            .length;

        const agreements = sharedEntities.filter((item) => item.diff <= 0.75).length;
        const disagreements = sharedEntities
            .filter((item) => item.diff >= 1.5)
            .sort((a, b) => b.diff - a.diff)
            .slice(0, 3);

        const commonSignal = sharedEntities.length * 12 + sharedArtists.length * 7 + sharedFavorites * 10;
        const agreementSignal = sharedEntities.length
            ? (agreements / sharedEntities.length) * 32
            : sharedArtists.length || sharedFavorites
                ? 12
                : 0;
        const score = Math.max(0, Math.min(99, Math.round(18 + commonSignal + agreementSignal)));

        return NextResponse.json(
            {
                compatibility: {
                    locked: false,
                    score,
                    sharedEntities: sharedEntities.slice(0, 4),
                    sharedArtists,
                    sharedFavorites,
                    agreements,
                    disagreements,
                },
            },
            { status: 200 }
        );
    } catch (err) {
        console.error("GET /api/user/[id]/compatibility error:", err);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}
