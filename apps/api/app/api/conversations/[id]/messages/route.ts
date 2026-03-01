import "@/lib/loadModels";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import Post from "@/models/Post";

function isObjectId(id: string) {
    return mongoose.Types.ObjectId.isValid(id);
}

// GET /api/conversations/:id/messages?limit=30&cursor=...
export async function GET(req: Request, { params }: any) {
    try {
        await connectDB();

        const meId = await verifyToken(req).catch(() => null);
        if (!meId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

        const conversationId = params?.id;
        if (!conversationId || !isObjectId(conversationId)) {
            return NextResponse.json({ error: "Conversation invalide." }, { status: 400 });
        }

        const convo = await Conversation.findById(conversationId).lean();
        if (!convo) return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });

        const isMember = (convo.participants || []).some((p: any) => p?.toString?.() === meId?.toString?.());
        if (!isMember) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

        const url = new URL(req.url);
        const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 30)));
        const cursor = url.searchParams.get("cursor");

        const query: any = { conversationId };
        if (cursor && isObjectId(cursor)) query._id = { $lt: cursor };

        const messages = await Message.find(query)
            .sort({ _id: -1 }) // newest -> oldest
            .limit(limit + 1)
            .populate("senderId", "_id pseudo avatarUrl")
            .populate({
                path: "postId",
                populate: { path: "userId", select: "_id pseudo avatarUrl" },
            })
            .lean();

        const hasMore = messages.length > limit;
        const sliced = hasMore ? messages.slice(0, limit) : messages;
        const nextCursor = hasMore ? String(sliced[sliced.length - 1]._id) : null;

        return NextResponse.json({ messages: sliced, nextCursor }, { status: 200 });
    } catch (e) {
        console.error("GET /api/conversations/[id]/messages error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}

// POST /api/conversations/:id/messages
export async function POST(req: Request, { params }: any) {
    try {
        await connectDB();

        const meId = await verifyToken(req).catch(() => null);
        if (!meId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

        const conversationId = params?.id;
        if (!conversationId || !isObjectId(conversationId)) {
            return NextResponse.json({ error: "Conversation invalide." }, { status: 400 });
        }

        const convo = await Conversation.findById(conversationId);
        if (!convo) return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });

        const isMember = (convo.participants || []).some((p: any) => p?.toString?.() === meId?.toString?.());
        if (!isMember) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

        const body = await req.json().catch(() => null);
        const type = body?.type;

        if (!["text", "post", "image"].includes(type)) {
            return NextResponse.json({ error: "Type invalide." }, { status: 400 });
        }

        // TEXT
        if (type === "text") {
            const text = String(body?.text || "").trim();
            if (!text) return NextResponse.json({ error: "Message vide." }, { status: 400 });

            const msg = await Message.create({
                conversationId,
                senderId: meId,
                type: "text",
                text,
            });

            await Conversation.findByIdAndUpdate(conversationId, {
                lastMessageAt: new Date(),
                lastMessageText: text.slice(0, 140),
                lastMessageType: "text",
            });

            const populated = await Message.findById(msg._id).populate("senderId", "_id pseudo avatarUrl").lean();
            return NextResponse.json({ message: populated }, { status: 201 });
        }

        // POST SHARE
        if (type === "post") {
            const postId = body?.postId;
            if (!postId || !isObjectId(postId)) {
                return NextResponse.json({ error: "postId invalide." }, { status: 400 });
            }

            const post = await Post.findById(postId).lean();
            if (!post) return NextResponse.json({ error: "Post introuvable." }, { status: 404 });

            const text = String(body?.text || "").trim();

            const msg = await Message.create({
                conversationId,
                senderId: meId,
                type: "post",
                postId,
                text,
            });

            await Conversation.findByIdAndUpdate(conversationId, {
                lastMessageAt: new Date(),
                lastMessageText: "📌 Post partagé",
                lastMessageType: "post",
            });

            const populated = await Message.findById(msg._id)
                .populate("senderId", "_id pseudo avatarUrl")
                .populate("postId")
                .lean();

            return NextResponse.json({ message: populated }, { status: 201 });
        }

        // IMAGE
        if (type === "image") {
            const imageUrl = String(body?.imageUrl || "").trim();
            if (!imageUrl) return NextResponse.json({ error: "imageUrl manquant." }, { status: 400 });

            const msg = await Message.create({
                conversationId,
                senderId: meId,
                type: "image",
                imageUrl,
                imageWidth: body?.imageWidth ?? null,
                imageHeight: body?.imageHeight ?? null,
                text: String(body?.text || "").trim(),
            });

            await Conversation.findByIdAndUpdate(conversationId, {
                lastMessageAt: new Date(),
                lastMessageText: "📷 Photo",
                lastMessageType: "image",
            });

            const populated = await Message.findById(msg._id).populate("senderId", "_id pseudo avatarUrl").lean();
            return NextResponse.json({ message: populated }, { status: 201 });
        }

        return NextResponse.json({ error: "Non géré." }, { status: 400 });
    } catch (e) {
        console.error("POST /api/conversations/[id]/messages error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}