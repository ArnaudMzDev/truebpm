import { Schema, model, models } from "mongoose";

const NotificationSchema = new Schema(
    {
        recipientId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        actorId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        type: {
            type: String,
            enum: ["follow", "like_post", "comment_post", "reply_comment", "repost_post"],
            required: true,
            index: true,
        },
        postId: {
            type: Schema.Types.ObjectId,
            ref: "Post",
            default: null,
        },
        commentId: {
            type: Schema.Types.ObjectId,
            ref: "Comment",
            default: null,
        },
        isRead: {
            type: Boolean,
            default: false,
            index: true,
        },
    },
    { timestamps: true }
);

NotificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, createdAt: -1 });

const Notification =
    models.Notification || model("Notification", NotificationSchema);

export default Notification;