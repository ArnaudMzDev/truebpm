// apps/api/app/api/conversations/route.ts
import "@/lib/loadModels";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import User from "@/models/User";

function getReadAt(convo: any, userId: string): Date | null {
    const ra = convo?.readAt;
    if (!ra) return null;

    if (typeof ra?.get === "function") {
        const v = ra.get(userId);
        return v ? new Date(v) : null;
    }

    const v = ra?.[userId];
    return v ? new Date(v) : null;
}

function isObjectId(id: string) {
    return mongoose.Types.ObjectId.isValid(id);
}

export async function GET(req: Request) {
    try {
        await connectDB();

        const meId = await requireUserId(req);
        if (!meId) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        const meKey = String(meId);

        const convos = await Conversation.find({ participants: meId })
            .sort({ lastMessageAt: -1, updatedAt: -1 })
            .populate("participants", "_id pseudo avatarUrl")
            .lean();

        const enriched = await Promise.all(
            convos.map(async (c: any) => {
                const readAtMe = getReadAt(c, meKey);

                const other =
                    (c.participants || []).find((p: any) => String(p?._id) !== meKey) ??
                    (c.participants || [])[0] ??
                    null;

                const otherKey = other?._id ? String(other._id) : null;
                const readAtOther = otherKey ? getReadAt(c, otherKey) : null;

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

export async function POST(req: Request) {
    try {
        await connectDB();

        const meId = await requireUserId(req);
        if (!meId) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        const body = await req.json().catch(() => null);
        const otherUserId = body?.otherUserId as string | undefined;

        if (!otherUserId || !isObjectId(otherUserId)) {
            return NextResponse.json({ error: "otherUserId invalide." }, { status: 400 });
        }

        if (String(meId) === String(otherUserId)) {
            return NextResponse.json(
                { error: "Impossible de créer une conversation avec soi-même." },
                { status: 400 }
            );
        }

        const [meUser, otherUser] = await Promise.all([
            User.findById(meId).select("_id").lean(),
            User.findById(otherUserId).select("_id pseudo avatarUrl").lean(),
        ]);

        if (!meUser || !otherUser) {
            return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
        }

        const sorted = [String(meId), String(otherUserId)].sort();
        const participantsKey = `${sorted[0]}:${sorted[1]}`;

        let conversation: any = await Conversation.findOne({
            isGroup: false,
            participantsKey,
        })
            .populate("participants", "_id pseudo avatarUrl")
            .lean();

        if (!conversation) {
            const now = new Date();

            const created = await Conversation.create({
                isGroup: false,
                participants: [meId, otherUserId],
                participantsKey,
                readAt: {
                    [String(meId)]: now,
                    [String(otherUserId)]: now,
                },
            });

            conversation = await Conversation.findById(created._id)
                .populate("participants", "_id pseudo avatarUrl")
                .lean();
        }

        return NextResponse.json({ conversation }, { status: 200 });
    } catch (e: any) {
        if (e?.code === 11000) {
            try {
                const body = await req.json().catch(() => null);
                const otherUserId = body?.otherUserId as string | undefined;
                if (!otherUserId) {
                    return NextResponse.json({ error: "Conflit de création." }, { status: 409 });
                }

                const sorted = [String(await requireUserId(req)), String(otherUserId)].sort();
                const participantsKey = `${sorted[0]}:${sorted[1]}`;

                const conversation = await Conversation.findOne({
                    isGroup: false,
                    participantsKey,
                })
                    .populate("participants", "_id pseudo avatarUrl")
                    .lean();

                if (conversation) {
                    return NextResponse.json({ conversation }, { status: 200 });
                }
            } catch {}
        }

        console.error("POST /api/conversations error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}