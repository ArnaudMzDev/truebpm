import { Schema, model, models } from "mongoose";

const PostSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        /* -------------------- ENTITY -------------------- */
        entityType: {
            type: String,
            enum: ["song", "album", "artist"],
            default: "song",
        },

        entityId: {
            type: String,
            default: null, // Apple Music / iTunes id
        },

        /* -------------------- DISPLAY INFO -------------------- */
        trackTitle: {
            type: String,
            required: true,
        },

        artist: {
            type: String,
            required: true,
        },

        coverUrl: {
            type: String,
            default: null,
        },

        /* -------------------- RATING MODE -------------------- */
        mode: {
            type: String,
            enum: ["general", "multi"],
            required: true,
        },

        // Note simple /5
        rating: {
            type: Number,
            min: 1,
            max: 5,
            default: null,
        },

        // Multi-critères dynamique
        ratings: {
            type: Map,
            of: Number,
            default: {},
        },

        /* -------------------- CONTENT -------------------- */
        comment: {
            type: String,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

export default models.Post || model("Post", PostSchema);