import "@/lib/loadModels";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db";
import { getOptionalUserId } from "@/lib/requestAuth";
import Post from "@/models/Post";
import User from "@/models/User";

export const dynamic = "force-dynamic";

function toObjectId(id: string) {
    return new mongoose.Types.ObjectId(id);
}

function idString(value: any) {
    return value?._id?.toString?.() || value?.toString?.() || "";
}

function isVisibleAuthor(author: any, meId: string | null, followingSet: Set<string>) {
    if (!author) return false;
    const authorId = idString(author);
    if (!authorId) return false;
    if (!author.isPrivate) return true;
    if (meId && authorId === meId) return true;
    return followingSet.has(authorId);
}

function getRatingAverage(post: any) {
    if (typeof post?.rating === "number") return post.rating;

    if (post?.ratings && typeof post.ratings === "object") {
        const values = Object.values(post.ratings).filter((v) => typeof v === "number") as number[];
        if (values.length) return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    return 0;
}

function getEntityKey(post: any) {
    if (post?.entityType && post?.entityId) return `${post.entityType}:${post.entityId}`;
    return `${post?.entityType || "song"}:${post?.trackTitle || ""}:${post?.artist || ""}`.toLowerCase();
}

function summarizePosts(posts: any[]) {
    const groups = new Map<string, any>();

    for (const post of posts) {
        const key = getEntityKey(post);
        const rating = getRatingAverage(post);
        if (!rating) continue;

        const current =
            groups.get(key) || {
                key,
                entityType: post.entityType || "song",
                entityId: post.entityId || null,
                title: post.trackTitle || "Titre inconnu",
                artist: post.artist || "",
                coverUrl: post.coverUrl || null,
                previewUrl: post.previewUrl || null,
                ratings: [],
                postCount: 0,
                engagement: 0,
                lastPostAt: post.createdAt || null,
            };

        const likes = Array.isArray(post.likes) ? post.likes.length : Number(post.likesCount || 0);
        const reposts = Array.isArray(post.reposts) ? post.reposts.length : Number(post.repostsCount || 0);
        const comments = Number(post.commentsCount || 0);

        current.ratings.push(rating);
        current.postCount += 1;
        current.engagement += likes + reposts * 2 + comments * 1.5;

        if (!current.lastPostAt || new Date(post.createdAt).getTime() > new Date(current.lastPostAt).getTime()) {
            current.lastPostAt = post.createdAt;
        }

        groups.set(key, current);
    }

    return Array.from(groups.values()).map((item) => {
        const ratings = item.ratings as number[];
        const averageRating = ratings.reduce((sum, value) => sum + value, 0) / ratings.length;
        const variance =
            ratings.reduce((sum, value) => sum + Math.pow(value - averageRating, 2), 0) / ratings.length;
        const ratingSpread = Math.sqrt(variance);
        const freshnessHours = Math.max(
            1,
            (Date.now() - new Date(item.lastPostAt || Date.now()).getTime()) / 36e5
        );
        const freshness = 18 / Math.pow(freshnessHours + 5, 0.64);

        return {
            key: item.key,
            entityType: item.entityType,
            entityId: item.entityId,
            title: item.title,
            artist: item.artist,
            coverUrl: item.coverUrl,
            previewUrl: item.previewUrl,
            postCount: item.postCount,
            averageRating: Number(averageRating.toFixed(2)),
            ratingSpread: Number(ratingSpread.toFixed(2)),
            engagement: Number(item.engagement.toFixed(1)),
            lastPostAt: item.lastPostAt,
            heatScore: Number((averageRating * 8 + item.postCount * 5 + item.engagement * 2 + freshness).toFixed(2)),
            debateScore: Number((ratingSpread * 16 + item.postCount * 3 + item.engagement).toFixed(2)),
        };
    });
}

export async function GET(req: Request) {
    try {
        await connectDB();

        const meId = await getOptionalUserId(req);
        const meUser =
            meId && mongoose.Types.ObjectId.isValid(meId)
                ? await User.findById(meId).select("_id followingList").lean()
                : null;

        const followingIds = Array.isArray((meUser as any)?.followingList)
            ? (meUser as any).followingList
                .filter((id: any) => mongoose.Types.ObjectId.isValid(id))
                .map((id: any) => toObjectId(String(id)))
            : [];
        const followingSet: Set<string> = new Set(followingIds.map((id) => id.toString()));

        const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);

        const docs: any[] = await Post.find({
            type: "post",
            createdAt: { $gte: since },
        })
            .sort({ _id: -1 })
            .limit(450)
            .populate("userId", "_id isPrivate")
            .lean();

        const visibleDocs = docs.filter((post) => isVisibleAuthor(post.userId, meId, followingSet));
        const followingDocs = followingIds.length
            ? visibleDocs.filter((post) => followingSet.has(idString(post.userId)))
            : [];

        const community = summarizePosts(visibleDocs)
            .sort((a, b) => b.heatScore - a.heatScore)
            .slice(0, 8);

        const following = summarizePosts(followingDocs)
            .sort((a, b) => b.heatScore - a.heatScore)
            .slice(0, 8);

        const debate = summarizePosts(visibleDocs)
            .filter((item) => item.postCount >= 2)
            .sort((a, b) => b.debateScore - a.debateScore)
            .slice(0, 8);

        return NextResponse.json(
            {
                community,
                following,
                debate,
                updatedAt: new Date().toISOString(),
            },
            { status: 200 }
        );
    } catch (err) {
        console.error("GET /api/feed/insights error:", err);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}
