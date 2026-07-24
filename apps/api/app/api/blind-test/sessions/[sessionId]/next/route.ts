import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import {
    nextRoundTransitionFilter,
    roundTimes,
    serializeSession,
    validSessionId,
} from "@/lib/blindTest/session";
import BlindTestSession from "@/models/BlindTestSession";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { sessionId: string } }) {
    try {
        await connectDB();
        const userId = await requireUserId(req);
        if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        if (!validSessionId(params.sessionId)) {
            return NextResponse.json({ error: "Partie invalide." }, { status: 400 });
        }

        const session: any = await BlindTestSession.findOne({
            _id: params.sessionId,
            userId,
            status: "active",
        }).lean();
        if (!session) return NextResponse.json({ error: "Partie active introuvable." }, { status: 404 });

        const currentRound = session.rounds?.[session.currentRound];
        const nextIndex = session.currentRound + 1;
        if (!currentRound?.answeredAt) {
            return NextResponse.json({ error: "Réponds avant de continuer." }, { status: 409 });
        }
        if (!session.rounds?.[nextIndex]) {
            return NextResponse.json({ error: "La partie est terminée." }, { status: 409 });
        }

        const times = roundTimes(session.rules.roundDurationMs, 1400);
        const updated: any = await BlindTestSession.findOneAndUpdate(
            nextRoundTransitionFilter(session, userId, nextIndex),
            {
                $set: {
                    currentRound: nextIndex,
                    [`rounds.${nextIndex}.startedAt`]: times.startedAt,
                    [`rounds.${nextIndex}.endsAt`]: times.endsAt,
                },
            },
            { new: true }
        ).lean();

        if (!updated) {
            const advanced: any = await BlindTestSession.findOne({
                _id: session._id,
                userId,
                status: "active",
                currentRound: nextIndex,
            }).lean();

            if (advanced) {
                return NextResponse.json({ session: await serializeSession(advanced) });
            }

            return NextResponse.json({ error: "Impossible de passer à la manche suivante." }, { status: 409 });
        }
        return NextResponse.json({ session: await serializeSession(updated) });
    } catch (error) {
        console.error("POST /api/blind-test/sessions/:id/next error:", error);
        return NextResponse.json({ error: "Impossible de lancer la manche suivante." }, { status: 500 });
    }
}
