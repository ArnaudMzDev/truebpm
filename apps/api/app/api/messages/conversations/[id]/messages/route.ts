import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import mongoose from "mongoose";
import { verifyToken } from "@/lib/auth";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";

async function ensureParticipant(conversationId: string, meId: string) {
    const convo = await Conversation.findById(conversationId).select("participants").lean();
    if (!convo) return { ok: false as const, status: 404, error: "Conversation introuvable." };

    const participants = Array.isArray(convo.participants) ? convo.participants : [];
    const isIn = participants.some((id: any) => id?.toString?.() === meId.toString());
    if (!isIn) return { ok: false as const, status: 403, error: "Accès refusé." };

    return { ok: true as const };
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        await connectDB();

        const meId = await verifyToken(req);
        if (!meId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

        const conversationId = params.id;
        if (!mongoose.Types.ObjectId.isValid(conversationId)) {
            return NextResponse.json({ error: "conversationId invalide." }, { status: 400 });
        }

        const access = await ensureParticipant(conversationId, meId);
        if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

        const { searchParams } = new URL(req.url);
        const limit = Math.min(Number(searchParams.get("limit") || 30), 60);
        const cursor = searchParams.get("cursor");

        const q: any = { conversationId: new mongoose.Types.ObjectId(conversationId) };
        if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
            q._id = { $lt: new mongoose.Types.ObjectId(cursor) };
        }

        const docs: any[] = await Message.find(q)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate("senderId", "pseudo avatarUrl")
            .populate({
                path: "postId",
                select: "userId trackTitle artist coverUrl createdAt type repostOf repostedBy repostComment",
                populate: [
                    { path: "userId", select: "pseudo avatarUrl" },
                    { path: "repostedBy", select: "pseudo avatarUrl" },
                    { path: "repostOf", populate: { path: "userId", select: "pseudo avatarUrl" } },
                ],
            })
            .lean();

        let nextCursor: string | null = null;
        if (docs.length > limit) {
            const nextItem = docs.pop();
            nextCursor = nextItem?._id?.toString?.() ?? null;
        }

        // on renvoie du + récent au + ancien côté API,
        // et côté mobile tu peux inverser si tu veux.
        return NextResponse.json({ messages: docs, nextCursor }, { status: 200 });
    } catch (e) {
        console.error("❌ GET /api/conversations/[id]/messages error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        await connectDB();

        const meId = await verifyToken(req);
        if (!meId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

        const conversationId = params.id;
        if (!mongoose.Types.ObjectId.isValid(conversationId)) {
            return NextResponse.json({ error: "conversationId invalide." }, { status: 400 });
        }

        const access = await ensureParticipant(conversationId, meId);
        if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

        const body = await req.json().catch(() => null);
        const type = body?.type === "post" ? "post" : "text";

        let text = "";
        let postId: string | null = null;

        if (type === "text") {
            if (typeof body?.text !== "string") {
                return NextResponse.json({ error: "text requis." }, { status: 400 });
            }
            text = body.text.trim();
            if (!text) return NextResponse.json({ error: "Message vide." }, { status: 400 });
        }

        if (type === "post") {
            if (!body?.postId || !mongoose.Types.ObjectId.isValid(body.postId)) {
                return NextResponse.json({ error: "postId invalide." }, { status: 400 });
            }
            postId = body.postId;
            text = typeof body?.text === "string" ? body.text.trim() : ""; // optionnel (petit commentaire)
        }

        const created = await Message.create({
            conversationId,
            senderId: meId,
            type,
            text,
            postId,
        });

        // update conversation (list sorting)
        await Conversation.updateOne(
            { _id: conversationId },
            {
                $set: {
                    lastMessageAt: new Date(),
                    lastMessageText: type === "text" ? text.slice(0, 200) : (text ? `📌 ${text.slice(0, 180)}` : "📌 Post partagé"),
                    lastMessageType: type,
                    lastMessagePostId: postId,
                },
            }
        );

        const populated = await Message.findById(created._id)
            .populate("senderId", "pseudo avatarUrl")
            .populate({
                path: "postId",
                select: "userId trackTitle artist coverUrl createdAt type repostOf repostedBy repostComment",
                populate: [
                    { path: "userId", select: "pseudo avatarUrl" },
                    { path: "repostedBy", select: "pseudo avatarUrl" },
                    { path: "repostOf", populate: { path: "userId", select: "pseudo avatarUrl" } },
                ],
            })
            .lean();

        return NextResponse.json({ message: populated }, { status: 201 });
    } catch (e) {
        console.error("❌ POST /api/conversations/[id]/messages error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}