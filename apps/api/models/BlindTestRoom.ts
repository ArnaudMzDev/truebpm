import { Schema, model, models } from "mongoose";

const RoomPlayerSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        pseudo: { type: String, required: true },
        avatarUrl: { type: String, default: "" },
        role: { type: String, enum: ["player", "spectator"], default: "player" },
        ready: { type: Boolean, default: false },
        connected: { type: Boolean, default: false },
        joinedAt: { type: Date, default: Date.now },
        lastSeenAt: { type: Date, default: Date.now },
        score: { type: Number, default: 0 },
        streak: { type: Number, default: 0 },
        answeredRound: { type: Number, default: -1 },
    },
    { _id: false }
);

const RoomRoundSchema = new Schema(
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
    },
    { _id: false }
);

const BlindTestRoomSchema = new Schema(
    {
        code: { type: String, required: true, unique: true, index: true },
        hostId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        blindTestId: { type: Schema.Types.ObjectId, ref: "BlindTest", required: true, index: true },
        blindTestSlug: { type: String, required: true, index: true },
        blindTestTitle: { type: String, required: true },
        blindTestCoverUrl: { type: String, default: "" },
        status: {
            type: String,
            enum: ["lobby", "starting", "active", "completed", "expired", "cancelled"],
            default: "lobby",
            index: true,
        },
        settings: {
            roundCount: { type: Number, required: true },
            difficulty: {
                type: String,
                enum: ["easy", "normal", "hard", "expert"],
                required: true,
            },
            answerMode: { type: String, enum: ["free", "qcm", "mixed"], required: true },
            target: { type: String, enum: ["title", "artist", "both", "mixed"], required: true },
            roundDurationMs: { type: Number, required: true },
            maxPlayers: { type: Number, min: 2, max: 8, default: 6 },
            allowSpectators: { type: Boolean, default: false },
            hintsEnabled: { type: Boolean, default: true },
            region: { type: String, enum: ["france", "international", "mixed"], default: "mixed" },
            playMode: { type: String, enum: ["casual", "competitive"], default: "casual" },
        },
        players: { type: [RoomPlayerSchema], default: [] },
        rounds: { type: [RoomRoundSchema], default: [] },
        currentRound: { type: Number, default: 0 },
        startedAt: { type: Date, default: null },
        completedAt: { type: Date, default: null },
        expiresAt: { type: Date, required: true },
    },
    { timestamps: true }
);

BlindTestRoomSchema.index({ status: 1, updatedAt: -1 });
BlindTestRoomSchema.index({ hostId: 1, status: 1, updatedAt: -1 });
BlindTestRoomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "blind_room_expiry" });

const BlindTestRoom: any =
    models.BlindTestRoom || model("BlindTestRoom", BlindTestRoomSchema);

export default BlindTestRoom;
