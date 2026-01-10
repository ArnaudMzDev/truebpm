import { Schema, model, models } from "mongoose";

const MessageSchema = new Schema(
    {
        conversationId: {
            type: Schema.Types.ObjectId,
            ref: "Conversation",
            required: true,
            index: true,
        },

        senderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

        type: { type: String, enum: ["text", "post"], default: "text", index: true },

        // si type=text
        text: { type: String, default: "" },

        // si type=post
        postId: { type: Schema.Types.ObjectId, ref: "Post", default: null },

        // pour gérer l’ordre si besoin (sinon timestamps suffisent)
    },
    { timestamps: true }
);

MessageSchema.index({ conversationId: 1, _id: -1 });

export default models.Message || model("Message", MessageSchema);