import { Schema, model, models } from "mongoose";

const ScoreBreakdownSchema = new Schema(
    {
        artist: { type: Number, default: 0 },
        title: { type: Number, default: 0 },
        speed: { type: Number, default: 0 },
        streak: { type: Number, default: 0 },
        noHint: { type: Number, default: 0 },
        hintPenalty: { type: Number, default: 0 },
        difficultyMultiplier: { type: Number, default: 1 },
        modeMultiplier: { type: Number, default: 1 },
        total: { type: Number, default: 0 },
    },
    { _id: false }
);

const BlindTestRoundSchema = new Schema(
    {
        trackId: { type: Schema.Types.ObjectId, ref: "BlindTestTrack", required: true },
        questionType: {
            type: String,
            enum: ["title", "artist", "both", "qcm-title", "qcm-artist"],
            required: true,
        },
        options: { type: [String], default: [] },
        optionArtworks: { type: [String], default: [] },
        startedAt: { type: Date, default: null },
        endsAt: { type: Date, default: null },
        answeredAt: { type: Date, default: null },
        submittedTitle: { type: String, default: "" },
        submittedArtist: { type: String, default: "" },
        titleCorrect: { type: Boolean, default: false },
        artistCorrect: { type: Boolean, default: false },
        timedOut: { type: Boolean, default: false },
        hintsUsed: { type: [String], default: [] },
        score: { type: ScoreBreakdownSchema, default: () => ({}) },
    },
    { _id: false }
);

const BlindTestSessionSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        blindTestId: { type: Schema.Types.ObjectId, ref: "BlindTest", required: true, index: true },
        blindTestSlug: { type: String, required: true, index: true },
        blindTestTitle: { type: String, required: true },
        mode: { type: String, enum: ["solo"], default: "solo" },
        status: {
            type: String,
            enum: ["active", "completed", "abandoned"],
            default: "active",
            index: true,
        },
        rules: {
            roundCount: { type: Number, required: true },
            difficulty: {
                type: String,
                enum: ["easy", "normal", "hard", "expert"],
                required: true,
            },
            answerMode: { type: String, enum: ["free", "qcm", "mixed"], required: true },
            target: { type: String, enum: ["title", "artist", "both", "mixed"], required: true },
            roundDurationMs: { type: Number, required: true },
        },
        rounds: { type: [BlindTestRoundSchema], required: true },
        currentRound: { type: Number, default: 0 },
        score: { type: Number, default: 0 },
        currentStreak: { type: Number, default: 0 },
        bestStreak: { type: Number, default: 0 },
        completedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

BlindTestSessionSchema.index({ userId: 1, status: 1, updatedAt: -1 });
BlindTestSessionSchema.index({ blindTestId: 1, status: 1, score: -1, completedAt: 1 });
BlindTestSessionSchema.index({ userId: 1, blindTestId: 1, status: 1, score: -1 });

const BlindTestSession: any =
    models.BlindTestSession || model("BlindTestSession", BlindTestSessionSchema);

export default BlindTestSession;
