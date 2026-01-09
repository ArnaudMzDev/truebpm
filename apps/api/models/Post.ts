// apps/api/models/Post.ts
import { Schema, model, models } from "mongoose";

const PostSchema = new Schema(
    {
            userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

            entityType: { type: String, enum: ["song", "album", "artist"], default: "song" },
            entityId: { type: String, default: null },

            trackTitle: { type: String, required: true },
            artist: { type: String, required: true },

            coverUrl: { type: String, default: null },
            previewUrl: { type: String, default: null },

            mode: { type: String, enum: ["general", "multi"], required: true },
            rating: { type: Number, min: 1, max: 5, default: null },
            ratings: { type: Map, of: Number, default: {} },

            comment: { type: String, default: "" },

            // ✅ SOCIAL
            likes: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
            likesCount: { type: Number, default: 0 },

            reposts: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
            repostsCount: { type: Number, default: 0 },

            commentsCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

export default models.Post || model("Post", PostSchema);