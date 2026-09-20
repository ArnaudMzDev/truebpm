import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import { ensureOfficialBlindTests, getPlayableTracks } from "@/lib/blindTest/catalog";
import { buildRounds, roundTimes } from "@/lib/blindTest/session";
import { activePlayers, normalizeRoomCode, serializeRoom } from "@/lib/blindTest/room";
import BlindTestRoom from "@/models/BlindTestRoom";
import BlindTest from "@/models/BlindTest";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { code: string } }) {
    try {
        await connectDB();
        const userId = await requireUserId(req);
        if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

        const code = normalizeRoomCode(params.code);
        const room: any = await BlindTestRoom.findOne({ code, status: "lobby" }).lean();
        if (!room) return NextResponse.json({ error: "Salon introuvable ou déjà lancé." }, { status: 404 });
        if (String(room.hostId) !== String(userId)) {
            return NextResponse.json({ error: "Seul l’hôte peut lancer la partie." }, { status: 403 });
        }

        const players = activePlayers(room);
        if (players.length < 2) {
            return NextResponse.json({ error: "Il faut au moins 2 joueurs pour lancer." }, { status: 409 });
        }
        const notReady = players.filter((player: any) => !player.ready);
        if (notReady.length) {
            return NextResponse.json({ error: "Tous les joueurs doivent être prêts." }, { status: 409 });
        }

        await ensureOfficialBlindTests();
        const blindTest = await BlindTest.findById(room.blindTestId).lean();
        if (!blindTest) return NextResponse.json({ error: "Blind test introuvable." }, { status: 404 });

        const settings = room.settings;
        const trackPool = await getPlayableTracks(blindTest, settings.roundCount, {
            poolSize: Math.max(32, settings.roundCount * 5),
        });
        const tracks = trackPool.slice(0, settings.roundCount);
        const rounds = buildRounds(tracks, settings.answerMode, settings.target, trackPool);
        const firstTimes = roundTimes(settings.roundDurationMs, 2600);
        rounds[0] = { ...rounds[0], ...firstTimes };

        const updated: any = await BlindTestRoom.findOneAndUpdate(
            { _id: room._id, status: "lobby" },
            {
                $set: {
                    status: "active",
                    rounds,
                    currentRound: 0,
                    startedAt: new Date(),
                    expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
                },
            },
            { new: true }
        ).lean();

        return NextResponse.json({ room: await serializeRoom(updated, userId) });
    } catch (error: any) {
        console.error("POST /api/blind-test/rooms/:code/start error:", error);
        const message = error?.message === "Pas assez d’extraits vérifiés pour lancer cette partie."
            ? error.message
            : "Impossible de lancer la partie.";
        return NextResponse.json({ error: message }, { status: message === error?.message ? 503 : 500 });
    }
}
