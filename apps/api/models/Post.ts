import { Schema, model, models } from "mongoose";

const PostSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        mode: {
            type: String,
            enum: ["general", "multi"],
            required: true,
        },

        trackTitle: { type: String, required: true },
        artist: { type: String, required: true },
        coverUrl: { type: String, default: null },

        rating: { type: Number, min: 0, max: 10, default: null },

        prod: { type: Number, min: 0, max: 10, default: null },
        lyrics: { type: Number, min: 0, max: 10, default: null },
        emotion: { type: Number, min: 0, max: 10, default: null },

        comment: { type: String, default: "" },
    },
    { timestamps: true }
);

export default models.Post || model("Post", PostSchema);