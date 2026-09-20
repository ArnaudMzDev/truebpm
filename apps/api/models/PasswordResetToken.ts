import { Schema, model, models } from "mongoose";

const PasswordResetTokenSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        tokenHash: { type: String, required: true, unique: true, index: true },
        expiresAt: { type: Date, required: true },
        usedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PasswordResetToken: any =
    models.PasswordResetToken || model("PasswordResetToken", PasswordResetTokenSchema);

export default PasswordResetToken;
