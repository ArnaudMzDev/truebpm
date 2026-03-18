import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import FollowRequest from "@/models/FollowRequest";

export async function GET(req: Request) {
    try {
        await connectDB();

        const meId = await requireUserId(req);
        if (!meId) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        const requests = await FollowRequest.find({
            targetUserId: meId,
            status: "pending",
        })
            .sort({ createdAt: -1 })
            .populate("requesterId", "_id pseudo avatarUrl bio")
            .lean();

        return NextResponse.json({ requests }, { status: 200 });
    } catch (e) {
        console.error("❌ GET /api/follow/requests error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}