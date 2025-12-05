import { Schema, model, models } from "mongoose";

const UserSchema = new Schema(
    {
            pseudo: { type: String, required: true },
            email: { type: String, required: true, unique: true },
            password: { type: String, required: true },

            avatarUrl: { type: String, default: "" },
            bannerUrl: { type: String, default: "" },
            bio: { type: String, default: "" },

            followers: { type: Number, default: 0 },
            following: { type: Number, default: 0 },
            notesCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

export default models.User || model("User", UserSchema);