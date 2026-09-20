import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import { expireRoomIfNeeded, normalizeRoomCode, serializeRoom } from "@/lib/blindTest/room";
import BlindTestRoom from "@/models/BlindTestRoom";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { code: string } }) {
    try {
        await connectDB();
        const userId = await requireUserId(req);
        if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

        const code = normalizeRoomCode(params.code);
        let room: any = await BlindTestRoom.findOne({ code }).lean();
        room = await expireRoomIfNeeded(room);
        if (!room || room.status === "expired") {
            return NextResponse.json({ error: "Salon introuvable ou expiré." }, { status: 404 });
        }

        const isMember = (room.players || []).some((player: any) => String(player.userId) === String(userId));
        if (!isMember) return NextResponse.json({ error: "Tu n’es pas dans ce salon." }, { status: 403 });

        return NextResponse.json({ room: await serializeRoom(room, userId) });
    } catch (error) {
        console.error("GET /api/blind-test/rooms/:code error:", error);
        return NextResponse.json({ error: "Impossible de charger le salon." }, { status: 500 });
    }
}
