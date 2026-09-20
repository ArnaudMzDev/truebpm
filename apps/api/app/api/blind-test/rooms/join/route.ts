import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import { blindTestFlags } from "@/lib/blindTest/flags";
import { activePlayers, expireRoomIfNeeded, normalizeRoomCode, serializeRoom } from "@/lib/blindTest/room";
import BlindTestRoom from "@/models/BlindTestRoom";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        await connectDB();
        const userId = await requireUserId(req);
        if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        if (!blindTestFlags.global || !blindTestFlags.multiplayer) {
            return NextResponse.json({ error: "Les salons privés arrivent bientôt." }, { status: 503 });
        }

        const body = await req.json().catch(() => null);
        const code = normalizeRoomCode(body?.code);
        if (code.length < 4) return NextResponse.json({ error: "Code invalide." }, { status: 400 });

        let room: any = await BlindTestRoom.findOne({ code }).lean();
        room = await expireRoomIfNeeded(room);
        if (!room || room.status === "expired") {
            return NextResponse.json({ error: "Salon introuvable ou expiré." }, { status: 404 });
        }
        if (room.status !== "lobby") {
            return NextResponse.json({ error: "Cette partie a déjà commencé." }, { status: 409 });
        }

        const existing = (room.players || []).find((player: any) => String(player.userId) === String(userId));
        if (!existing && activePlayers(room).length >= Number(room.settings?.maxPlayers || 8)) {
            return NextResponse.json({ error: "Salon complet." }, { status: 409 });
        }

        const user = await User.findById(userId).select("_id pseudo avatarUrl").lean();
        if (!user) return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });

        if (existing) {
            room = await BlindTestRoom.findOneAndUpdate(
                { code, "players.userId": userId },
                {
                    $set: {
                        "players.$.connected": false,
                        "players.$.lastSeenAt": new Date(),
                    },
                },
                { new: true }
            ).lean();
        } else {
            room = await BlindTestRoom.findOneAndUpdate(
                { code, status: "lobby" },
                {
                    $push: {
                        players: {
                            userId,
                            pseudo: (user as any).pseudo,
                            avatarUrl: (user as any).avatarUrl || "",
                            role: "player",
                            ready: false,
                            connected: false,
                            joinedAt: new Date(),
                            lastSeenAt: new Date(),
                        },
                    },
                    $set: { expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) },
                },
                { new: true }
            ).lean();
        }

        return NextResponse.json({ room: await serializeRoom(room, userId) });
    } catch (error) {
        console.error("POST /api/blind-test/rooms/join error:", error);
        return NextResponse.json({ error: "Impossible de rejoindre le salon." }, { status: 500 });
    }
}
