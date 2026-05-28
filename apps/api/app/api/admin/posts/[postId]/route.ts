import "@/lib/loadModels";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAdminRequest, writeAdminAuditLog } from "@/lib/adminAuth";
import { cleanText } from "@/lib/sanitize";
import Post from "@/models/Post";
import Comment from "@/models/Comment";
import Notification from "@/models/Notification";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request, { params }: { params: { postId: string } }) {
    const auth = requireAdminRequest(req, { csrf: true });
    if (auth.response) return auth.response;

    try {
        await connectDB();

        const { postId } = params;
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return NextResponse.json({ error: "postId invalide." }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const reason = cleanText(searchParams.get("reason") || "", 500);

        const post: any = await Post.findById(postId).select("_id type repostOf userId trackTitle artist").lean();
        if (!post) return NextResponse.json({ error: "Post introuvable." }, { status: 404 });

        let deletedReposts = 0;
        let deletedComments = 0;
        let deletedNotifications = 0;

        if (post.type === "repost") {
            await Post.deleteOne({ _id: post._id });
            if (post.repostOf) {
                await Post.updateOne(
                    { _id: post.repostOf },
                    {
                        $pull: { reposts: post.userId },
                        $inc: { repostsCount: -1 },
                    }
                );
            }
        } else {
            await Post.deleteOne({ _id: post._id });
            const repostDeletion = await Post.deleteMany({ type: "repost", repostOf: post._id });
            const commentDeletion = await Comment.deleteMany({ postId: post._id });
            const notificationDeletion = await Notification.deleteMany({ postId: post._id });
            deletedReposts = repostDeletion.deletedCount || 0;
            deletedComments = commentDeletion.deletedCount || 0;
            deletedNotifications = notificationDeletion.deletedCount || 0;
        }

        await writeAdminAuditLog({
            req,
            adminId: auth.session!.adminId,
            action: "post_delete",
            targetType: "post",
            targetId: postId,
            reason,
            metadata: {
                type: post.type,
                authorId: String(post.userId || ""),
                trackTitle: post.trackTitle || "",
                artist: post.artist || "",
                deletedReposts,
                deletedComments,
                deletedNotifications,
            },
        });

        return NextResponse.json({
            success: true,
            deletedId: postId,
            deletedReposts,
            deletedComments,
            deletedNotifications,
        });
    } catch (e) {
        console.error("DELETE /api/admin/posts/[postId] error:", e);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}
