import { randomInt } from "crypto";
import mongoose from "mongoose";
import BlindTestSession from "@/models/BlindTestSession";
import BlindTestTrack from "@/models/BlindTestTrack";
import type { BlindTestDifficulty } from "@/lib/blindTest/score";

export type BlindTestAnswerMode = "free" | "qcm" | "mixed";
export type BlindTestTarget = "title" | "artist" | "both" | "mixed";
export type BlindTestQuestionType = "title" | "artist" | "both" | "qcm-title" | "qcm-artist";

const ROUND_DURATIONS: Record<BlindTestDifficulty, number> = {
    easy: 25000,
    normal: 20000,
    hard: 15000,
    expert: 10000,
};

export function parseGameRules(body: any) {
    const roundCount = [5, 10, 20, 30].includes(Number(body?.roundCount))
        ? Number(body.roundCount)
        : 5;
    const difficulty: BlindTestDifficulty = ["easy", "normal", "hard", "expert"].includes(body?.difficulty)
        ? body.difficulty
        : "normal";
    const answerMode: BlindTestAnswerMode = ["free", "qcm", "mixed"].includes(body?.answerMode)
        ? body.answerMode
        : "mixed";
    const target: BlindTestTarget = ["title", "artist", "both", "mixed"].includes(body?.target)
        ? body.target
        : "mixed";

    return {
        roundCount,
        difficulty,
        answerMode,
        target,
        roundDurationMs: ROUND_DURATIONS[difficulty],
    };
}

