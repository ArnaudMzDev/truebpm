import { Schema, model, models } from "mongoose";

const CommentSchema = new Schema(
    {
            postId: {
                    type: Schema.Types.ObjectId,
                    ref: "Post",
                    required: true,
                    index: true,
            },

            userId: {
                    type: Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                    index: true,
            },

            text: { type: String, required: true },

            // thread structure
            parentId: {
                    type: Schema.Types.ObjectId,
                    ref: "Comment",
                    default: null,
                    index: true,
            },

            // root comment of the thread (for fast "get thread replies")
            rootId: {
                    type: Schema.Types.ObjectId,
                    ref: "Comment",
                    default: null,
                    index: true,
            },

            // 0 for root comment, 1+ for replies
            depth: { type: Number, default: 0 },

            // "replying to @pseudo"
            replyToUserId: {
                    type: Schema.Types.ObjectId,
                    ref: "User",
                    default: null,
            },

            // counts
            directRepliesCount: { type: Number, default: 0 },
            repliesCount: { type: Number, default: 0 },

            // likes
            likes: {
                    type: [{ type: Schema.Types.ObjectId, ref: "User" }],
                    default: [],
            },
            likesCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

// helpful compound index for listing top-level comments quickly
CommentSchema.index({ postId: 1, parentId: 1, _id: -1 });
// helpful for thread pagination
CommentSchema.index({ rootId: 1, _id: -1 });

export default models.Comment || model("Comment", CommentSchema);