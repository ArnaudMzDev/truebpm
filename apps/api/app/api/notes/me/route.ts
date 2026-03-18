import "@/lib/loadModels";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import Note from "@/models/Note";

// DELETE /api/notes/me
export async function DELETE(req: Request) {
    try {
        await connectDB();

        const meId = await requireUserId(req);
        if (!meId || !mongoose.Types.ObjectId.isValid(meId)) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        await Note.deleteOne({ userId: new mongoose.Types.ObjectId(meId) });

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (e) {
        console.error("❌ DELETE /api/notes/me error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}