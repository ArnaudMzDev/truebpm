import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import { blindTestFlags } from "@/lib/blindTest/flags";
import { ensureOfficialBlindTests } from "@/lib/blindTest/catalog";
import {
    createUniqueRoomCode,
    expiresAtFromNow,
    parseRoomSettings,
    serializeRoom,
} from "@/lib/blindTest/room";
import BlindTest from "@/models/BlindTest";
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
        const slug = typeof body?.blindTestId === "string" ? body.blindTestId.trim() : "";
        if (!slug || slug.length > 80) {
            return NextResponse.json({ error: "Catégorie invalide." }, { status: 400 });
        }

        await ensureOfficialBlindTests();
        const [blindTest, host] = await Promise.all([
            BlindTest.findOne({ slug, active: true }).lean(),
            User.findById(userId).select("_id pseudo avatarUrl").lean(),
        ]);
        if (!blindTest) return NextResponse.json({ error: "Blind test introuvable." }, { status: 404 });
        if (!host) return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });

        const settings = parseRoomSettings(body, (blindTest as any).difficulty || "normal");
        if (!((blindTest as any).supportedRoundCounts || []).includes(settings.roundCount)) {
            return NextResponse.json({ error: "Nombre de manches non pris en charge." }, { status: 400 });
        }

        const room = await BlindTestRoom.create({
            code: await createUniqueRoomCode(),
            hostId: userId,
            blindTestId: (blindTest as any)._id,
            blindTestSlug: (blindTest as any).slug,
            blindTestTitle: (blindTest as any).title,
            blindTestCoverUrl: (blindTest as any).coverUrl || "",
            settings,
            players: [
                {
                    userId,
                    pseudo: (host as any).pseudo,
                    avatarUrl: (host as any).avatarUrl || "",
                    role: "player",
                    ready: true,
                    connected: false,
                    joinedAt: new Date(),
                    lastSeenAt: new Date(),
                },
            ],
            expiresAt: expiresAtFromNow(),
        });

        return NextResponse.json({ room: await serializeRoom(room.toObject(), userId) }, { status: 201 });
    } catch (error) {
        console.error("POST /api/blind-test/rooms error:", error);
        return NextResponse.json({ error: "Impossible de créer le salon." }, { status: 500 });
    }
}
