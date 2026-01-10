import { Schema, model, models } from "mongoose";

const ConversationSchema = new Schema(
    {
        isGroup: { type: Boolean, default: false },

        participants: {
            type: [{ type: Schema.Types.ObjectId, ref: "User" }],
            default: [],
            required: true,
        },

        // ✅ clé unique pour DM : "id1_id2" triés
        participantsKey: { type: String, required: true, unique: true },

        lastMessageAt: { type: Date, default: null },
        lastMessageText: { type: String, default: "" },
        lastMessageType: { type: String, enum: ["text", "post"], default: "text" },
    },
    { timestamps: true }
);

// (optionnel) index utile pour listing rapide
ConversationSchema.index({ lastMessageAt: -1 });

export default models.Conversation || model("Conversation", ConversationSchema);