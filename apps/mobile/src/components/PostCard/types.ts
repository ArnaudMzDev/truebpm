export type EntityType = "song" | "album" | "artist";

export type PostUser = {
    _id: string;
    pseudo: string;
    avatarUrl?: string;
};

export type PostType = {
    _id: string;

    userId?: PostUser;
    createdAt: string;

    mode?: "general" | "multi";

    entityType?: EntityType;
    entityId?: string | null;

    trackTitle?: string;
    artist?: string;
    coverUrl?: string | null;
    previewUrl?: string | null;

    rating?: number | null;
    ratings?: Record<string, number> | null;

    prod?: number | null;
    lyrics?: number | null;
    emotion?: number | null;

    comment?: string;

    likesCount?: number;
    repostsCount?: number;
    commentsCount?: number;

    likedByMe?: boolean;
    repostedByMe?: boolean;

    type?: "post" | "repost";
    repostOf?: PostType | null;
    repostedBy?: PostUser | null;
    repostComment?: string;
};