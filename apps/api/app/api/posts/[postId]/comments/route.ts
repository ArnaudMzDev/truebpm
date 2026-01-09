// apps/api/app/api/posts/[postId]/comments/route.ts
import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Comment from "@/models/Comment";
import Post from "@/models/Post";
import mongoose from "mongoose";

export async function GET(req: Request, { params }: { params: { postId: string } }) {
    try {
        await connectDB();

        const { postId } = params;
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return NextResponse.json({ error: "postId invalide." }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const limit = Math.min(Number(searchParams.get("limit") || 30), 50);
        const cursor = searchParams.get("cursor");

        const query: any = { postId, parentId: null };
        if (cursor && mongoose.Types.ObjectId.isValid(cursor)) query._id = { $lt: cursor };

        // ✅ "me" si dispo (middleware peut injecter x-user-id si Bearer présent)
        const meId = req.headers.get("x-user-id");
        const me =
            meId && mongoose.Types.ObjectId.isValid(meId) ? new mongoose.Types.ObjectId(meId) : null;

        const items: any[] = await Comment.find(query)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate("userId", "pseudo avatarUrl")
            .lean();

        let nextCursor: string | null = null;
        if (items.length > limit) {
            const next = items.pop();
            nextCursor = next?._id?.toString() ?? null;
        }

        const comments = items.map((c: any) => {
            const likesArr = Array.isArray(c.likes) ? c.likes : [];
            const likedByMe = !!me && likesArr.some((id: any) => id?.toString?.() === me.toString());

            const likesCount = typeof c.likesCount === "number" ? c.likesCount : likesArr.length;

            const { likes, ...rest } = c;
            return { ...rest, likesCount, likedByMe };
        });

        return NextResponse.json({ comments, nextCursor }, { status: 200 });
    } catch (e) {
        console.error("❌ GET /api/posts/[postId]/comments error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}

export async function POST(req: Request, { params }: { params: { postId: string } }) {
    try {
        await connectDB();

        const meId = req.headers.get("x-user-id");
        if (!meId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

        const { postId } = params;
        if (!mongoose.Types.ObjectId.isValid(postId) || !mongoose.Types.ObjectId.isValid(meId)) {
            return NextResponse.json({ error: "ID invalide." }, { status: 400 });
        }

        const body = await req.json().catch(() => null);
        const text = typeof body?.text === "string" ? body.text.trim() : "";
        if (!text) return NextResponse.json({ error: "Commentaire vide." }, { status: 400 });

        const exists = await Post.exists({ _id: postId });
        if (!exists) return NextResponse.json({ error: "Post introuvable." }, { status: 404 });

        // 1) create
        const created = await Comment.create({
            postId,
            userId: meId,
            text,
            parentId: null,
            rootId: null, // set après
            depth: 0,
            replyToUserId: null,
        });

        // 2) set rootId to self (important threads)
        await Comment.updateOne({ _id: created._id }, { $set: { rootId: created._id, depth: 0 } });

        // increment post count
        await Post.updateOne({ _id: postId }, { $inc: { commentsCount: 1 } });

        // repopulate
        const populated: any = await Comment.findById(created._id)
            .populate("userId", "pseudo avatarUrl")
            .lean();

        const { likes, ...rest } = populated || {};

        return NextResponse.json(
            {
                success: true,
                comment: {
                    ...rest,
                    likesCount: typeof populated?.likesCount === "number" ? populated.likesCount : 0,
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