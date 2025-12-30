import { Schema, model, models } from "mongoose";

const UserSchema = new Schema(
    {
        pseudo: String,
        email: String,
        password: String,

        avatarUrl: { type: String, default: "" },
        bannerUrl: { type: String, default: "" },
        bio: { type: String, default: "" },

        followers: { type: Number, default: 0 },
        following: { type: Number, default: 0 },

        followersList: {
            type: [{ type: Schema.Types.ObjectId, ref: "User" }],
            default: [],
        },
        followingList: {
            type: [{ type: Schema.Types.ObjectId, ref: "User" }],
            default: [],
        },

        notesCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

UserSchema.index(
    { pseudo: "text", bio: "text" },
    {
        weights: { pseudo: 10, bio: 2 },
        name: "user_text_search",
        default_language: "none",
    }
);
export default models.User || model("User", UserSchema);