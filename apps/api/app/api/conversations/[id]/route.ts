import "@/lib/loadModels";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import Conversation from "@/models/Conversation";

function isObjectId(id: string) {
    return mongoose.Types.ObjectId.isValid(id);
}

export async function GET(req: Request, { params }: any) {
    try {
        await connectDB();

        const meId = await verifyToken(req).catch(() => null);
        if (!meId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

        const conversationId = params?.id;
        if (!conversationId || !isObjectId(conversationId)) {
            return NextResponse.json({ error: "Conversation invalide." }, { status: 400 });
        }

        const convo = await Conversation.findById(conversationId).populate("participants", "_id pseudo avatarUrl").lean();
        if (!convo) return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });

        const meKey = String(meId);
        const isMember = (convo.participants || []).some((p: any) => String(p?._id || p) === meKey);
        if (!isMember) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

        const readAtMe = convo?.readAt?.[meKey] ? new Date(convo.readAt[meKey]).toISOString() : null;

        const other = (convo.participants || []).find((p: any) => String(p._id) !== meKey);
        const otherKey = other?._id ? String(other._id) : null;
        const readAtOther =
            otherKey && convo?.readAt?.[otherKey] ? new Date(convo.readAt[otherKey]).toISOString() : null;

        return NextResponse.json({ conversation: { _id: convo._id, readAtMe, readAtOther } }, { status: 200 });
    } catch (e) {
        console.error("GET /api/conversations/[id] error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}