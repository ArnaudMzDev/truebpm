import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Comment from "@/models/Comment";
import Post from "@/models/Post";
import mongoose from "mongoose";

export async function POST(req: Request, { params }: { params: { commentId: string } }) {
    try {
        await connectDB();

        const meId = req.headers.get("x-user-id");
        if (!meId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

        const { commentId } = params;
        if (!mongoose.Types.ObjectId.isValid(commentId) || !mongoose.Types.ObjectId.isValid(meId)) {
            return NextResponse.json({ error: "ID invalide." }, { status: 400 });
        }

        const parent: any = await Comment.findById(commentId).lean();
        if (!parent) return NextResponse.json({ error: "Commentaire introuvable." }, { status: 404 });

        const body = await req.json().catch(() => null);
        const text = typeof body?.text === "string" ? body.text.trim() : "";
        if (!text) return NextResponse.json({ error: "Réponse vide." }, { status: 400 });

        // ✅ rootId / depth
        const rootId = parent.rootId ? parent.rootId : parent._id;      // parent peut être racine ou reply
        const depth = (parent.depth || 0) + 1;

        const created = await Comment.create({
            postId: parent.postId,
            userId: meId,
            text,
            parentId: parent._id,
            rootId,
            depth,
            replyToUserId: parent.userId ?? null,
        });

        // ✅ compteurs
        await Comment.updateOne({ _id: parent._id }, { $inc: { directRepliesCount: 1 } });
        await Comment.updateOne({ _id: rootId }, { $inc: { repliesCount: 1 } });
        await Post.updateOne({ _id: parent.postId }, { $inc: { commentsCount: 1 } });

        const populated = await Comment.findById(created._id)
            .populate("userId", "pseudo avatarUrl")
            .populate("replyToUserId", "pseudo")
            .lean();

        return NextResponse.json({ success: true, reply: populated }, { status: 201 });
    } catch (e) {
        console.error("❌ POST reply error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}