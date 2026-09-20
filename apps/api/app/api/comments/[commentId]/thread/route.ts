export const dynamic = "force-dynamic";

// apps/api/app/api/comments/[commentId]/thread/route.ts
import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Comment from "@/models/Comment";
import mongoose from "mongoose";
import { getOptionalUserId } from "@/lib/requestAuth";
import { pageResponse, paginateSlice, parsePagination } from "@/lib/pagination";


export async function GET(req: Request, { params }: { params: { commentId: string } }) {
    try {
        await connectDB();

        const meId = await getOptionalUserId(req);

        const { commentId } = params;
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            return NextResponse.json({ error: "commentId invalide." }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const { limit, cursor, invalidCursor } = parsePagination(searchParams, {
            defaultLimit: 10,
            maxLimit: 50,
        });

        if (invalidCursor) {
            return NextResponse.json({ error: "Curseur invalide." }, { status: 400 });
        }

        const query: any = {
            rootId: commentId,
            parentId: { $ne: null }, // exclut le commentaire racine
        };

        if (cursor) {
            query._id = { $lt: cursor };
        }

        const me =
            meId && mongoose.Types.ObjectId.isValid(meId) ? new mongoose.Types.ObjectId(meId) : null;

        const items: any[] = await Comment.find(query)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate("userId", "pseudo avatarUrl")
            .populate("replyToUserId", "pseudo")
            .lean();

        const page = paginateSlice(items, limit, (item: any) => item?._id?.toString?.());

        // ✅ likedByMe + likesCount
        const replies = page.data.map((r: any) => {
            const likesArr = Array.isArray(r.likes) ? r.likes : [];
            const likedByMe = !!me && likesArr.some((id: any) => id?.toString?.() === me.toString());

            const likesCount =
                typeof r.likesCount === "number" ? r.likesCount : likesArr.length;

            const { likes, ...rest } = r;
            return { ...rest, likesCount, likedByMe };
        });

        return pageResponse({ replies }, { ...page.pageInfo, count: replies.length }, { status: 200 });
    } catch (e) {
        console.error("❌ GET thread error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}
