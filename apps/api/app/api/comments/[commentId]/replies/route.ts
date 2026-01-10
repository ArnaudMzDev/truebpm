// apps/api/app/api/comments/[commentId]/replies/route.ts
import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Comment from "@/models/Comment";
import Post from "@/models/Post";
import mongoose from "mongoose";

/**
 * GET /api/comments/:commentId/replies?limit=10&cursor=<objectId>
 * -> renvoie UNIQUEMENT les réponses DIRECTES (parentId = commentId)
 * Tri ASC (ancien -> récent)
 */
export async function GET(req: Request, { params }: { params: { commentId: string } }) {
    try {
        await connectDB();

        const { commentId } = params;
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            return NextResponse.json({ error: "commentId invalide." }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const limit = Math.min(Number(searchParams.get("limit") || 10), 50);
        const cursor = searchParams.get("cursor");

        // ✅ "me" optionnel si token présent (middleware injecte x-user-id)
        const meId = req.headers.get("x-user-id");
        const me =
            meId && mongoose.Types.ObjectId.isValid(meId) ? new mongoose.Types.ObjectId(meId) : null;

        const query: any = { parentId: commentId };

        // Pagination ASC: on charge "après" un cursor
        if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
            query._id = { $gt: cursor };
        }

        const items: any[] = await Comment.find(query)
            .sort({ _id: 1 }) // ✅ ancien -> récent
            .limit(limit + 1)
            .populate("userId", "pseudo avatarUrl")
            .populate("replyToUserId", "pseudo")
            .lean();

        // ✅ nextCursor = DERNIER ÉLÉMENT RETOURNÉ (pas l'extra)
        let nextCursor: string | null = null;
        const hasMore = items.length > limit;

        const slice = hasMore ? items.slice(0, limit) : items;
        if (hasMore && slice.length > 0) {
            nextCursor = slice[slice.length - 1]?._id?.toString?.() ?? null;
        }

        const replies = slice.map((c: any) => {
            const likesArr = Array.isArray(c.likes) ? c.likes : [];
            const likedByMe = !!me && likesArr.some((id: any) => id?.toString?.() === me.toString());

            const likesCount = typeof c.likesCount === "number" ? c.likesCount : likesArr.length;

            // on enlève le tableau likes (lourd)
            const { likes, ...rest } = c;

            // rest contient déjà directRepliesCount, repliesCount, rootId, depth, etc.
            return { ...rest, likesCount, likedByMe };
        });

        return NextResponse.json({ replies, nextCursor }, { status: 200 });
    } catch (e) {
        console.error("❌ GET /api/comments/[commentId]/replies error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}

/**
 * POST /api/comments/:commentId/replies
 * -> crée une réponse à CE commentaire (qu'il soit racine ou reply)
 */
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

        // ✅ compteurs
        await Comment.updateOne({ _id: parent._id }, { $inc: { directRepliesCount: 1 } });
        await Comment.updateOne({ _id: rootId }, { $inc: { repliesCount: 1 } });
        await Post.updateOne({ _id: parent.postId }, { $inc: { commentsCount: 1 } });

        const populated: any = await Comment.findById(created._id)
            .populate("userId", "pseudo avatarUrl")
            .populate("replyToUserId", "pseudo")
            .lean();

        const likesArr = Array.isArray(populated?.likes) ? populated.likes : [];
        const { likes, ...rest } = populated || {};

        return NextResponse.json(
            {
                success: true,
                reply: {
                    ...rest,
                    // ✅ important pour UI
                    likesCount: typeof populated?.likesCount === "number" ? populated.likesCount : likesArr.length,
                    likedByMe: false,
                    directRepliesCount: typeof rest?.directRepliesCount === "number" ? rest.directRepliesCount : 0,
                    repliesCount: typeof rest?.repliesCount === "number" ? rest.repliesCount : 0,
                },
            },
            { status: 201 }
        );
    } catch (e) {
        console.error("❌ POST /api/comments/[commentId]/replies error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}