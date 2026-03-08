import { Schema, model, models } from "mongoose";

const PushTokenSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        token: {
            type: String,
            required: true,
            index: true,
        },
        platform: {
            type: String,
            enum: ["ios", "android", "unknown"],
            default: "unknown",
        },
        deviceName: {
            type: String,
            default: "",
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
        lastSeenAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

PushTokenSchema.index({ userId: 1, token: 1 }, { unique: true });

export default models.PushToken || model("PushToken", PushTokenSchema);