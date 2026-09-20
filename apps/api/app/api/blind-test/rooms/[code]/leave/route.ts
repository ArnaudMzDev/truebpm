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

        const code = normalizeRoomCode(params.code);
        const room: any = await BlindTestRoom.findOne({ code, "players.userId": userId }).lean();
        if (!room) return NextResponse.json({ success: true, room: null });

        const remainingPlayers = (room.players || []).filter((player: any) => String(player.userId) !== String(userId));
        if (!remainingPlayers.length) {
            await BlindTestRoom.updateOne({ _id: room._id }, { $set: { status: "cancelled", expiresAt: new Date() } });
            return NextResponse.json({ success: true, room: null });
        }

        const leavingHost = String(room.hostId) === String(userId);
        const nextHostId = leavingHost ? remainingPlayers[0].userId : room.hostId;
        const updated: any = await BlindTestRoom.findByIdAndUpdate(
            room._id,
            {
                $pull: { players: { userId } },
                $set: { hostId: nextHostId },
            },
            { new: true }
        ).lean();

        return NextResponse.json({ success: true, room: await serializeRoom(updated, userId) });
    } catch (error) {
        console.error("POST /api/blind-test/rooms/:code/leave error:", error);
        return NextResponse.json({ error: "Impossible de quitter le salon." }, { status: 500 });
    }
}
