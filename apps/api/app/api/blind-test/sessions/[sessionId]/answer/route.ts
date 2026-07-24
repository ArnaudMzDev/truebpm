import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import { matchesAnswer } from "@/lib/blindTest/answer";
import { calculateBlindTestScore } from "@/lib/blindTest/score";
import {
    getSessionResult,
    questionRequirements,
    serializeSession,
    validSessionId,
} from "@/lib/blindTest/session";
import BlindTest from "@/models/BlindTest";
import BlindTestSession from "@/models/BlindTestSession";
import BlindTestTrack from "@/models/BlindTestTrack";

export const dynamic = "force-dynamic";

function cleanAnswer(value: unknown) {
    return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

export async function POST(req: Request, { params }: { params: { sessionId: string } }) {
    try {
        await connectDB();
        const userId = await requireUserId(req);
        if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        if (!validSessionId(params.sessionId)) {
            return NextResponse.json({ error: "Partie invalide." }, { status: 400 });
        }

        const body = await req.json().catch(() => null);
        const requestedRound = Number(body?.roundIndex);
        const session: any = await BlindTestSession.findOne({
            _id: params.sessionId,
            userId,
            status: "active",
        }).lean();

        if (!session) return NextResponse.json({ error: "Partie active introuvable." }, { status: 404 });
        if (!Number.isInteger(requestedRound) || requestedRound !== session.currentRound) {
            return NextResponse.json({ error: "Cette manche n’est plus active." }, { status: 409 });
        }

        const round = session.rounds?.[session.currentRound];
        if (!round || round.answeredAt) {
            return NextResponse.json({ error: "Une réponse a déjà été enregistrée." }, { status: 409 });
        }

        const now = new Date();
        const startedAt = new Date(round.startedAt);
        const endsAt = new Date(round.endsAt);
        if (!Number.isFinite(startedAt.getTime()) || now.getTime() < startedAt.getTime() - 250) {
            return NextResponse.json({ error: "La manche n’a pas encore commencé." }, { status: 409 });
        }

        const track: any = await BlindTestTrack.findById(round.trackId).lean();
        if (!track) return NextResponse.json({ error: "Morceau introuvable." }, { status: 404 });

        const requirements = questionRequirements(round.questionType);
        const choice = cleanAnswer(body?.choice);
        const submittedTitle = requirements.answerMode === "qcm" && requirements.asksTitle
            ? choice
            : cleanAnswer(body?.title);
        const submittedArtist = requirements.answerMode === "qcm" && requirements.asksArtist
            ? choice
            : cleanAnswer(body?.artist);
        const timedOut = !Number.isFinite(endsAt.getTime()) || now.getTime() > endsAt.getTime();

        const titleCorrect = !timedOut && requirements.asksTitle
            ? matchesAnswer(submittedTitle, track.title, track.titleAliases || [], "title")
            : false;
        const artistCorrect = !timedOut && requirements.asksArtist
            ? matchesAnswer(submittedArtist, track.artist, track.artistAliases || [], "artist")
            : false;
        const durationMs = Math.max(1, endsAt.getTime() - startedAt.getTime());
        const elapsedMs = Math.max(0, now.getTime() - startedAt.getTime());
        const scoring = calculateBlindTestScore({
            asksTitle: requirements.asksTitle,
            asksArtist: requirements.asksArtist,
            titleCorrect,
            artistCorrect,
            elapsedMs,
            durationMs,
            difficulty: session.rules.difficulty,
            streakBeforeRound: session.currentStreak || 0,
            hintCount: Array.isArray(round.hintsUsed) ? round.hintsUsed.length : 0,
            answerMode: requirements.answerMode,
        });

        const roundPath = `rounds.${session.currentRound}`;
        const isLastRound = session.currentRound >= session.rounds.length - 1;
        const scoreBreakdown = {
            artist: scoring.artist,
            title: scoring.title,
            speed: scoring.speed,
            streak: scoring.streak,
            noHint: scoring.noHint,
            hintPenalty: scoring.hintPenalty,
            difficultyMultiplier: scoring.difficultyMultiplier,
            modeMultiplier: scoring.modeMultiplier,
            total: scoring.total,
        };
        const setValues: Record<string, any> = {
            [`${roundPath}.answeredAt`]: now,
            [`${roundPath}.submittedTitle`]: submittedTitle,
            [`${roundPath}.submittedArtist`]: submittedArtist,
            [`${roundPath}.titleCorrect`]: titleCorrect,
            [`${roundPath}.artistCorrect`]: artistCorrect,
            [`${roundPath}.timedOut`]: timedOut,
            [`${roundPath}.score`]: scoreBreakdown,
            currentStreak: scoring.nextStreak,
            bestStreak: Math.max(session.bestStreak || 0, scoring.nextStreak),
        };
        if (isLastRound) {
            setValues.status = "completed";
            setValues.completedAt = now;
        }

        const updated: any = await BlindTestSession.findOneAndUpdate(
            {
                _id: session._id,
                userId,
                status: "active",
                currentRound: session.currentRound,
                [`${roundPath}.answeredAt`]: null,
            },
            {
                $set: setValues,
                $inc: { score: scoring.total },
            },
            { new: true }
        ).lean();

        if (!updated) {
            return NextResponse.json({ error: "Une réponse a déjà été enregistrée." }, { status: 409 });
        }

        if (isLastRound) {
            await BlindTest.updateOne(
                { _id: updated.blindTestId },
                {
                    $inc: { gamesCount: 1, scoreTotal: updated.score || 0 },
                    $max: { bestScore: updated.score || 0 },
                }
            );
            return NextResponse.json({
                completed: true,
                result: await getSessionResult(updated),
            });
        }

        return NextResponse.json({
            completed: false,
            session: await serializeSession(updated),
        });
    } catch (error) {
        console.error("POST /api/blind-test/sessions/:id/answer error:", error);
        return NextResponse.json({ error: "Impossible de valider la réponse." }, { status: 500 });
    }
}
