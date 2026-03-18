import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import mongoose from "mongoose";
import { verifyToken } from "@/lib/auth";

function toObjectId(id: string) {
    return new mongoose.Types.ObjectId(id);
}

function normalizeBasePost(base: any) {
    if (!base || typeof base !== "object") return null;

    const likesArr = Array.isArray(base.likes) ? base.likes : [];
    const repostsArr = Array.isArray(base.reposts) ? base.reposts : [];

    return {
        _id: base._id?.toString?.() || base._id,
        type: base.type || "post",

        userId: base.userId || null,
        createdAt: base.createdAt || null,
        updatedAt: base.updatedAt || null,

        mode: base.mode ?? "general",

        entityType: base.entityType ?? undefined,
        entityId: base.entityId ?? null,

        trackTitle: base.trackTitle ?? "",
        artist: base.artist ?? "",
        coverUrl: base.coverUrl ?? null,
        previewUrl: base.previewUrl ?? null,

        rating: typeof base.rating === "number" ? base.rating : null,
        ratings: base.ratings ?? null,

        prod: typeof base.prod === "number" ? base.prod : null,
        lyrics: typeof base.lyrics === "number" ? base.lyrics : null,
        emotion: typeof base.emotion === "number" ? base.emotion : null,

        comment: base.comment ?? "",

        likesCount: likesArr.length,
        repostsCount: repostsArr.length,
        commentsCount: Math.max(0, Number(base.commentsCount || 0)),

        likes: likesArr,
        reposts: repostsArr,
    };
}

export async function GET(req: Request) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const limit = Math.min(Number(searchParams.get("limit") || 15), 50);
        const cursor = searchParams.get("cursor");
        const userId = searchParams.get("userId");

        const query: any = {};
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            query.userId = toObjectId(userId);
        }
        if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
            query._id = { $lt: toObjectId(cursor) };
        }

        let meId: string | null = req.headers.get("x-user-id");
        if (!meId) {
            meId = await verifyToken(req).catch(() => null);
        }

        const me =
            meId && mongoose.Types.ObjectId.isValid(meId)
                ? toObjectId(meId)
                : null;

        const docs: any[] = await Post.find(query)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate("userId", "pseudo avatarUrl")
            .populate("repostedBy", "pseudo avatarUrl")
            .populate({
                path: "repostOf",
                populate: { path: "userId", select: "pseudo avatarUrl" },
            })
            .lean();

        let nextCursor: string | null = null;
        if (docs.length > limit) {
            const nextItem = docs.pop();
            nextCursor = nextItem?._id?.toString?.() ?? null;
        }

        const posts = docs.map((p: any) => {
            const isRepost = p.type === "repost" && p.repostOf;
            const base = normalizeBasePost(isRepost ? p.repostOf : p);

            const likesArr = Array.isArray(base?.likes) ? base.likes : [];
            const repostsArr = Array.isArray(base?.reposts) ? base.reposts : [];

            const likedByMe =
                !!me && likesArr.some((id: any) => id?.toString?.() === me.toString());

            const repostedByMe =
                !!me && repostsArr.some((id: any) => id?.toString?.() === me.toString());

            if (isRepost && base) {
                return {
                    _id: p._id?.toString?.() || p._id,
                    type: "repost",

                    userId: p.userId || null,
                    createdAt: p.createdAt || null,
                    updatedAt: p.updatedAt || null,

                    repostedBy: p.repostedBy || null,
                    repostComment: p.repostComment ?? "",

                    likesCount: base.likesCount,
                    repostsCount: base.repostsCount,
                    commentsCount: base.commentsCount,
                    likedByMe,
                    repostedByMe,

                    repostOf: {
                        _id: base._id,
                        type: "post",

                        userId: base.userId,
                        createdAt: base.createdAt,
                        updatedAt: base.updatedAt,

                        mode: base.mode,

                        entityType: base.entityType,
                        entityId: base.entityId,

                        trackTitle: base.trackTitle,
                        artist: base.artist,
                        coverUrl: base.coverUrl,
                        previewUrl: base.previewUrl,

                        rating: base.rating,
                        ratings: base.ratings,

                        prod: base.prod,
                        lyrics: base.lyrics,
                        emotion: base.emotion,

                        comment: base.comment,

                        likesCount: base.likesCount,
                        repostsCount: base.repostsCount,
                        commentsCount: base.commentsCount,
                    },
                };
            }

            return {
                _id: p._id?.toString?.() || p._id,
                type: p.type || "post",

                userId: p.userId || null,
                createdAt: p.createdAt || null,
                updatedAt: p.updatedAt || null,

                mode: p.mode ?? "general",

                entityType: p.entityType ?? undefined,
                entityId: p.entityId ?? null,

                trackTitle: p.trackTitle ?? "",
                artist: p.artist ?? "",
                coverUrl: p.coverUrl ?? null,
                previewUrl: p.previewUrl ?? null,

                rating: typeof p.rating === "number" ? p.rating : null,
                ratings: p.ratings ?? null,

                prod: typeof p.prod === "number" ? p.prod : null,
                lyrics: typeof p.lyrics === "number" ? p.lyrics : null,
                emotion: typeof p.emotion === "number" ? p.emotion : null,

                comment: p.comment ?? "",

                likesCount: base?.likesCount ?? 0,
                repostsCount: base?.repostsCount ?? 0,
                commentsCount: base?.commentsCount ?? 0,
                likedByMe,
                repostedByMe,

                repostOf: null,
                repostedBy: null,
                repostComment: "",
            };
        });

        return NextResponse.json({ posts, nextCursor }, { status: 200 });
    } catch (err) {
        console.error("❌ GET /api/posts error:", err);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}