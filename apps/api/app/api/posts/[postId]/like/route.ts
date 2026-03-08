import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import mongoose from "mongoose";
import { requireUserId } from "@/lib/requestAuth";
import { createNotification } from "@/lib/notifications";

export async function POST(req: Request, { params }: { params: { postId: string } }) {
    try {
        await connectDB();

        const meId = await requireUserId(req);
        if (!meId) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        const { postId } = params;
        if (!mongoose.Types.ObjectId.isValid(postId) || !mongoose.Types.ObjectId.isValid(meId)) {
            return NextResponse.json({ error: "ID invalide." }, { status: 400 });
        }

        const me = new mongoose.Types.ObjectId(meId);

        // ⚠️ IMPORTANT: on a besoin de type + repostOf pour savoir si on like un repost ou un post normal
        const post: any = await Post.findById(postId).select("type repostOf").lean();
        if (!post) return NextResponse.json({ error: "Post introuvable." }, { status: 404 });

        const baseId =
            post?.type === "repost" && post?.repostOf ? String(post.repostOf) : String(postId);

        // On like/unlike TOUJOURS sur le base post
        const base: any = await Post.findById(baseId).select("likes likesCount").lean();
        if (!base) return NextResponse.json({ error: "Post introuvable." }, { status: 404 });

        const likesArr = Array.isArray(base.likes) ? base.likes : [];
        const already = likesArr.some((id: any) => id?.toString?.() === me.toString());

        if (already) {
            await Post.updateOne(
                { _id: baseId },
                { $pull: { likes: me }, $inc: { likesCount: -1 } }
            );
        } else {
            await Post.updateOne(
                { _id: baseId },
                { $addToSet: { likes: me }, $inc: { likesCount: 1 } }
            );
        }

        // ✅ Re-fetch pour renvoyer une vérité serveur (et éviter les compteurs négatifs/incohérents)
        const fresh: any = await Post.findById(baseId).select("likes").lean();
        const freshArr = Array.isArray(fresh?.likes) ? fresh.likes : [];

        const likedByMe = freshArr.some((id: any) => id?.toString?.() === me.toString());
        const likesCount = freshArr.length;

        // ✅ Optionnel mais conseillé: remettre likesCount exactement au length pour être 100% cohérent
        // (si tu veux éviter toute dérive suite à des anciens bugs)
        await Post.updateOne({ _id: baseId }, { $set: { likesCount } });

        const baseOwner: any = await Post.findById(baseId).select("userId").lean();

        if (likedByMe && baseOwner?.userId) {
            await createNotification({
                recipientId: String(baseOwner.userId),
                actorId: String(me),
                type: "like_post",
                postId: String(baseId),
            });
        }

        return NextResponse.json(
            { status: likedByMe ? "liked" : "unliked", likesCount, likedByMe },
            { status: 200 }
        );
    } catch (e) {
        console.error("❌ POST /api/posts/[postId]/like error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}