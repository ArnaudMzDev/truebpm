import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import Notification from "@/models/Notification";
import mongoose from "mongoose";
import { pageResponse, paginateSlice, parsePagination } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        await connectDB();

        const meId = await requireUserId(req);
        if (!meId) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const { limit, cursor, invalidCursor } = parsePagination(searchParams, {
            defaultLimit: 20,
            maxLimit: 50,
        });

        if (invalidCursor) {
            return NextResponse.json({ error: "Curseur invalide." }, { status: 400 });
        }

        const query: any = { recipientId: meId };
        if (cursor) {
            query._id = { $lt: cursor };
        }

        const items: any[] = await Notification.find(query)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate("actorId", "_id pseudo avatarUrl")
            .populate("postId", "_id trackTitle artist coverUrl")
            .populate("commentId", "_id text")
            .lean();

        const page = paginateSlice(items, limit, (item: any) => item?._id?.toString?.());

        const unreadCount = await Notification.countDocuments({
            recipientId: meId,
            isRead: false,
        });

        return pageResponse(
            {
                notifications: page.data,
                unreadCount,
            },
            { ...page.pageInfo, count: page.data.length },
            { status: 200 }
        );
    } catch (e) {
        console.error("GET /api/notifications error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}
