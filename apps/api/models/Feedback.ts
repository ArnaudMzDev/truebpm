import { Schema, model, models } from "mongoose";

const FeedbackSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        area: {
            type: String,
            enum: ["home", "posting", "search", "profile", "messages", "admin", "overall"],
            default: "overall",
            index: true,
        },
        sentiment: {
            type: String,
            enum: ["love", "good", "mixed", "frustrated"],
            default: "good",
            index: true,
        },
        rating: { type: Number, min: 1, max: 5, default: 4, index: true },
        subject: { type: String, required: true, maxlength: 140 },
        message: { type: String, required: true, maxlength: 4000 },
        improvement: { type: String, default: "", maxlength: 4000 },
        contactAllowed: { type: Boolean, default: true },
        status: {
            type: String,
            enum: ["new", "reviewed", "planned", "done", "archived"],
            default: "new",
            index: true,
        },
        priority: {
            type: String,
            enum: ["normal", "high"],
            default: "normal",
            index: true,
        },
        userPseudo: { type: String, default: "", maxlength: 80 },
        userEmail: { type: String, default: "", maxlength: 180 },
        adminNote: { type: String, default: "", maxlength: 2000 },
        lastAdminId: { type: String, default: "" },
        reviewedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

FeedbackSchema.index({ status: 1, rating: 1, createdAt: -1 });
FeedbackSchema.index({ subject: "text", message: "text", improvement: "text", userPseudo: "text", userEmail: "text" }, {
    weights: { subject: 8, message: 5, improvement: 4, userPseudo: 3, userEmail: 3 },
    name: "feedback_text_search",
    default_language: "none",
});

const Feedback: any = models.Feedback || model("Feedback", FeedbackSchema);

export default Feedback;
