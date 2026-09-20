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

export async function GET(req: Request, { params }: { params: { postId: string } }) {
    try {
        await connectDB();

        const meId = await getOptionalUserId(req);

        const { postId } = params;
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return NextResponse.json({ error: "postId invalide." }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const { limit, cursor, invalidCursor } = parsePagination(searchParams, {
            defaultLimit: 30,
            maxLimit: 50,
        });

        if (invalidCursor) {
            return NextResponse.json({ error: "Curseur invalide." }, { status: 400 });
        }

        const query: any = { postId, parentId: null };
        if (cursor) {
            query._id = { $lt: cursor };
        }

        const me =
            meId && mongoose.Types.ObjectId.isValid(meId)
                ? new mongoose.Types.ObjectId(meId)
                : null;

        const items: any[] = await Comment.find(query)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate("userId", "pseudo avatarUrl")
            .lean();

        const page = paginateSlice(items, limit, (item: any) => item?._id?.toString?.());

        const comments = page.data.map((c: any) => {
            const likesArr = Array.isArray(c.likes) ? c.likes : [];
            const likedByMe = !!me && likesArr.some((id: any) => id?.toString?.() === me.toString());
            const likesCount = likesArr.length;

            const { likes, ...rest } = c;
            return { ...rest, likesCount, likedByMe };
        });

        return pageResponse({ comments }, { ...page.pageInfo, count: comments.length }, { status: 200 });
    } catch (e) {
        console.error("❌ GET /api/posts/[postId]/comments error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}

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

        const body = await req.json().catch(() => null);
        const text = cleanMultilineText(body?.text, 1000);
        if (!text) {
            return NextResponse.json({ error: "Commentaire vide." }, { status: 400 });
        }

        const postDoc: any = await Post.findById(postId).select("_id userId").lean();
        if (!postDoc) {
            return NextResponse.json({ error: "Post introuvable." }, { status: 404 });
        }

        const created = await Comment.create({
            postId,
            userId: meId,
            text,
            parentId: null,
            rootId: null,
            depth: 0,
            replyToUserId: null,
        });

        await Comment.updateOne(
            { _id: created._id },
            { $set: { rootId: created._id, depth: 0 } }
        );

        await Post.updateOne({ _id: postId }, { $inc: { commentsCount: 1 } });

        if (String(postDoc.userId) !== String(meId)) {
            await createNotification({
                recipientId: String(postDoc.userId),
                actorId: String(meId),
                type: "comment_post",
                postId: String(postId),
                commentId: String(created._id),
            });
        }

        const populated: any = await Comment.findById(created._id)
            .populate("userId", "pseudo avatarUrl")
            .lean();

        const { likes, ...rest } = populated || {};

        return NextResponse.json(
            {
                success: true,
                comment: {
                    ...rest,
                    likesCount: 0,
                    likedByMe: false,
                },
            },
            { status: 201 }
        );
    } catch (e) {
        console.error("❌ POST /api/posts/[postId]/comments error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}
