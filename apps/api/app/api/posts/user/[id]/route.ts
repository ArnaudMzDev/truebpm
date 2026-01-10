import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import User from "@/models/User";
import mongoose from "mongoose";
import { verifyToken } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        await connectDB();

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
        const limit = Math.min(Number(limitParam) || 15, 50);

        const query: any = { userId: new mongoose.Types.ObjectId(userId) };
        if (cursorParam && mongoose.Types.ObjectId.isValid(cursorParam)) {
            query._id = { $lt: new mongoose.Types.ObjectId(cursorParam) };
        }

        // ✅ me : middleware x-user-id OU fallback Authorization Bearer via verifyToken
        let meId = req.headers.get("x-user-id");
        if (!meId) {
            // verifyToken doit renvoyer l'id (string) ou null
            meId = await verifyToken(req).catch(() => null);
        }

        const me =
            meId && mongoose.Types.ObjectId.isValid(meId)
                ? new mongoose.Types.ObjectId(meId)
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

            // ✅ base = original si repost, sinon lui-même
            const base = isRepost ? p.repostOf : p;

            const likesArr = Array.isArray(base?.likes) ? base.likes : [];
            const repostsArr = Array.isArray(base?.reposts) ? base.reposts : [];

            const likedByMe = !!me && likesArr.some((id: any) => id?.toString?.() === me.toString());
            const repostedByMe = !!me && repostsArr.some((id: any) => id?.toString?.() === me.toString());

            const likesCount = typeof base?.likesCount === "number" ? base.likesCount : likesArr.length;
            const repostsCount = typeof base?.repostsCount === "number" ? base.repostsCount : repostsArr.length;
            const commentsCount = typeof base?.commentsCount === "number" ? base.commentsCount : 0;

            if (isRepost) {
                // wrapper sans arrays
                const wrapper = stripLikesReposts(p);

                // original sans arrays
                const cleanBase = stripLikesReposts(base);

                return {
                    ...wrapper,

                    // ✅ on garde l’original pour l’UI (badge + auteur original)
                    repostOf: cleanBase,

                    // ✅ flags & counts (TOUJOURS au top-level pour ActionsBar)
                    likesCount,
                    repostsCount,
                    commentsCount,
                    likedByMe,
                    repostedByMe,
                };
            }

            // post normal
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

        return NextResponse.json({ posts, nextCursor }, { status: 200 });
    } catch (err) {
        console.error("❌ GET /posts/user/[id] error:", err);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}