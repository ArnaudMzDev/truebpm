// apps/api/app/api/posts/[postId]/route.ts
import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import mongoose from "mongoose";
import { verifyToken } from "@/lib/auth";
import Comment from "@/models/Comment"; // ✅ pour cleanup des commentaires

export async function GET(req: Request, { params }: { params: { postId: string } }) {
    try {
        await connectDB();

        const { postId } = params;
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return NextResponse.json({ error: "postId invalide." }, { status: 400 });
        }

        // ✅ meId depuis middleware OU depuis Authorization Bearer
        let meId: string | null = req.headers.get("x-user-id");
        if (!meId) {
            meId = await verifyToken(req).catch(() => null);
        }

        const me =
            meId && mongoose.Types.ObjectId.isValid(meId) ? new mongoose.Types.ObjectId(meId) : null;

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

        // ✅ stats/flags basés sur l’original si c’est un repost
        const base = post.type === "repost" && post.repostOf ? post.repostOf : post;

        const likesArr = Array.isArray(base.likes) ? base.likes : [];
        const repostsArr = Array.isArray(base.reposts) ? base.reposts : [];

        const likedByMe = !!me && likesArr.some((id: any) => id?.toString?.() === me.toString());
        const repostedByMe = !!me && repostsArr.some((id: any) => id?.toString?.() === me.toString());

        return NextResponse.json(
            {
                post: {
                    ...post,
                    likesCount: typeof base.likesCount === "number" ? base.likesCount : likesArr.length,
                    repostsCount: typeof base.repostsCount === "number" ? base.repostsCount : repostsArr.length,
                    commentsCount: typeof base.commentsCount === "number" ? base.commentsCount : 0,
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

/**
 * DELETE /api/posts/:postId
 * - si post normal: seul l'auteur peut supprimer
 *   -> supprime aussi tous les reposts qui pointent dessus + commentaires liés
 * - si repost: seul le reposter peut supprimer
 *   -> supprime le wrapper repost + retire le reposter du post original (reposts + repostsCount)
 */
// apps/api/app/api/posts/[postId]/route.ts
import User from "@/models/User"; // ✅ ajoute cet import
// (le reste de tes imports est déjà OK)

export async function DELETE(req: Request, { params }: { params: { postId: string } }) {
    try {
        await connectDB();

        const { postId } = params;
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return NextResponse.json({ error: "postId invalide." }, { status: 400 });
        }

        const meId = await verifyToken(req).catch(() => null);
        if (!meId || !mongoose.Types.ObjectId.isValid(meId)) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        const me = new mongoose.Types.ObjectId(meId);

        const post: any = await Post.findById(postId).select("_id userId type").lean();
        if (!post) {
            return NextResponse.json({ error: "Post introuvable." }, { status: 404 });
        }

        // ✅ on ne supprime que des posts normaux (pas les reposts)
        if (post.type === "repost") {
            return NextResponse.json({ error: "Impossible de supprimer un repost ici." }, { status: 400 });
        }

        // ✅ ownership
        if (post.userId?.toString?.() !== me.toString()) {
            return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
        }

        // 1) supprimer le post
        await Post.deleteOne({ _id: post._id });

        // 2) supprimer tous les reposts qui pointent vers ce post
        const r = await Post.deleteMany({ type: "repost", repostOf: post._id });

        // 3) (optionnel mais recommandé) décrémenter notesCount
        await User.updateOne({ _id: me }, { $inc: { notesCount: -1 } });

        return NextResponse.json(
            {
                success: true,
                deletedId: postId,
                deletedReposts: r?.deletedCount ?? 0,
            },
            { status: 200 }
        );
    } catch (e) {
        console.error("❌ DELETE /api/posts/[postId] error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}