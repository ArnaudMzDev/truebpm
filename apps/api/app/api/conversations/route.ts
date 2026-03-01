// apps/api/app/api/conversations/route.ts
import "@/lib/loadModels";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";

function getReadAt(convo: any, userId: string): Date | null {
    // Mongoose Map peut être sérialisée différemment selon lean()
    const ra = convo?.readAt;

    if (!ra) return null;

    // cas 1: vrai Map (rare avec lean, mais possible)
    if (typeof ra?.get === "function") {
        const v = ra.get(userId);
        return v ? new Date(v) : null;
    }

    // cas 2: objet simple { [userId]: date }
    const v = ra?.[userId];
    return v ? new Date(v) : null;
}

export async function GET(req: Request) {
    try {
        await connectDB();

        const meId = await verifyToken(req).catch(() => null);
        if (!meId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

        const meKey = String(meId);

        const convos = await Conversation.find({ participants: meId })
            .sort({ lastMessageAt: -1, updatedAt: -1 })
            .populate("participants", "_id pseudo avatarUrl")
            .lean();

        const enriched = await Promise.all(
            convos.map(async (c: any) => {
                const readAtMe = getReadAt(c, meKey);

                // DM: autre participant
                const other =
                    (c.participants || []).find((p: any) => String(p?._id) !== meKey) ??
                    (c.participants || [])[0] ??
                    null;

                const otherKey = other?._id ? String(other._id) : null;
                const readAtOther = otherKey ? getReadAt(c, otherKey) : null;

                // ✅ non lus: messages venant de l'autre, après ma dernière lecture
                const unreadCount = await Message.countDocuments({
                    conversationId: new mongoose.Types.ObjectId(String(c._id)),
                    senderId: { $ne: meId },
                    createdAt: { $gt: readAtMe || new Date(0) },
                });

                return {
                    ...c,
                    unreadCount,
                    readAtMe: readAtMe ? readAtMe.toISOString() : null,
                    readAtOther: readAtOther ? readAtOther.toISOString() : null,
                };
            })
        );

        return NextResponse.json({ conversations: enriched }, { status: 200 });
    } catch (e) {
        console.error("GET /api/conversations error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}