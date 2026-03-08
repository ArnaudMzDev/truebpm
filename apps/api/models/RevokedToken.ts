import mongoose from "mongoose";

const RevokedTokenSchema = new mongoose.Schema(
    {
        jti: { type: String, required: true, unique: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: "User" },
        exp: { type: Date, required: true, index: true }, // date d’expiration du JWT
    },
    { timestamps: true }
);

// TTL index : Mongo supprime automatiquement après expiration
RevokedTokenSchema.index({ exp: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.RevokedToken || mongoose.model("RevokedToken", RevokedTokenSchema);