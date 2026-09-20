import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Comment from "@/models/Comment";
import Post from "@/models/Post";
import mongoose from "mongoose";
import { getOptionalUserId, requireUserId } from "@/lib/requestAuth";
import { createNotification } from "@/lib/notifications";
import { cleanMultilineText } from "@/lib/sanitize";
import { pageResponse, paginateSlice, parsePagination } from "@/lib/pagination";

export const dynamic = "force-dynamic";

/**
 * GET /api/comments/:commentId/replies?limit=10&cursor=<objectId>
 * -> renvoie UNIQUEMENT les réponses directes (parentId = commentId)
 * Tri ASC (ancien -> récent)
 */
export async function GET(req: Request, { params }: { params: { commentId: string } }) {
    try {
        await connectDB();

        const { commentId } = params;
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            return NextResponse.json({ error: "commentId invalide." }, { status: 400 });
        }

        const meId = await getOptionalUserId(req);
        const me =
            meId && mongoose.Types.ObjectId.isValid(meId)
                ? new mongoose.Types.ObjectId(meId)
                : null;

        const { searchParams } = new URL(req.url);
        const { limit, cursor, invalidCursor } = parsePagination(searchParams, {
            defaultLimit: 10,
            maxLimit: 50,
        });

        if (invalidCursor) {
            return NextResponse.json({ error: "Curseur invalide." }, { status: 400 });
        }

        const query: any = { parentId: commentId };

        if (cursor) {
            query._id = { $gt: cursor };
        }

        const items: any[] = await Comment.find(query)
            .sort({ _id: 1 })
            .limit(limit + 1)
            .populate("userId", "pseudo avatarUrl")
            .populate("replyToUserId", "pseudo")
            .lean();

        const page = paginateSlice(items, limit, (item: any) => item?._id?.toString?.());

        const replies = page.data.map((c: any) => {
            const likesArr = Array.isArray(c.likes) ? c.likes : [];
            const likedByMe = !!me && likesArr.some((id: any) => id?.toString?.() === me.toString());
            const likesCount = likesArr.length;

            const { likes, ...rest } = c;
            return { ...rest, likesCount, likedByMe };
        });

        return pageResponse({ replies }, { ...page.pageInfo, count: replies.length }, { status: 200 });
    } catch (e) {
        console.error("❌ GET /api/comments/[commentId]/replies error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}

/**
 * POST /api/comments/:commentId/replies
 * -> crée une réponse à CE commentaire (racine ou reply)
 */
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

        const parent: any = await Comment.findById(commentId).lean();
        if (!parent) {
            return NextResponse.json({ error: "Commentaire introuvable." }, { status: 404 });
        }

        const body = await req.json().catch(() => null);
        const text = cleanMultilineText(body?.text, 1000);
        if (!text) {
            return NextResponse.json({ error: "Réponse vide." }, { status: 400 });
        }

        const rootId = parent.rootId ? parent.rootId : parent._id;
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

        await Comment.updateOne(
            { _id: parent._id },
            { $inc: { directRepliesCount: 1 } }
        );

        await Comment.updateOne(
            { _id: rootId },
            { $inc: { repliesCount: 1 } }
        );

        await Post.updateOne(
            { _id: parent.postId },
            { $inc: { commentsCount: 1 } }
        );

        if (parent.userId && String(parent.userId) !== String(meId)) {
            await createNotification({
                recipientId: String(parent.userId),
                actorId: String(meId),
                type: "reply_comment",
                postId: String(parent.postId),
                commentId: String(parent._id),
            });
        }

        const populated: any = await Comment.findById(created._id)
            .populate("userId", "pseudo avatarUrl")
            .populate("replyToUserId", "pseudo")
            .lean();

        const { likes, ...rest } = populated || {};

        return NextResponse.json(
            {
                success: true,
                reply: {
                    ...rest,
                    likesCount: 0,
                    likedByMe: false,
                    directRepliesCount:
                        typeof rest?.directRepliesCount === "number" ? rest.directRepliesCount : 0,
                    repliesCount:
                        typeof rest?.repliesCount === "number" ? rest.repliesCount : 0,
                },
            },
            { status: 201 }
        );
    } catch (e) {
        console.error("❌ POST /api/comments/[commentId]/replies error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}
