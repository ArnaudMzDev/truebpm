// apps/api/models/Post.ts
import { Schema, model, models } from "mongoose";

const PostSchema = new Schema(
    {
        // ✅ auteur du contenu affiché dans le feed
        // - type="post"  => auteur du post
        // - type="repost"=> auteur = reposter
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

        // ✅ Type du document
        type: { type: String, enum: ["post", "repost"], default: "post", index: true },

        // ✅ Repost wrapper
        repostOf: {
            type: Schema.Types.ObjectId,
            ref: "Post",
            default: null,
            index: true,
            required: function (this: any) {
                return this.type === "repost";
            },
        },

        // Optionnel (mais pratique pour l’UI / populate)
        repostedBy: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },

        // Message optionnel du repost (si tu veux "quote repost")
        repostComment: { type: String, default: "" },

        /* ------------------------------------------------------------------ */
        /*                          POST ORIGINAL (type="post")                 */
        /* ------------------------------------------------------------------ */

        entityType: {
            type: String,
            enum: ["song", "album", "artist"],
            default: "song",
            required: function (this: any) {
                return this.type === "post";
            },
        },
        entityId: { type: String, default: null },

        trackTitle: {
            type: String,
            required: function (this: any) {
                return this.type === "post";
            },
        },
        artist: {
            type: String,
            required: function (this: any) {
                return this.type === "post";
            },
        },

        coverUrl: { type: String, default: null },
        previewUrl: { type: String, default: null },

        mode: {
            type: String,
            enum: ["general", "multi"],
            required: function (this: any) {
                return this.type === "post";
            },
        },

        rating: { type: Number, min: 1, max: 5, default: null },
        ratings: { type: Map, of: Number, default: {} },

        comment: { type: String, default: "" },

        /* ------------------------------------------------------------------ */
        /*                               SOCIAL                                */
        /* ------------------------------------------------------------------ */
        likes: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
        likesCount: { type: Number, default: 0 },

        // ⚠️ Tu peux garder ça si tu veux "repost direct" sur le post original
        // mais si tu utilises le wrapper type="repost", tu peux te contenter du count.
        reposts: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
        repostsCount: { type: Number, default: 0 },

        commentsCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

/**
 * ✅ Auto-fill repostedBy pour rester cohérent
 */
PostSchema.pre("validate", function (next) {
    // @ts-ignore
    if (this.type === "repost") {
        // @ts-ignore
        if (!this.repostedBy) {
            // @ts-ignore
            this.repostedBy = this.userId;
        }
    } else {
        // @ts-ignore
        this.repostOf = null;
        // @ts-ignore
        this.repostedBy = null;
        // @ts-ignore
        this.repostComment = this.repostComment || "";
    }
    next();
});

/**
 * ✅ Empêche un user de repost 2 fois le même post
 * (index unique seulement quand type="repost")
 */
PostSchema.index(
    { type: 1, repostOf: 1, repostedBy: 1 },
    {
        unique: true,
        partialFilterExpression: { type: "repost" },
    }
);

export default models.Post || model("Post", PostSchema);