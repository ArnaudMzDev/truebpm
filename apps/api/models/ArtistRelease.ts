import { Schema, model, models } from "mongoose";

const ArtistReleaseSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        artistId: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        artistName: {
            type: String,
            required: true,
            trim: true,
        },
        itemId: {
            type: String,
            required: true,
            trim: true,
        },
        itemType: {
            type: String,
            enum: ["song", "album"],
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        coverUrl: {
            type: String,
            default: "",
        },
        previewUrl: {
            type: String,
            default: "",
        },
        releaseDate: {
            type: String,
            default: "",
            index: true,
        },
        source: {
            type: String,
            default: "apple",
        },
        listenedAt: {
            type: Date,
            default: null,
            index: true,
        },
        notifiedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

ArtistReleaseSchema.index({ userId: 1, listenedAt: 1, releaseDate: -1 });
ArtistReleaseSchema.index({ userId: 1, itemId: 1 });
ArtistReleaseSchema.index(
    { userId: 1, artistId: 1, itemId: 1 },
    { unique: true, name: "unique_user_artist_release" }
);

const ArtistRelease: any =
    models.ArtistRelease || model("ArtistRelease", ArtistReleaseSchema);

export default ArtistRelease;
