import { Schema, model, models } from "mongoose";

const BlindTestTrackSchema = new Schema(
    {
        provider: { type: String, enum: ["apple", "deezer"], required: true },
        providerId: { type: String, required: true },
        storefront: { type: String, default: "fr" },
        title: { type: String, required: true },
        titleAliases: { type: [String], default: [] },
        artist: { type: String, required: true },
        artistAliases: { type: [String], default: [] },
        album: { type: String, default: "" },
        year: { type: Number, default: null },
        artworkUrl: { type: String, default: "" },
        previewUrl: { type: String, required: true },
        previewDurationMs: { type: Number, default: 30000 },
        territory: { type: String, default: "fr" },
        available: { type: Boolean, default: true, index: true },
        lastCheckedAt: { type: Date, default: Date.now },
        sourceCategories: { type: [String], default: [] },
    },
    { timestamps: true }
);

BlindTestTrackSchema.index(
    { provider: 1, providerId: 1, storefront: 1 },
    { unique: true, name: "blind_track_provider_identity" }
);
BlindTestTrackSchema.index({ available: 1, sourceCategories: 1, lastCheckedAt: -1 });

const BlindTestTrack: any =
    models.BlindTestTrack || model("BlindTestTrack", BlindTestTrackSchema);

export default BlindTestTrack;
