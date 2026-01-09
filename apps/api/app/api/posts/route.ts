// apps/api/app/api/posts/route.ts
import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import mongoose from "mongoose";

/* -------------------- GET /api/posts -------------------- */
export async function GET(req: Request) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);

        const limitParam = searchParams.get("limit");
        const cursor = searchParams.get("cursor");
        const userId = searchParams.get("userId");

        const limit = Math.min(Number(limitParam) || 15, 50);

        const query: any = {};

        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            query.userId = userId;
        }

        if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
            query._id = { $lt: cursor };
        }

        // ✅ IMPORTANT : on récupère le "me" injecté par le middleware
        const meId = req.headers.get("x-user-id");
        const me =
            meId && mongoose.Types.ObjectId.isValid(meId)
                ? new mongoose.Types.ObjectId(meId)
                : null;

        const docs: any[] = await Post.find(query)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate("userId", "pseudo avatarUrl")
            .lean();

        let nextCursor: string | null = null;

        if (docs.length > limit) {
            const nextItem = docs.pop();
            nextCursor = nextItem?._id?.toString() ?? null;
        }

        // ✅ Ajout likedByMe / repostedByMe + counts FIABLES (arrays = source de vérité)
        const posts = docs.map((p) => {
            const likesArr = Array.isArray(p.likes) ? p.likes : [];
            const repostsArr = Array.isArray(p.reposts) ? p.reposts : [];

            const likedByMe =
                !!me && likesArr.some((id: any) => id?.toString?.() === me.toString());

            const repostedByMe =
                !!me && repostsArr.some((id: any) => id?.toString?.() === me.toString());

            // ✅ FIX: toujours basé sur la longueur des arrays (évite likesCount incohérent)
            const likesCount = likesArr.length;
            const repostsCount = repostsArr.length;

            const commentsCount = typeof p.commentsCount === "number" ? p.commentsCount : 0;

            // ✅ optionnel : on vire likes/reposts du payload (plus léger)
            const { likes, reposts, ...rest } = p;

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
        console.error("❌ GET /api/posts error:", err);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}