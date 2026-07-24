import "@/lib/loadModels";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import Note from "@/models/Note";
import Notification from "@/models/Notification";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { noteId: string } }) {
    try {
        await connectDB();

        const meId = await requireUserId(req);
        const { noteId } = params;

        if (
            !meId ||
            !mongoose.Types.ObjectId.isValid(meId) ||
            !noteId ||
            !mongoose.Types.ObjectId.isValid(noteId)
        ) {
            return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
        }

        const meObjectId = new mongoose.Types.ObjectId(meId);
        const note = await Note.findById(noteId).select("_id userId likes").lean();

        if (!note) {
            return NextResponse.json({ error: "Note introuvable." }, { status: 404 });
        }

        if (String((note as any).userId) === String(meId)) {
            return NextResponse.json({ error: "Impossible de liker sa propre note." }, { status: 403 });
        }

        const currentLikes = Array.isArray((note as any).likes) ? (note as any).likes : [];
        const alreadyLiked = currentLikes.some((id: any) => String(id) === String(meId));

        if (alreadyLiked) {
            await Note.updateOne({ _id: noteId }, { $pull: { likes: meObjectId } });
            await Notification.deleteOne({
                type: "like_note",
                recipientId: (note as any).userId,
                actorId: meObjectId,
            });
        } else {
            await Note.updateOne({ _id: noteId }, { $addToSet: { likes: meObjectId } });

            await createNotification({
                recipientId: String((note as any).userId),
                actorId: String(meId),
                type: "like_note",
            });
        }

        const fresh = await Note.findById(noteId).select("likes").lean();
        const likes = Array.isArray((fresh as any)?.likes) ? (fresh as any).likes : [];
        const likesCount = likes.length;
        const likedByMe = likes.some((id: any) => String(id) === String(meId));

        await Note.updateOne({ _id: noteId }, { $set: { likesCount } });

        return NextResponse.json(
            {
                status: likedByMe ? "liked" : "unliked",
                likedByMe,
                likesCount,
            },
            { status: 200 }
        );
    } catch (e) {
        console.error("POST /api/notes/[noteId]/like error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}
