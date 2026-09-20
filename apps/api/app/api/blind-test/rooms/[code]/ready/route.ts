import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import { normalizeRoomCode, serializeRoom } from "@/lib/blindTest/room";
import BlindTestRoom from "@/models/BlindTestRoom";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { code: string } }) {
    try {
        await connectDB();
        const userId = await requireUserId(req);
        if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

        const body = await req.json().catch(() => null);
        const ready = typeof body?.ready === "boolean" ? body.ready : true;
        const code = normalizeRoomCode(params.code);

        const room: any = await BlindTestRoom.findOneAndUpdate(
            { code, status: "lobby", "players.userId": userId },
            {
                $set: {
                    "players.$.ready": ready,
                    "players.$.lastSeenAt": new Date(),
                },
            },
            { new: true }
        ).lean();

        if (!room) return NextResponse.json({ error: "Salon introuvable." }, { status: 404 });
        return NextResponse.json({ room: await serializeRoom(room, userId) });
    } catch (error) {
        console.error("POST /api/blind-test/rooms/:code/ready error:", error);
        return NextResponse.json({ error: "Impossible de changer ton statut." }, { status: 500 });
    }
}
