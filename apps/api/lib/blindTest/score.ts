export type BlindTestDifficulty = "easy" | "normal" | "hard" | "expert";

type ScoreInput = {
    asksTitle: boolean;
    asksArtist: boolean;
    titleCorrect: boolean;
    artistCorrect: boolean;
    elapsedMs: number;
    durationMs: number;
    difficulty: BlindTestDifficulty;
    streakBeforeRound: number;
    hintCount: number;
    answerMode: "free" | "qcm";
};

const DIFFICULTY_MULTIPLIER: Record<BlindTestDifficulty, number> = {
    easy: 0.9,
    normal: 1,
    hard: 1.15,
    expert: 1.3,
};

export function calculateBlindTestScore(input: ScoreInput) {
    const artist = input.asksArtist && input.artistCorrect ? 500 : 0;
    const title = input.asksTitle && input.titleCorrect ? 500 : 0;
    const askedCount = Number(input.asksArtist) + Number(input.asksTitle);
    const correctCount = Number(input.asksArtist && input.artistCorrect) + Number(input.asksTitle && input.titleCorrect);
    const fullyCorrect = askedCount > 0 && correctCount === askedCount;
    const hasCorrectAnswer = correctCount > 0;

    const safeDuration = Math.max(1, input.durationMs);
    const safeElapsed = Math.max(0, Math.min(input.elapsedMs, safeDuration));
    const remainingRatio = 1 - safeElapsed / safeDuration;
    const speed = hasCorrectAnswer ? Math.round(500 * remainingRatio * (correctCount / askedCount)) : 0;
    const streak = fullyCorrect ? Math.min(input.streakBeforeRound + 1, 10) * 40 : 0;
    const noHint = fullyCorrect && input.hintCount === 0 ? 100 : 0;
    const hintPenalty = input.hintCount * 125;
    const difficultyMultiplier = DIFFICULTY_MULTIPLIER[input.difficulty];
    const modeMultiplier = input.answerMode === "qcm" ? 0.82 : 1;

    const positiveSubtotal = artist + title + speed + streak + noHint;
    const total = Math.max(
        0,
        Math.round(positiveSubtotal * difficultyMultiplier * modeMultiplier - hintPenalty)
    );

    return {
        artist,
        title,
        speed,
        streak,
        noHint,
        hintPenalty,
        difficultyMultiplier,
        modeMultiplier,
        total,
        fullyCorrect,
        nextStreak: fullyCorrect ? input.streakBeforeRound + 1 : 0,
    };
}
