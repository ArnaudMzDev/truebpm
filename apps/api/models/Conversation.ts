// apps/api/models/Conversation.ts (ou /src/models selon ton projet)
import { Schema, model, models } from "mongoose";

const ConversationSchema = new Schema(
    {
        isGroup: { type: Boolean, default: false },

        participants: {
            type: [{ type: Schema.Types.ObjectId, ref: "User" }],
            default: [],
            required: true,
        },

        participantsKey: { type: String, default: null },

        lastMessageAt: { type: Date, default: null },
        lastMessageText: { type: String, default: "" },
        lastMessageType: { type: String, enum: ["text", "post", "image", ""], default: "" },

        // ✅ readAt par userId (string)
        readAt: { type: Map, of: Date, default: {} },
    },
    { timestamps: true }
);

ConversationSchema.pre("validate", function (next) {
    // @ts-ignore
    const doc = this as any;

    if (doc.isGroup) {
        doc.participantsKey = null;
        return next();
    }

    const ids = (doc.participants || [])
        .map((x: any) => x?.toString?.())
        .filter(Boolean);

    if (ids.length === 2) {
        const sorted = [...ids].sort();
        doc.participantsKey = `${sorted[0]}:${sorted[1]}`;
    } else {
        doc.participantsKey = null;
    }

    next();
});

ConversationSchema.index(
    { participantsKey: 1 },
    {
        unique: true,
        partialFilterExpression: { participantsKey: { $type: "string" } },
        name: "participantsKey_unique_partial",
    }
);

ConversationSchema.index({ participants: 1, lastMessageAt: -1 });

export default models.Conversation || model("Conversation", ConversationSchema);