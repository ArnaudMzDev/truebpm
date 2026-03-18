import { Schema, model, models } from "mongoose";

const MusicRefSchema = new Schema(
    {
        entityId: { type: String, default: "" },
        entityType: {
            type: String,
            enum: ["song", "album", "artist"],
            required: true,
        },
        title: { type: String, default: "" },
        artist: { type: String, default: "" },
        coverUrl: { type: String, default: "" },
        previewUrl: { type: String, default: "" },
    },
    { _id: false }
);

const UserSchema = new Schema(
    {
        pseudo: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 30,
            index: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            index: true,
        },

        password: {
            type: String,
            required: true,
        },

        avatarUrl: {
            type: String,
            default: "",
        },

        bannerUrl: {
            type: String,
            default: "",
        },

        bio: {
            type: String,
            default: "",
            maxlength: 280,
        },

        followers: {
            type: Number,
            default: 0,
        },

        following: {
            type: Number,
            default: 0,
        },

        followersList: {
            type: [{ type: Schema.Types.ObjectId, ref: "User" }],
            default: [],
        },

        followingList: {
            type: [{ type: Schema.Types.ObjectId, ref: "User" }],
            default: [],
        },

        notesCount: {
            type: Number,
            default: 0,
        },

        isOnline: {
            type: Boolean,
            default: false,
            index: true,
        },

        lastSeenAt: {
            type: Date,
            default: null,
        },

        pinnedTrack: {
            type: MusicRefSchema,
            default: null,
        },

        favoriteArtists: {
            type: [MusicRefSchema],
            default: [],
        },

        favoriteAlbums: {
            type: [MusicRefSchema],
            default: [],
        },

        favoriteTracks: {
            type: [MusicRefSchema],
            default: [],
        },

        // ✅ CONFIDENTIALITÉ
        isPrivate: {
            type: Boolean,
            default: false,
            index: true,
        },

        messagePrivacy: {
            type: String,
            enum: ["everyone", "following"],
            default: "everyone",
        },
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