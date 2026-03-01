import "@/lib/loadModels";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import Conversation from "@/models/Conversation";

function isObjectId(id: string) {
    return mongoose.Types.ObjectId.isValid(id);
}

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

        const isMember = (convo.participants || []).some((p: any) => String(p) === String(meId));
        if (!isMember) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

        // ✅ update readAt[meId] = now
        const key = String(meId);
        convo.readAt = convo.readAt || new Map();
        convo.readAt.set(key, new Date());
        await convo.save();

        return NextResponse.json({ ok: true, readAt: convo.readAt.get(key)?.toISOString?.() || null }, { status: 200 });
    } catch (e) {
        console.error("POST /api/conversations/[id]/read error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}