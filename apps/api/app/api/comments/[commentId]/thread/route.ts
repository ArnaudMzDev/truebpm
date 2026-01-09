// apps/api/app/api/comments/[commentId]/thread/route.ts
import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Comment from "@/models/Comment";
import mongoose from "mongoose";

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

        const query: any = {
            rootId: commentId,
            parentId: { $ne: null }, // exclut le commentaire racine
        };

        if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
            query._id = { $lt: cursor };
        }

        // ✅ me optionnel (middleware injecte x-user-id si Bearer présent)
        const meId = req.headers.get("x-user-id");
        const me =
            meId && mongoose.Types.ObjectId.isValid(meId) ? new mongoose.Types.ObjectId(meId) : null;

        const items: any[] = await Comment.find(query)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate("userId", "pseudo avatarUrl")
            .populate("replyToUserId", "pseudo")
            .lean();

        let nextCursor: string | null = null;
        if (items.length > limit) {
            const next = items.pop();
            nextCursor = next?._id?.toString() ?? null;
        }

        // ✅ likedByMe + likesCount
        const replies = items.map((r: any) => {
            const likesArr = Array.isArray(r.likes) ? r.likes : [];
            const likedByMe = !!me && likesArr.some((id: any) => id?.toString?.() === me.toString());

            const likesCount =
                typeof r.likesCount === "number" ? r.likesCount : likesArr.length;

            const { likes, ...rest } = r;
            return { ...rest, likesCount, likedByMe };
        });

        return NextResponse.json({ replies, nextCursor }, { status: 200 });
    } catch (e) {
        console.error("❌ GET thread error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}