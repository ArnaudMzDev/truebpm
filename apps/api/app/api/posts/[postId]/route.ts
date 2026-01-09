// apps/api/app/api/posts/[postId]/route.ts
import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import mongoose from "mongoose";

export async function GET(req: Request, { params }: { params: { postId: string } }) {
    try {
        await connectDB();

        const { postId } = params;
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return NextResponse.json({ error: "postId invalide." }, { status: 400 });
        }

        const meId = req.headers.get("x-user-id"); // optionnel
        const me = meId && mongoose.Types.ObjectId.isValid(meId) ? new mongoose.Types.ObjectId(meId) : null;

        const post: any = await Post.findById(postId)
            .populate("userId", "pseudo avatarUrl")
            .lean();

        if (!post) {
            return NextResponse.json({ error: "Post introuvable." }, { status: 404 });
        }

        const likedByMe = !!me && Array.isArray(post.likes) && post.likes.some((id: any) => id?.toString?.() === me.toString());
        const repostedByMe = !!me && Array.isArray(post.reposts) && post.reposts.some((id: any) => id?.toString?.() === me.toString());

        return NextResponse.json(
            {
                post: {
                    ...post,
                    likesCount: typeof post.likesCount === "number" ? post.likesCount : Array.isArray(post.likes) ? post.likes.length : 0,
                    repostsCount:
                        typeof post.repostsCount === "number" ? post.repostsCount : Array.isArray(post.reposts) ? post.reposts.length : 0,
                    commentsCount: typeof post.commentsCount === "number" ? post.commentsCount : 0,
                    likedByMe,
                    repostedByMe,
                },
            },
            { status: 200 }
        );
    } catch (e) {
        console.error("❌ GET /api/posts/[postId] error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}