import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import Notification from "@/models/Notification";
import mongoose from "mongoose";

export async function GET(req: Request) {
    try {
        await connectDB();

        const meId = await requireUserId(req);
        if (!meId) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const limit = Math.min(Number(searchParams.get("limit") || 20), 50);
        const cursor = searchParams.get("cursor");

        const query: any = { recipientId: meId };
        if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
            query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
        }

        const items: any[] = await Notification.find(query)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate("actorId", "_id pseudo avatarUrl")
            .populate("postId", "_id trackTitle artist coverUrl")
            .populate("commentId", "_id text")
            .lean();

        let nextCursor: string | null = null;
        if (items.length > limit) {
            const next = items.pop();
            nextCursor = next?._id?.toString?.() ?? null;
        }

        const unreadCount = await Notification.countDocuments({
            recipientId: meId,
            isRead: false,
        });

        return NextResponse.json(
            {
                notifications: items,
                nextCursor,
                unreadCount,
            },
            { status: 200 }
        );
    } catch (e) {
        console.error("GET /api/notifications error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}