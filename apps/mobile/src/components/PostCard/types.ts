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

    mode: "general" | "multi";

    entityType?: EntityType;
    entityId?: string | null;

    trackTitle: string;
    artist: string;
    coverUrl?: string | null;
    previewUrl?: string | null;

    rating?: number | null; // simple /5

    // new dynamic multi
    ratings?: Record<string, number> | null;

    // legacy multi (old schema)
    prod?: number | null;
    lyrics?: number | null;
    emotion?: number | null;

    comment?: string;
};