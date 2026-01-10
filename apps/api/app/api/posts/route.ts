import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import mongoose from "mongoose";
import { verifyToken } from "@/lib/auth";

export async function GET(req: Request) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const limit = Math.min(Number(searchParams.get("limit") || 15), 50);
        const cursor = searchParams.get("cursor");
        const userId = searchParams.get("userId");

        const query: any = {};
        if (userId && mongoose.Types.ObjectId.isValid(userId)) query.userId = userId;
        if (cursor && mongoose.Types.ObjectId.isValid(cursor)) query._id = { $lt: cursor };

        // ✅ meId depuis middleware OU Authorization Bearer
        let meId: string | null = req.headers.get("x-user-id");
        if (!meId) meId = await verifyToken(req).catch(() => null);

        const me =
            meId && mongoose.Types.ObjectId.isValid(meId)
                ? new mongoose.Types.ObjectId(meId)
                : null;

        const docs: any[] = await Post.find(query)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate("userId", "pseudo avatarUrl") // auteur du doc (post normal OU reposter si repost)
            .populate("repostedBy", "pseudo avatarUrl") // reposter (badge)
            .populate({
                path: "repostOf",
                populate: { path: "userId", select: "pseudo avatarUrl" }, // auteur de l'original
            })
            .lean();

        let nextCursor: string | null = null;
        if (docs.length > limit) {
            const nextItem = docs.pop();
            nextCursor = nextItem?._id?.toString() ?? null;
        }

        const posts = docs.map((p: any) => {
            const isRepost = p.type === "repost" && p.repostOf;
            const base = isRepost ? p.repostOf : p;

            // ✅ stats/flags calculés sur le base post (original si repost)
            const likesArr = Array.isArray(base?.likes) ? base.likes : [];
            const repostsArr = Array.isArray(base?.reposts) ? base.reposts : [];

            const likedByMe = !!me && likesArr.some((id: any) => id?.toString?.() === me.toString());
            const repostedByMe = !!me && repostsArr.some((id: any) => id?.toString?.() === me.toString());

            const likesCount = typeof base?.likesCount === "number" ? base.likesCount : likesArr.length;
            const repostsCount = typeof base?.repostsCount === "number" ? base.repostsCount : repostsArr.length;
            const commentsCount = typeof base?.commentsCount === "number" ? base.commentsCount : 0;

            // ✅ baseFields = champs affichés dans PostCard (trackTitle, artist, coverUrl, etc.)
            // ⚠️ IMPORTANT: on enlève tout ce qui pourrait écraser l'identité du repost (et causer des keys dupliquées)
            const {
                _id: _baseId,
                userId: _baseUserId,
                createdAt: _baseCreatedAt,
                updatedAt: _baseUpdatedAt,
                type: _baseType,
                repostOf: _baseRepostOf,
                repostedBy: _baseRepostedBy,
                repostComment: _baseRepostComment,
                likes: _baseLikes,
                reposts: _baseReposts,
                likesCount: _baseLikesCount,
                repostsCount: _baseRepostsCount,
                commentsCount: _baseCommentsCount,
                ...baseFields
            } = base || {};

            // ✅ docFields = wrapper repost OU post normal (payload léger)
            const { likes: _l2, reposts: _r2, ...docFields } = p;

            return {
                ...docFields, // ✅ garde _id du doc (repost ou post)

                // ✅ si repost : on “injecte” le contenu du base sans casser l'identité du repost
                ...(isRepost ? baseFields : {}),

                // ✅ stats/flags toujours sur base post
                likesCount,
                repostsCount,
                commentsCount,
                likedByMe,
                repostedByMe,

                // ✅ infos de repost pour afficher "X a reposté"
                repostOf: isRepost ? p.repostOf : null,
                repostedBy: isRepost ? p.repostedBy : null,
                repostComment: isRepost ? (p.repostComment ?? "") : "",
            };
        });

        return NextResponse.json({ posts, nextCursor }, { status: 200 });
    } catch (err) {
        console.error("❌ GET /api/posts error:", err);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}