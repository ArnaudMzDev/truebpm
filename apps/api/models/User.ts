import { Schema, model, models } from "mongoose";

const MusicRefSchema = new Schema(
    {
        entityId: { type: String, default: "" },
        entityType: { type: String, enum: ["song", "album", "artist"], required: true },

        title: { type: String, default: "" },
        artist: { type: String, default: "" },

        coverUrl: { type: String, default: "" },
        previewUrl: { type: String, default: "" },
    },
    { _id: false }
);

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

        // présence
        isOnline: { type: Boolean, default: false, index: true },
        lastSeenAt: { type: Date, default: null },

        // ✅ profil musical
        pinnedTrack: { type: MusicRefSchema, default: null },

        favoriteArtists: {
            type: [MusicRefSchema],
            default: [],
            validate: {
                validator: (arr: any[]) => arr.length <= 3,
                message: "favoriteArtists cannot exceed 3 items",
            },
        },

        favoriteAlbums: {
            type: [MusicRefSchema],
            default: [],
            validate: {
                validator: (arr: any[]) => arr.length <= 3,
                message: "favoriteAlbums cannot exceed 3 items",
            },
        },

        favoriteTracks: {
            type: [MusicRefSchema],
            default: [],
            validate: {
                validator: (arr: any[]) => arr.length <= 3,
                message: "favoriteTracks cannot exceed 3 items",
            },
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