import { Schema, model, models } from "mongoose";

const SupportTicketSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        category: {
            type: String,
            enum: ["bug", "abuse", "account", "legal", "other"],
            default: "other",
            index: true,
        },
        subject: { type: String, required: true, maxlength: 140 },
        message: { type: String, required: true, maxlength: 4000 },
        status: {
            type: String,
            enum: ["open", "in_review", "resolved", "closed"],
            default: "open",
            index: true,
        },
        priority: {
            type: String,
            enum: ["normal", "high", "urgent"],
            default: "normal",
            index: true,
        },
        userPseudo: { type: String, default: "", maxlength: 80 },
        userEmail: { type: String, default: "", maxlength: 180 },
        adminNote: { type: String, default: "", maxlength: 2000 },
        lastAdminId: { type: String, default: "" },
        resolvedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

SupportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });
SupportTicketSchema.index({ subject: "text", message: "text", userPseudo: "text", userEmail: "text" }, {
    weights: { subject: 8, message: 4, userPseudo: 3, userEmail: 3 },
    name: "support_ticket_text_search",
    default_language: "none",
});

const SupportTicket: any =
    models.SupportTicket || model("SupportTicket", SupportTicketSchema);

export default SupportTicket;
