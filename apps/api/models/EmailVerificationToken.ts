import { Schema, model, models } from "mongoose";

const EmailVerificationTokenSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        email: { type: String, required: true, lowercase: true, trim: true, index: true },
        tokenHash: { type: String, required: true, unique: true, index: true },
        expiresAt: { type: Date, required: true },
        usedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

EmailVerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const EmailVerificationToken: any =
    models.EmailVerificationToken || model("EmailVerificationToken", EmailVerificationTokenSchema);

export default EmailVerificationToken;
