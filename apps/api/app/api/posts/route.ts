import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import User from "@/models/User";
import mongoose from "mongoose";
import { getOptionalUserId } from "@/lib/requestAuth";

export const dynamic = "force-dynamic";

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

function idString(value: any) {
    return value?._id?.toString?.() || value?.toString?.() || "";
}

function parseObjectIdList(value: string | null, max = 90) {
    if (!value) return [];
    const seen = new Set<string>();
    return value
        .split(",")
        .map((id) => id.trim())
        .filter((id) => {
            if (!mongoose.Types.ObjectId.isValid(id) || seen.has(id)) return false;
            seen.add(id);
            return true;
        })
        .slice(0, max)
        .map((id) => toObjectId(id));
}

function hashToUnit(input: string) {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967295;
}

function getFeedSeed(me: mongoose.Types.ObjectId | null, sessionSeed: string | null) {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const sixHourBucket = Math.floor(now.getUTCHours() / 6);
    const userPart = me?.toString?.() || "guest";
    const sessionPart = sessionSeed?.trim().slice(0, 48) || "default";
    return `${userPart}:${day}:${sixHourBucket}:${sessionPart}`;
}

function isVisibleAuthor(author: any, me: mongoose.Types.ObjectId | null, followingSet: Set<string>) {
    if (!author) return false;
    const authorId = idString(author);
    if (!authorId) return false;
    if (!author.isPrivate) return true;
    if (me && authorId === me.toString()) return true;
    return followingSet.has(authorId);
}

function getRatingAverage(post: any) {
    if (!post) return 0;
    if (typeof post.rating === "number") return post.rating;
    if (post.ratings && typeof post.ratings === "object") {
        const values = Object.values(post.ratings).filter((v) => typeof v === "number") as number[];
        if (values.length) return values.reduce((a, b) => a + b, 0) / values.length;
    }
    const legacy = [post.prod, post.lyrics, post.emotion].filter((v) => typeof v === "number") as number[];
    if (legacy.length) return legacy.reduce((a, b) => a + b, 0) / legacy.length;
    return 0;
}

function getInterestTokens(meUser: any) {
    const refs = [
        meUser?.pinnedTrack,
        ...(Array.isArray(meUser?.favoriteArtists) ? meUser.favoriteArtists : []),
        ...(Array.isArray(meUser?.favoriteAlbums) ? meUser.favoriteAlbums : []),
        ...(Array.isArray(meUser?.favoriteTracks) ? meUser.favoriteTracks : []),
    ].filter(Boolean);

    return refs
        .flatMap((ref: any) => [ref?.title, ref?.artist, ref?.entityId])
        .filter((x: any) => typeof x === "string" && x.trim().length >= 3)
        .map((x: string) => x.trim().toLowerCase());
}

