import "@/lib/loadModels";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db";
import { getOptionalUserId, requireUserId } from "@/lib/requestAuth";

import Post from "@/models/Post";
import Comment from "@/models/Comment";
import User from "@/models/User";

export async function GET(req: Request, { params }: { params: { postId: string } }) {
    try {
        await connectDB();

        const { postId } = params;
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return NextResponse.json({ error: "postId invalide." }, { status: 400 });
        }
        const meId = await getOptionalUserId(req);
        const me =
            meId && mongoose.Types.ObjectId.isValid(meId)
                ? new mongoose.Types.ObjectId(meId)
                : null;

        const post: any = await Post.findById(postId)
            .populate("userId", "pseudo avatarUrl")
            .populate("repostedBy", "pseudo avatarUrl")
            .populate({
                path: "repostOf",
                populate: { path: "userId", select: "pseudo avatarUrl" },
            })
            .lean();

        if (!post) {
            return NextResponse.json({ error: "Post introuvable." }, { status: 404 });
        }

        const base = post.type === "repost" && post.repostOf ? post.repostOf : post;

        const likesArr = Array.isArray(base.likes) ? base.likes : [];
        const repostsArr = Array.isArray(base.reposts) ? base.reposts : [];

        const likedByMe = !!me && likesArr.some((id: any) => id?.toString?.() === me.toString());
        const repostedByMe = !!me && repostsArr.some((id: any) => id?.toString?.() === me.toString());

        return NextResponse.json(
            {
                post: {
                    ...post,
                    likesCount: likesArr.length,
                    repostsCount: repostsArr.length,
                    commentsCount: Math.max(0, Number(base?.commentsCount || 0)),
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

export async function DELETE(req: Request, { params }: { params: { postId: string } }) {
    try {
        await connectDB();

        const { postId } = params;
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return NextResponse.json({ error: "postId invalide." }, { status: 400 });
        }

        const meId = await requireUserId(req);
        if (!meId || !mongoose.Types.ObjectId.isValid(meId)) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        const me = new mongoose.Types.ObjectId(meId);

        const post: any = await Post.findById(postId)
            .select("_id userId type repostOf repostedBy")
            .lean();

        if (!post) {
            return NextResponse.json({ error: "Post introuvable." }, { status: 404 });
        }

        // Ici on ne supprime que les vrais posts.
        // Les reposts sont retirés via le toggle /repost.
        if (post.type === "repost") {
            return NextResponse.json(
                { error: "Utilise la route de toggle repost pour retirer un repost." },
                { status: 400 }
            );
        }

        if (post.userId?.toString?.() !== me.toString()) {
            return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
        }

        // 1) supprimer le post
        await Post.deleteOne({ _id: post._id });

        // 2) supprimer les reposts liés
        const repostDeletion = await Post.deleteMany({
            type: "repost",
            repostOf: post._id,
        });

        // 3) supprimer tous les commentaires liés
        const commentDeletion = await Comment.deleteMany({
            postId: post._id,
        });

        // 4) éviter notesCount négatif
        await User.updateOne(
            { _id: me, notesCount: { $gt: 0 } },
            { $inc: { notesCount: -1 } }
        );

        return NextResponse.json(
            {
                success: true,
                deletedId: postId,
                deletedReposts: repostDeletion?.deletedCount ?? 0,
                deletedComments: commentDeletion?.deletedCount ?? 0,
            },
            { status: 200 }
        );
    } catch (e) {
        console.error("❌ DELETE /api/posts/[postId] error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}