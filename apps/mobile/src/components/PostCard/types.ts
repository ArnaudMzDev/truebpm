export type EntityType = "song" | "album" | "artist";

export type PostUser = {
    _id: string;
    pseudo: string;
    avatarUrl?: string;
};

export type PostType = {
    _id: string;

    // auteur du post (pour un repost wrapper, c'est souvent le reposter si ton API met userId = reposter)
    userId?: PostUser;

    createdAt: string;

    mode: "general" | "multi";

    entityType?: EntityType;
    entityId?: string | null;

    trackTitle: string;
    artist: string;
    coverUrl?: string | null;
    previewUrl?: string | null;

    rating?: number | null;
    ratings?: Record<string, number> | null;

    // legacy
    prod?: number | null;
    lyrics?: number | null;
    emotion?: number | null;

    comment?: string;

    likesCount?: number;
    repostsCount?: number;
    commentsCount?: number;

    likedByMe?: boolean;
    repostedByMe?: boolean;

    // ✅ REPOST
    type?: "post" | "repost";
    repostOf?: PostType | null; // original
    repostedBy?: PostUser | null; // reposter (si ton API le renvoie)
    repostComment?: string;
};