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
            default: null,
        },
        type: {
            type: String,
            enum: [
                "follow",
                "follow_request",
                "follow_accept",
                "like_post",
                "comment_post",
                "reply_comment",
                "like_comment",
                "repost_post",
                "like_note",
                "new_post",
                "new_note",
                "same_entity_post",
                "artist_release",
            ],
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
        metadata: {
            type: Schema.Types.Mixed,
            default: {},
        },
    },
    { timestamps: true }
);

NotificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, createdAt: -1 });

const Notification: any =
    models.Notification || model("Notification", NotificationSchema);

export default Notification;
