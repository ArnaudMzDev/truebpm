import { Schema, model, models } from "mongoose";

const FollowRequestSchema = new Schema(
    {
        requesterId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        targetUserId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: ["pending", "accepted", "declined"],
            default: "pending",
            index: true,
        },
    },
    { timestamps: true }
);

FollowRequestSchema.index(
    { requesterId: 1, targetUserId: 1 },
    { unique: true }
);

export default models.FollowRequest || model("FollowRequest", FollowRequestSchema);