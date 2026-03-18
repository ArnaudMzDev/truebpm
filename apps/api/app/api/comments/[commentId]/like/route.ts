import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Comment from "@/models/Comment";
import mongoose from "mongoose";
import { requireUserId } from "@/lib/requestAuth";
import Notification from "@/models/Notification";
import { createNotification } from "@/lib/notifications";

export async function POST(req: Request, { params }: { params: { commentId: string } }) {
    try {
        await connectDB();

        const meId = await requireUserId(req);
        if (!meId) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        const { commentId } = params;
        if (!mongoose.Types.ObjectId.isValid(commentId) || !mongoose.Types.ObjectId.isValid(meId)) {
            return NextResponse.json({ error: "ID invalide." }, { status: 400 });
        }

        const me = new mongoose.Types.ObjectId(meId);

        const comment: any = await Comment.findById(commentId)
            .select("likes userId postId")
            .lean();

        if (!comment) {
            return NextResponse.json({ error: "Commentaire introuvable." }, { status: 404 });
        }

        const likesArr = Array.isArray(comment.likes) ? comment.likes : [];
        const already = likesArr.some((id: any) => id?.toString?.() === me.toString());

        if (already) {
            await Comment.updateOne(
                { _id: commentId },
                { $pull: { likes: me } }
            );

            await Notification.deleteOne({
                type: "like_comment",
                recipientId: comment.userId,
                actorId: me,
                commentId: comment._id,
            });
        } else {
            await Comment.updateOne(
                { _id: commentId },
                { $addToSet: { likes: me } }
            );

            if (String(comment.userId) !== String(meId)) {
                await createNotification({
                    recipientId: String(comment.userId),
                    actorId: String(meId),
                    type: "like_comment",
                    postId: String(comment.postId),
                    commentId: String(comment._id),
                });
            }
        }

        const fresh: any = await Comment.findById(commentId).select("likes").lean();
        const freshArr = Array.isArray(fresh?.likes) ? fresh.likes : [];

        const likedByMe = freshArr.some((id: any) => id?.toString?.() === me.toString());
        const likesCount = freshArr.length;

        await Comment.updateOne(
            { _id: commentId },
            { $set: { likesCount } }
        );

        return NextResponse.json(
            {
                status: likedByMe ? "liked" : "unliked",
                likesCount,
                likedByMe,
            },
            { status: 200 }
        );
    } catch (e) {
        console.error("❌ POST /api/comments/[commentId]/like error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}