function scoreForYouPost(
    doc: any,
    me: mongoose.Types.ObjectId | null,
    followingSet: Set<string>,
    interests: string[],
    feedSeed: string
) {
    const isRepost = doc.type === "repost" && doc.repostOf;
    const base = isRepost ? doc.repostOf : doc;
    const baseAuthorId = idString(base?.userId);
    const wrapperAuthorId = idString(doc?.userId);
    const docId = idString(doc?._id);
    const baseId = idString(base?._id);

    const likes = Array.isArray(base?.likes) ? base.likes.length : Number(base?.likesCount || 0);
    const reposts = Array.isArray(base?.reposts) ? base.reposts.length : Number(base?.repostsCount || 0);
    const comments = Math.max(0, Number(base?.commentsCount || 0));
    const ratingAvg = getRatingAverage(base);
    const commentLength = typeof base?.comment === "string" ? base.comment.trim().length : 0;

    const createdAt = new Date(doc?.createdAt || base?.createdAt || Date.now()).getTime();
    const ageHours = Math.max(1, (Date.now() - createdAt) / 36e5);
    const recency = 42 / Math.pow(ageHours + 5, 0.68);
    const freshnessBonus = ageHours <= 24 ? 10 : ageHours <= 72 ? 5 : ageHours <= 168 ? 2 : 0;

    const searchable = `${base?.trackTitle || ""} ${base?.artist || ""} ${base?.comment || ""}`.toLowerCase();
    const interestHits = interests.reduce((count, token) => count + (searchable.includes(token) ? 1 : 0), 0);
    const interestBonus = Math.min(18, interestHits * 8);
    const mediaBonus = base?.previewUrl ? 3 : 0;
    const commentBonus = Math.min(6, commentLength / 42);
    const ratingBonus = ratingAvg ? ratingAvg * 1.8 : 0;
    const socialScore = Math.log1p(likes) * 7 + Math.log1p(comments) * 8 + Math.log1p(reposts) * 10;

    const followingPenalty =
        followingSet.has(baseAuthorId) || followingSet.has(wrapperAuthorId) ? -10 : 0;
    const selfPenalty =
        me && (baseAuthorId === me.toString() || wrapperAuthorId === me.toString()) ? -18 : 0;
    const repostBonus = isRepost ? 2.5 : 0;
    const explorationNoise = hashToUnit(`${feedSeed}:${docId || baseId}`) * 24;
    const underdogBonus = likes + reposts + comments <= 2 ? hashToUnit(`new:${feedSeed}:${baseId || docId}`) * 8 : 0;

    return (
        recency +
        freshnessBonus +
        socialScore +
        ratingBonus +
        commentBonus +
        mediaBonus +
        interestBonus +
        followingPenalty +
        selfPenalty +
        repostBonus +
        explorationNoise +
        underdogBonus
    );
}

function diversifyForYouRankedDocs(rankedDocs: { doc: any; score: number }[], limit: number) {
    const picked: { doc: any; score: number }[] = [];
    const remaining = [...rankedDocs];
    const authorCounts = new Map<string, number>();
    const entityCounts = new Map<string, number>();

    while (picked.length < limit && remaining.length) {
        let bestIndex = 0;
        let bestAdjusted = -Infinity;

        remaining.forEach((item, index) => {
            const isRepost = item.doc.type === "repost" && item.doc.repostOf;
            const base = isRepost ? item.doc.repostOf : item.doc;
            const authorId = idString(base?.userId) || idString(item.doc?.userId);
            const entityKey =
                base?.entityType && base?.entityId
                    ? `${base.entityType}:${base.entityId}`
                    : `${base?.trackTitle || ""}:${base?.artist || ""}`.toLowerCase();
            const authorPenalty = (authorCounts.get(authorId) || 0) * 18;
            const entityPenalty = (entityCounts.get(entityKey) || 0) * 22;
            const adjusted = item.score - authorPenalty - entityPenalty;

            if (adjusted > bestAdjusted) {
                bestAdjusted = adjusted;
                bestIndex = index;
            }
        });

        const [next] = remaining.splice(bestIndex, 1);
        const isRepost = next.doc.type === "repost" && next.doc.repostOf;
        const base = isRepost ? next.doc.repostOf : next.doc;
        const authorId = idString(base?.userId) || idString(next.doc?.userId);
        const entityKey =
            base?.entityType && base?.entityId
                ? `${base.entityType}:${base.entityId}`
                : `${base?.trackTitle || ""}:${base?.artist || ""}`.toLowerCase();

        authorCounts.set(authorId, (authorCounts.get(authorId) || 0) + 1);
        entityCounts.set(entityKey, (entityCounts.get(entityKey) || 0) + 1);
        picked.push(next);
    }

    return picked;
}

function serializePost(p: any, me: mongoose.Types.ObjectId | null, feedScore?: number) {
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
            feedScore,

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
        feedScore,

        repostOf: null,
        repostedBy: null,
        repostComment: "",
    };
}

