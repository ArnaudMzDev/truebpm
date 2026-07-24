import { Schema, model, models } from "mongoose";

const BlindTestSchema = new Schema(
    {
        slug: { type: String, required: true, unique: true, index: true },
        title: { type: String, required: true },
        description: { type: String, default: "" },
        coverUrl: { type: String, default: "" },
        difficulty: {
            type: String,
            enum: ["easy", "normal", "hard", "expert"],
            default: "normal",
        },
        region: { type: String, enum: ["france", "international", "mixed"], default: "mixed" },
        tags: { type: [String], default: [] },
        source: {
            provider: { type: String, enum: ["apple", "deezer"], required: true },
            storefront: { type: String, default: "fr" },
            chartId: { type: Number, default: 0 },
        },
        supportedRoundCounts: { type: [Number], default: [5, 10, 20, 30] },
        active: { type: Boolean, default: true, index: true },
        featured: { type: Boolean, default: false, index: true },
        gamesCount: { type: Number, default: 0 },
        scoreTotal: { type: Number, default: 0 },
        bestScore: { type: Number, default: 0 },
    },
    { timestamps: true }
);

BlindTestSchema.index({ active: 1, featured: -1, gamesCount: -1 });

const BlindTest: any = models.BlindTest || model("BlindTest", BlindTestSchema);

export default BlindTest;
