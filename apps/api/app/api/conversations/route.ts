import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Conversation from "@/models/Conversation";
import mongoose from "mongoose";
import { verifyToken } from "@/lib/auth";

function makeParticipantsKey(a: string, b: string) {
    return [a.toString(), b.toString()].sort().join("_");
}

// ✅ LISTE des conversations de l’utilisateur
export async function GET(req: Request) {
    try {
        await connectDB();

        const meId = await verifyToken(req).catch(() => null);
        if (!meId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

        const docs: any[] = await Conversation.find({
            participants: new mongoose.Types.ObjectId(meId),
        })
            .sort({ lastMessageAt: -1, updatedAt: -1 })
            .populate("participants", "pseudo avatarUrl")
            .lean();

        return NextResponse.json({ conversations: docs }, { status: 200 });
    } catch (e) {
        console.error("❌ GET /api/conversations error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}

// ✅ CREATE/OPEN DM
export async function POST(req: Request) {
    try {
        await connectDB();

        const meId = await verifyToken(req).catch(() => null);
        if (!meId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

        const body = await req.json().catch(() => null);

        // ✅ accepte les 2 formats : { otherUserId } ou { userId }
        const otherId = body?.otherUserId || body?.userId;

        if (
            !otherId ||
            !mongoose.Types.ObjectId.isValid(otherId) ||
            !mongoose.Types.ObjectId.isValid(meId)
        ) {
            return NextResponse.json({ error: "IDs invalides." }, { status: 400 });
        }
        if (meId === otherId) {
            return NextResponse.json({ error: "Conversation avec soi-même impossible." }, { status: 400 });
        }

        const key = makeParticipantsKey(meId, otherId);

        // ✅ retrouve via participantsKey (plus simple et rapide)
        const existing: any = await Conversation.findOne({ participantsKey: key })
            .populate("participants", "pseudo avatarUrl")
            .lean();

        if (existing?._id) {
            return NextResponse.json({ conversation: existing }, { status: 200 });
        }

        // ✅ create
        const created: any = await Conversation.create({
            isGroup: false,
            participants: [meId, otherId],
            participantsKey: key,
            lastMessageAt: null,
            lastMessageText: "",
            lastMessageType: "text",
        });

        const populated = await Conversation.findById(created._id)
            .populate("participants", "pseudo avatarUrl")
            .lean();

        return NextResponse.json({ conversation: populated }, { status: 201 });
    } catch (e: any) {
        // ✅ si 2 requêtes en même temps -> collision unique -> on récupère la conversation
        if (e?.code === 11000) {
            try {
                const body = await req.json().catch(() => null);
                const otherId = body?.otherUserId || body?.userId;
                const meId = await verifyToken(req).catch(() => null);
                if (meId && otherId) {
                    const key = makeParticipantsKey(meId, otherId);
                    const existing = await Conversation.findOne({ participantsKey: key })
                        .populate("participants", "pseudo avatarUrl")
                        .lean();
                    if (existing?._id) {
                        return NextResponse.json({ conversation: existing }, { status: 200 });
                    }
                }
            } catch {}
        }

        console.error("❌ POST /api/conversations error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}