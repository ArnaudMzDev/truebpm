import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import User from "@/models/User";
import mongoose from "mongoose";
import { getOptionalUserId } from "@/lib/requestAuth";

type TabType = "posts" | "reposts" | "likes";

function stripLikesReposts(obj: any) {
    if (!obj || typeof obj !== "object") return obj;
    const { likes, reposts, ...rest } = obj;
    return rest;
}

function enrichPost(doc: any, me: mongoose.Types.ObjectId | null) {
    const isRepost = doc.type === "repost" && doc.repostOf;
    const base = isRepost ? doc.repostOf : doc;

    const likesArr = Array.isArray(base?.likes) ? base.likes : [];
    const repostsArr = Array.isArray(base?.reposts) ? base.reposts : [];

    const likedByMe = !!me && likesArr.some((id: any) => id?.toString?.() === me.toString());
    const repostedByMe = !!me && repostsArr.some((id: any) => id?.toString?.() === me.toString());

    const likesCount = likesArr.length;
    const repostsCount = repostsArr.length;
    const commentsCount = Math.max(0, Number(base?.commentsCount || 0));

    if (isRepost) {
        const wrapper = stripLikesReposts(doc);
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

    const rest = stripLikesReposts(doc);
    return {
        ...rest,
        likesCount,
        repostsCount,
        commentsCount,
        likedByMe,
        repostedByMe,
    };
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        await connectDB();

        const meId = await getOptionalUserId(req);
        const userId = params.id;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return NextResponse.json({ error: "ID utilisateur invalide." }, { status: 400 });
        }

        const exists = await User.exists({ _id: userId });
        if (!exists) {
            return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
        }

        const { searchParams } = new URL(req.url);
        const limitParam = searchParams.get("limit");
        const cursorParam = searchParams.get("cursor");
        const tabParam = (searchParams.get("tab") || "posts") as TabType;

        const tab: TabType = ["posts", "reposts", "likes"].includes(tabParam) ? tabParam : "posts";
        const limit = Math.min(Number(limitParam) || 15, 50);

        const me =
            meId && mongoose.Types.ObjectId.isValid(meId)
                ? new mongoose.Types.ObjectId(meId)
                : null;

        // ------------------------------------------------------------
        // POSTS
        // ------------------------------------------------------------
        if (tab === "posts") {
            const query: any = {
                userId: new mongoose.Types.ObjectId(userId),
                type: "post",
            };

            if (cursorParam && mongoose.Types.ObjectId.isValid(cursorParam)) {
                query._id = { $lt: new mongoose.Types.ObjectId(cursorParam) };
            }

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

            const posts = docs.map((doc) => enrichPost(doc, me));
            return NextResponse.json({ posts, nextCursor }, { status: 200 });
        }

        // ------------------------------------------------------------
        // REPOSTS
        // ------------------------------------------------------------
        if (tab === "reposts") {
            const query: any = {
                type: "repost",
                repostedBy: new mongoose.Types.ObjectId(userId),
            };

            if (cursorParam && mongoose.Types.ObjectId.isValid(cursorParam)) {
                query._id = { $lt: new mongoose.Types.ObjectId(cursorParam) };
            }

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

            const posts = docs.map((doc) => enrichPost(doc, me));
            return NextResponse.json({ posts, nextCursor }, { status: 200 });
        }

        // ------------------------------------------------------------
        // LIKES
        // ------------------------------------------------------------
        const query: any = {
            type: "post",
            likes: new mongoose.Types.ObjectId(userId),
        };

        if (cursorParam && mongoose.Types.ObjectId.isValid(cursorParam)) {
            query._id = { $lt: new mongoose.Types.ObjectId(cursorParam) };
        }

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

        const posts = docs.map((doc) => enrichPost(doc, me));
        return NextResponse.json({ posts, nextCursor }, { status: 200 });
    } catch (err) {
        console.error("❌ GET /posts/user/[id] error:", err);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}