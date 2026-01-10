import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import mongoose from "mongoose";
import { verifyToken } from "@/lib/auth";
import Conversation from "@/models/Conversation";

function buildKey(a: string, b: string) {
    const [x, y] = [a.toString(), b.toString()].sort();
    return `${x}_${y}`;
}

export async function GET(req: Request) {
    try {
        await connectDB();

        const meId = await verifyToken(req);
        if (!meId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

        const me = new mongoose.Types.ObjectId(meId);

        const conversations = await Conversation.find({ participants: me })
            .sort({ lastMessageAt: -1, updatedAt: -1 })
            .limit(50)
            .populate("participants", "pseudo avatarUrl")
            .lean();

        return NextResponse.json({ conversations }, { status: 200 });
    } catch (e) {
        console.error("❌ GET /api/conversations error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await connectDB();

        const meId = await verifyToken(req);
        if (!meId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

        const body = await req.json().catch(() => null);
        const targetUserId = body?.targetUserId;

        if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
            return NextResponse.json({ error: "targetUserId invalide." }, { status: 400 });
        }

        if (targetUserId.toString() === meId.toString()) {
            return NextResponse.json({ error: "Impossible de se DM soi-même." }, { status: 400 });
        }

        const key = buildKey(meId, targetUserId);

        // ✅ find or create
        let convo = await Conversation.findOne({ participantsKey: key })
            .populate("participants", "pseudo avatarUrl")
            .lean();

        if (!convo) {
            const created = await Conversation.create({
                participants: [meId, targetUserId],
                participantsKey: key,
                lastMessageAt: null,
                lastMessageText: "",
                lastMessageType: "text",
                lastMessagePostId: null,
            });

            convo = await Conversation.findById(created._id)
                .populate("participants", "pseudo avatarUrl")
                .lean();
        }

        return NextResponse.json({ conversation: convo }, { status: 200 });
    } catch (e) {
        console.error("❌ POST /api/conversations error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}