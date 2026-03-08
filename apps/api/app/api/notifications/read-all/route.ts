import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import Notification from "@/models/Notification";

export async function POST(req: Request) {
    try {
        await connectDB();

        const meId = await requireUserId(req);
        if (!meId) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        await Notification.updateMany(
            { recipientId: meId, isRead: false },
            { $set: { isRead: true } }
        );

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (e) {
        console.error("POST /api/notifications/read-all error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}