export async function GET(req: Request) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const limit = Math.min(Number(searchParams.get("limit") || 15), 50);
        const cursor = searchParams.get("cursor");
        const userId = searchParams.get("userId");
        const feed = searchParams.get("feed") === "following" ? "following" : "forYou";
        const sessionSeed = searchParams.get("seed");
        const excludedIds = feed === "forYou" ? parseObjectIdList(searchParams.get("exclude")) : [];
        const excludedSet = new Set(excludedIds.map((id) => id.toString()));

        const query: any = {};
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            query.userId = toObjectId(userId);
        }
        if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
            query._id = { $lt: toObjectId(cursor) };
        }
        if (excludedIds.length) {
            query._id = {
                ...(query._id || {}),
                $nin: excludedIds,
            };
        }

        const meId = await getOptionalUserId(req);

        const me =
            meId && mongoose.Types.ObjectId.isValid(meId)
                ? toObjectId(meId)
                : null;

        const meUser =
            me ? await User.findById(me).select("_id followingList pinnedTrack favoriteArtists favoriteAlbums favoriteTracks").lean() : null;

        const followingIds: mongoose.Types.ObjectId[] = Array.isArray((meUser as any)?.followingList)
            ? (meUser as any).followingList
                .filter((id: any) => mongoose.Types.ObjectId.isValid(id))
                .map((id: any) => toObjectId(id.toString()))
            : [];

        const followingSet: Set<string> = new Set(followingIds.map((id) => id.toString()));
        const interestTokens = getInterestTokens(meUser);
        const feedSeed = getFeedSeed(me, sessionSeed);

        if (feed === "following") {
            if (!me || followingIds.length === 0) {
                return NextResponse.json({ posts: [], nextCursor: null, feed }, { status: 200 });
            }
            query.userId = { $in: followingIds };
        }

        const fetchLimit = feed === "forYou" ? Math.min(Math.max(limit * 12, 120), 320) : limit + 1;

        const docs: any[] = await Post.find(query)
            .sort({ _id: -1 })
            .limit(fetchLimit)
            .populate("userId", "pseudo avatarUrl isPrivate")
            .populate("repostedBy", "pseudo avatarUrl isPrivate")
            .populate({
                path: "repostOf",
                populate: { path: "userId", select: "pseudo avatarUrl isPrivate" },
            })
            .lean();

        const visibleDocs = docs.filter((p: any) => {
            const isRepost = p.type === "repost" && p.repostOf;
            const docId = idString(p?._id);
            const repostOfId = idString(p?.repostOf?._id);
            if (excludedSet.has(docId) || (repostOfId && excludedSet.has(repostOfId))) return false;
            if (!isVisibleAuthor(p.userId, me, followingSet)) return false;
            if (isRepost && !isVisibleAuthor(p.repostOf?.userId, me, followingSet)) return false;
            return true;
        });

        const rankedDocs =
            feed === "forYou"
                ? visibleDocs
                    .map((doc) => ({
                        doc,
                        score: scoreForYouPost(doc, me, followingSet, interestTokens, feedSeed),
                    }))
                    .sort((a, b) => {
                        if (b.score !== a.score) return b.score - a.score;
                        return idString(b.doc._id).localeCompare(idString(a.doc._id));
                    })
                : visibleDocs.map((doc) => ({ doc, score: undefined }));

        const pageDocs =
            feed === "forYou"
                ? diversifyForYouRankedDocs(rankedDocs as { doc: any; score: number }[], limit)
                : rankedDocs.slice(0, limit);
        const nextCursor =
            docs.length === fetchLimit
                ? docs[docs.length - 1]?._id?.toString?.() ?? null
                : null;

        const posts = pageDocs.map(({ doc, score }) =>
            serializePost(doc, me, typeof score === "number" ? Number(score.toFixed(3)) : undefined)
        );

        return NextResponse.json({ posts, nextCursor, feed }, { status: 200 });
    } catch (err) {
        console.error("❌ GET /api/posts error:", err);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}
