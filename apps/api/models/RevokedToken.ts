import { Schema, model, models } from "mongoose";

const RevokedTokenSchema = new Schema(
    {
        token: { type: String, required: true, unique: true },
        exp: { type: Date, required: true },
    },
    { timestamps: true }
);

RevokedTokenSchema.index({ exp: 1 }, { expireAfterSeconds: 0 });

const RevokedToken =
    models.RevokedToken || model("RevokedToken", RevokedTokenSchema);

export default RevokedToken;