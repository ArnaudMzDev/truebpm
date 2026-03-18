import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import User from "@/models/User";
import mongoose from "mongoose";
import { getOptionalUserId } from "@/lib/requestAuth";

type Tab = "posts" | "reposts" | "likes";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        await connectDB();

        const viewerId = await getOptionalUserId(req);
        const targetUserId = params.id;

        if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
            return NextResponse.json({ error: "ID utilisateur invalide." }, { status: 400 });
        }

        const targetUser: any = await User.findById(targetUserId)
            .select("_id isPrivate followersList")
            .lean();

        if (!targetUser) {
            return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
        }

        const isSelf =
            !!viewerId && String(viewerId) === String(targetUserId);

        const isFollowing =
            !!viewerId &&
            Array.isArray(targetUser.followersList) &&
            targetUser.followersList.some((id: any) => String(id) === String(viewerId));

        const isPrivateLocked =
            !!targetUser.isPrivate && !isSelf && !isFollowing;

        const { searchParams } = new URL(req.url);
        const tab = (searchParams.get("tab") || "posts") as Tab;
        const limit = Math.min(Number(searchParams.get("limit") || 15), 50);
        const cursor = searchParams.get("cursor");

        if (isPrivateLocked) {
            return NextResponse.json(
                {
                    posts: [],
                    nextCursor: null,
                    isPrivateLocked: true,
                },
                { status: 200 }
            );
        }

        const query: any = {};

        if (tab === "posts") {
            query.userId = new mongoose.Types.ObjectId(targetUserId);
            query.type = "post";
        } else if (tab === "reposts") {
            query.userId = new mongoose.Types.ObjectId(targetUserId);
            query.type = "repost";
        } else {
            query.likes = new mongoose.Types.ObjectId(targetUserId);
            query.type = "post";
        }

        if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
            query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
        }

        const me =
            viewerId && mongoose.Types.ObjectId.isValid(viewerId)
                ? new mongoose.Types.ObjectId(viewerId)
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
            nextCursor = nextItem?._id?.toString() ?? null;
        }

        const stripLikesReposts = (obj: any) => {
            if (!obj || typeof obj !== "object") return obj;
            const { likes, reposts, ...rest } = obj;
            return rest;
        };

        const posts = docs.map((p: any) => {
            const isRepost = p.type === "repost" && p.repostOf;
            const base = isRepost ? p.repostOf : p;

            const likesArr = Array.isArray(base?.likes) ? base.likes : [];
            const repostsArr = Array.isArray(base?.reposts) ? base.reposts : [];

            const likedByMe = !!me && likesArr.some((id: any) => id?.toString?.() === me.toString());
            const repostedByMe = !!me && repostsArr.some((id: any) => id?.toString?.() === me.toString());

            const likesCount = likesArr.length;
            const repostsCount = repostsArr.length;
            const commentsCount = Math.max(0, Number(base?.commentsCount || 0));

            if (isRepost) {
                const wrapper = stripLikesReposts(p);
                const cleanBase = stripLikesReposts(base);

                return {
                    ...wrapper,
                    repostOf: cleanBase,
                    likesCount,
                    repostsCount,
                    commentsCount,
                    likedByMe,
                    repostedByMe,
                };
            }

            const rest = stripLikesReposts(p);
            return {
                ...rest,
                likesCount,
                repostsCount,
                commentsCount,
                likedByMe,
                repostedByMe,
            };
        });

        return NextResponse.json(
            {
                posts,
                nextCursor,
                isPrivateLocked: false,
            },
            { status: 200 }
        );
    } catch (err) {
        console.error("❌ GET /api/posts/user/[id] error:", err);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}