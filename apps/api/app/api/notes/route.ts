import "@/lib/loadModels";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import Note from "@/models/Note";
import User from "@/models/User";

function sanitizeTrack(raw: any) {
    if (!raw || typeof raw !== "object") {
        return {
            entityId: "",
            entityType: "",
            title: "",
            artist: "",
            coverUrl: "",
            previewUrl: "",
        };
    }

    const entityType =
        raw.entityType === "song" || raw.entityType === "album" || raw.entityType === "artist"
            ? raw.entityType
            : "";

    return {
        entityId: typeof raw.entityId === "string" ? raw.entityId.trim() : "",
        entityType,
        title: typeof raw.title === "string" ? raw.title.trim() : "",
        artist: typeof raw.artist === "string" ? raw.artist.trim() : "",
        coverUrl: typeof raw.coverUrl === "string" ? raw.coverUrl.trim() : "",
        previewUrl: typeof raw.previewUrl === "string" ? raw.previewUrl.trim() : "",
    };
}

// GET /api/notes
export async function GET(req: Request) {
    try {
        await connectDB();

        const meId = await requireUserId(req);
        if (!meId || !mongoose.Types.ObjectId.isValid(meId)) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        const me = await User.findById(meId)
            .select("_id followingList")
            .lean();

        if (!me) {
            return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
        }

        const ids = [
            String(me._id),
            ...((me.followingList || []).map((id: any) => String(id))),
        ];

        const uniqueIds = [...new Set(ids)]
            .filter((id) => mongoose.Types.ObjectId.isValid(id))
            .map((id) => new mongoose.Types.ObjectId(id));

        const now = new Date();

        const notes = await Note.find({
            userId: { $in: uniqueIds },
            expiresAt: { $gt: now },
        })
            .populate("userId", "_id pseudo avatarUrl")
            .sort({ createdAt: -1 })
            .lean();

        const ordered = [
            ...notes.filter((n: any) => String(n.userId?._id) === String(meId)),
            ...notes.filter((n: any) => String(n.userId?._id) !== String(meId)),
        ];

        return NextResponse.json({ notes: ordered }, { status: 200 });
    } catch (e) {
        console.error("❌ GET /api/notes error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}

// POST /api/notes
export async function POST(req: Request) {
    try {
        await connectDB();

        const meId = await requireUserId(req);
        if (!meId || !mongoose.Types.ObjectId.isValid(meId)) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        const body = await req.json().catch(() => null);
        const text = typeof body?.text === "string" ? body.text.trim() : "";

        if (!text) {
            return NextResponse.json({ error: "Le texte de la note est requis." }, { status: 400 });
        }

        if (text.length > 60) {
            return NextResponse.json({ error: "La note ne peut pas dépasser 60 caractères." }, { status: 400 });
        }

        const track = sanitizeTrack(body?.track);

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const note = await Note.findOneAndUpdate(
            { userId: new mongoose.Types.ObjectId(meId) },
            {
                $set: {
                    text,
                    track,
                    expiresAt,
                },
            },
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true,
            }
        )
            .populate("userId", "_id pseudo avatarUrl")
            .lean();

        return NextResponse.json({ success: true, note }, { status: 200 });
    } catch (e) {
        console.error("❌ POST /api/notes error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}