function shuffle<T>(values: T[]) {
    const copy = [...values];
    for (let index = copy.length - 1; index > 0; index -= 1) {
        const swapIndex = randomInt(index + 1);
        [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
}

function questionTypeForRound(
    index: number,
    answerMode: BlindTestAnswerMode,
    target: BlindTestTarget
): BlindTestQuestionType {
    const targetCycle: Array<"title" | "artist" | "both"> = ["both", "title", "artist"];
    const selectedTarget = target === "mixed" ? targetCycle[index % targetCycle.length] : target;
    const useQcm = answerMode === "qcm" || (answerMode === "mixed" && index % 3 === 2);

    if (!useQcm) return selectedTarget;
    if (selectedTarget === "artist") return "qcm-artist";
    if (selectedTarget === "title") return "qcm-title";
    return index % 2 === 0 ? "qcm-title" : "qcm-artist";
}

function qcmChoices(tracks: any[], currentTrack: any, kind: "title" | "artist") {
    const correct = String(currentTrack[kind] || "").trim();
    const uniqueDistractors = new Map<string, { label: string; artworkUrl: string }>();

    shuffle(tracks)
        .filter((track) => String(track._id) !== String(currentTrack._id))
        .forEach((track) => {
            const label = String(track[kind] || "").trim();
            const key = label.toLowerCase();
            if (!label || key === correct.toLowerCase() || uniqueDistractors.has(key)) return;
            uniqueDistractors.set(key, {
                label,
                artworkUrl: String(track.artworkUrl || ""),
            });
        });

    return shuffle([
        {
            label: correct,
            artworkUrl: String(currentTrack.artworkUrl || ""),
        },
        ...Array.from(uniqueDistractors.values()).slice(0, 3),
    ]);
}

export function buildRounds(
    tracks: any[],
    answerMode: BlindTestAnswerMode,
    target: BlindTestTarget
) {
    return tracks.map((track, index) => {
        let questionType = questionTypeForRound(index, answerMode, target);
        const optionKind = questionType === "qcm-title" ? "title" : "artist";
        let choices = questionType.startsWith("qcm-")
            ? qcmChoices(tracks, track, optionKind)
            : [];

        if (questionType.startsWith("qcm-") && choices.length < 4) {
            questionType = optionKind;
            choices = [];
        }

        return {
            trackId: track._id,
            questionType,
            options: choices.map((choice) => choice.label),
            optionArtworks: choices.map((choice) => choice.artworkUrl),
            startedAt: null,
            endsAt: null,
            answeredAt: null,
            hintsUsed: [],
        };
    });
}

export function roundTimes(durationMs: number, countdownMs = 2200) {
    const startedAt = new Date(Date.now() + countdownMs);
    return {
        startedAt,
        endsAt: new Date(startedAt.getTime() + durationMs),
    };
}

export function nextRoundTransitionFilter(session: any, userId: string, nextIndex: number) {
    const currentIndex = Number(session.currentRound || 0);
    const answeredAt = session.rounds?.[currentIndex]?.answeredAt;

    return {
        _id: session._id,
        userId,
        status: "active",
        currentRound: currentIndex,
        [`rounds.${currentIndex}.answeredAt`]: new Date(answeredAt),
        [`rounds.${nextIndex}.startedAt`]: null,
    };
}

function asksTitle(questionType: BlindTestQuestionType) {
    return questionType === "title" || questionType === "both" || questionType === "qcm-title";
}

function asksArtist(questionType: BlindTestQuestionType) {
    return questionType === "artist" || questionType === "both" || questionType === "qcm-artist";
}

export function questionRequirements(questionType: BlindTestQuestionType) {
    return {
        asksTitle: asksTitle(questionType),
        asksArtist: asksArtist(questionType),
        answerMode: questionType.startsWith("qcm-") ? "qcm" as const : "free" as const,
    };
}

export function revealRound(round: any, track: any) {
    return {
        correct: {
            title: track.title,
            artist: track.artist,
            album: track.album || "",
            year: track.year || null,
            artworkUrl: track.artworkUrl || "",
            previewUrl: track.previewUrl || "",
        },
        submitted: {
            title: round.submittedTitle || "",
            artist: round.submittedArtist || "",
        },
        titleCorrect: !!round.titleCorrect,
        artistCorrect: !!round.artistCorrect,
        timedOut: !!round.timedOut,
        score: round.score || {},
    };
}

export async function serializeSession(session: any) {
    const currentIndex = Number(session.currentRound || 0);
    const round = session.rounds?.[currentIndex];

    if (!round) {
        return { sessionId: String(session._id), status: session.status };
    }

    const track = await BlindTestTrack.findById(round.trackId).lean();
    if (!track) throw new Error("Morceau de la manche introuvable.");
    let optionArtworks = Array.isArray(round.optionArtworks) ? round.optionArtworks : [];

    if (
        round.questionType?.startsWith("qcm-") &&
        Array.isArray(round.options) &&
        optionArtworks.length !== round.options.length
    ) {
        const optionKind = round.questionType === "qcm-title" ? "title" : "artist";
        const sessionTrackIds = (session.rounds || []).map((item: any) => item.trackId).filter(Boolean);
        const optionTracks = await BlindTestTrack.find({ _id: { $in: sessionTrackIds } })
            .select("title artist artworkUrl")
            .lean();
        const artworkByLabel = new Map<string, string>();

        optionTracks.forEach((optionTrack: any) => {
            const label = String(optionTrack?.[optionKind] || "").trim().toLowerCase();
            if (label && !artworkByLabel.has(label)) {
                artworkByLabel.set(label, String(optionTrack.artworkUrl || ""));
            }
        });
        optionArtworks = round.options.map((option: string) => (
            artworkByLabel.get(String(option).trim().toLowerCase()) || ""
        ));
    }

    const payload: any = {
        sessionId: String(session._id),
        status: session.status,
        blindTest: {
            id: String(session.blindTestId),
            slug: session.blindTestSlug,
            title: session.blindTestTitle,
        },
        rules: session.rules,
        score: session.score || 0,
        streak: session.currentStreak || 0,
        bestStreak: session.bestStreak || 0,
        round: {
            index: currentIndex,
            number: currentIndex + 1,
            total: session.rounds.length,
            questionType: round.questionType,
            options: round.options || [],
            optionArtworks,
            previewUrl: track.previewUrl,
            startedAt: round.startedAt,
            endsAt: round.endsAt,
            answered: !!round.answeredAt,
            hintsUsed: round.hintsUsed || [],
        },
    };

    if (round.answeredAt) payload.reveal = revealRound(round, track);
    return payload;
}

export async function getSessionResult(session: any) {
    const trackIds = session.rounds.map((round: any) => round.trackId);
    const tracks = await BlindTestTrack.find({ _id: { $in: trackIds } }).lean();
    const tracksById = new Map(tracks.map((track: any) => [String(track._id), track]));

    let titleQuestions = 0;
    let artistQuestions = 0;
    let titlesFound = 0;
    let artistsFound = 0;
    let responseTimeTotal = 0;
    let responseTimeCount = 0;

    const rounds = session.rounds.map((round: any, index: number) => {
        const track = tracksById.get(String(round.trackId));
        const requirements = questionRequirements(round.questionType);
        if (requirements.asksTitle) titleQuestions += 1;
        if (requirements.asksArtist) artistQuestions += 1;
        if (requirements.asksTitle && round.titleCorrect) titlesFound += 1;
        if (requirements.asksArtist && round.artistCorrect) artistsFound += 1;

        if (round.startedAt && round.answeredAt) {
            responseTimeTotal += Math.max(
                0,
                new Date(round.answeredAt).getTime() - new Date(round.startedAt).getTime()
            );
            responseTimeCount += 1;
        }

        return {
            index,
            questionType: round.questionType,
            ...(track ? revealRound(round, track) : {}),
        };
    });

    const totalQuestions = titleQuestions + artistQuestions;
    const totalCorrect = titlesFound + artistsFound;
    const [higherScores, personalBest] = await Promise.all([
        BlindTestSession.aggregate([
            { $match: { blindTestId: session.blindTestId, status: "completed" } },
            { $group: { _id: "$userId", score: { $max: "$score" } } },
            { $match: { score: { $gt: session.score } } },
            { $count: "count" },
        ]),
        BlindTestSession.findOne({
            userId: session.userId,
            blindTestId: session.blindTestId,
            status: "completed",
        })
            .sort({ score: -1 })
            .select("score")
            .lean(),
    ]);

    return {
        sessionId: String(session._id),
        blindTest: {
            id: String(session.blindTestId),
            slug: session.blindTestSlug,
            title: session.blindTestTitle,
        },
        rules: session.rules,
        score: session.score || 0,
        roundCount: session.rounds.length,
        titlesFound,
        artistsFound,
        accuracy: totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
        titleAccuracy: titleQuestions ? Math.round((titlesFound / titleQuestions) * 100) : 0,
        artistAccuracy: artistQuestions ? Math.round((artistsFound / artistQuestions) * 100) : 0,
        averageTimeMs: responseTimeCount ? Math.round(responseTimeTotal / responseTimeCount) : 0,
        bestStreak: session.bestStreak || 0,
        rank: (higherScores[0]?.count || 0) + 1,
        personalBest: Number(personalBest?.score || 0),
        isPersonalBest: Number(session.score || 0) >= Number(personalBest?.score || 0),
        completedAt: session.completedAt,
        rounds,
    };
}

export function validSessionId(value: string) {
    return mongoose.Types.ObjectId.isValid(value);
}
