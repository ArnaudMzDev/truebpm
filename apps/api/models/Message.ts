// apps/api/models/Message.ts
import { Schema, model, models } from "mongoose";

const MessageSchema = new Schema(
    {
        conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
        senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },

        type: { type: String, enum: ["text", "post", "image"], default: "text" },
        text: { type: String, default: "" },

        postId: { type: Schema.Types.ObjectId, ref: "Post", default: null },

        imageUrl: { type: String, default: "" },
        imageWidth: { type: Number, default: null },
        imageHeight: { type: Number, default: null },

        // ✅ statut simple
        status: { type: String, enum: ["sent", "delivered"], default: "sent" },
    },
    { timestamps: true }
);

MessageSchema.index({ conversationId: 1, _id: -1 });

export default models.Message || model("Message", MessageSchema);