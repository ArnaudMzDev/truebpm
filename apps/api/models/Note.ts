import { Schema, model, models } from "mongoose";

const NoteSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true,
        },

        text: {
            type: String,
            required: true,
            trim: true,
            maxlength: 60,
        },

        track: {
            entityId: { type: String, default: "" },
            entityType: {
                type: String,
                enum: ["song", "album", "artist", ""],
                default: "",
            },
            title: { type: String, default: "" },
            artist: { type: String, default: "" },
            coverUrl: { type: String, default: "" },
            previewUrl: { type: String, default: "" },
        },

        expiresAt: {
            type: Date,
            required: true,
            index: true,
        },
    },
    { timestamps: true }
);

// TTL: suppression auto quand expirée
NoteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// sécurité supplémentaire
NoteSchema.index({ userId: 1 }, { unique: true });

export default models.Note || model("Note", NoteSchema);