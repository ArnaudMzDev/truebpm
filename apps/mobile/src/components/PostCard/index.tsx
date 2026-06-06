import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { Image, View, StyleSheet, TouchableOpacity, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { EntityType, PostType } from "./types";
import Header from "./Header";
import CommentBox from "./CommentBox";
import AudioPreview from "./AudioPreview";
import ActionsBar from "./ActionsBar";
import { useUser } from "../../context/UserContext";
import { colors, spacing, radius, typography, fontWeights } from "../../theme";

type Props = {
    post: PostType;
    onDeleted?: (postId: string) => void;
    disableOpenDetail?: boolean;
    fullBleed?: boolean;
};

function formatRating(value: number | null | undefined) {
    if (typeof value !== "number" || Number.isNaN(value)) return null;
    return Number(value.toFixed(1)).toString();
}

function clampRating(value: number) {
    return Math.max(0, Math.min(5, value));
}

function getCriteriaLabel(entityType: EntityType | undefined, key: string) {
    const type = entityType ?? "song";

    const map: Record<EntityType, Record<string, string>> = {
        song: {
            prod: "Production",
            lyrics: "Paroles",
            emotion: "Émotion",
        },
        album: {
            cohesion: "Cohésion",
            production: "Production",
            originality: "Originalité",
        },
        artist: {
            identity: "Identité",
            consistency: "Régularité",
            impact: "Impact",
        },
    };

    return map[type]?.[key] ?? key;
}

function getFallbackIcon(entityType?: EntityType): keyof typeof Ionicons.glyphMap {
    if (entityType === "artist") return "person";
    if (entityType === "album") return "disc";
    return "musical-note";
}

function PostCard({
                      post,
                      onDeleted,
                      disableOpenDetail = false,
                      fullBleed = false,
                  }: Props) {
    const navigation = useNavigation<any>();
    const { me } = useUser();

    const [localPost, setLocalPost] = useState<PostType>(post);
    const lastPostIdRef = useRef(post._id);

    useEffect(() => {
        if (lastPostIdRef.current !== post._id) {
            lastPostIdRef.current = post._id;
            setLocalPost(post);
        } else {
            setLocalPost(post);
        }
    }, [post]);

    const isRepost = localPost.type === "repost" && !!localPost.repostOf;
    const originalPost: PostType = (isRepost ? localPost.repostOf : localPost) as PostType;
    const reposter = localPost.repostedBy ?? null;

    const socialPost: PostType = useMemo(() => {
        if (!isRepost || !localPost.repostOf) return localPost;

        return {
            ...localPost.repostOf,
            likesCount: localPost.likesCount ?? localPost.repostOf.likesCount ?? 0,
            repostsCount: localPost.repostsCount ?? localPost.repostOf.repostsCount ?? 0,
            commentsCount: localPost.commentsCount ?? localPost.repostOf.commentsCount ?? 0,
            likedByMe: localPost.likedByMe ?? localPost.repostOf.likedByMe ?? false,
            repostedByMe: localPost.repostedByMe ?? localPost.repostOf.repostedByMe ?? false,
        };
    }, [isRepost, localPost]);

    const canDelete =
        localPost.type !== "repost" &&
        !!me?._id &&
        !!localPost.userId?._id &&
        localPost.userId._id.toString() === me._id.toString();

    const isSimple = originalPost.mode === "general";

    const average = useMemo(() => {
        if (isSimple) return null;

        if (originalPost.ratings && typeof originalPost.ratings === "object") {
            const values = Object.values(originalPost.ratings);
            if (!values.length) return null;
            return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));
        }

        const legacy = [originalPost.prod, originalPost.lyrics, originalPost.emotion].filter(
            (v) => typeof v === "number"
        ) as number[];

        if (!legacy.length) return null;

        return Number((legacy.reduce((a, b) => a + b, 0) / legacy.length).toFixed(1));
    }, [originalPost, isSimple]);

    const ratingRows = useMemo(() => {
        if (isSimple) return [];

        if (originalPost.ratings && typeof originalPost.ratings === "object") {
            return Object.entries(originalPost.ratings)
                .filter(([, value]) => typeof value === "number")
                .map(([key, value]) => ({
                    key,
                    label: getCriteriaLabel(originalPost.entityType, key),
                    value: Number(value),
                }));
        }

        const legacy = [
            ["prod", originalPost.prod],
            ["lyrics", originalPost.lyrics],
            ["emotion", originalPost.emotion],
        ] as const;

        return legacy
            .filter(([, value]) => typeof value === "number")
            .map(([key, value]) => ({
                key,
                label: getCriteriaLabel(originalPost.entityType, key),
                value: Number(value),
            }));
    }, [
        isSimple,
        originalPost.entityType,
        originalPost.ratings,
        originalPost.prod,
        originalPost.lyrics,
        originalPost.emotion,
    ]);

    const openDetail = useCallback(() => {
        if (disableOpenDetail) return;
        if (!originalPost?._id) return;
        navigation.push("PostDetail", { postId: originalPost._id });
    }, [disableOpenDetail, navigation, originalPost?._id]);

    const onLocalUpdate = useCallback((patch: Partial<PostType>) => {
        setLocalPost((p) => {
            if (p.type === "repost" && p.repostOf) {
                return {
                    ...p,
                    ...patch,
                    repostOf: { ...p.repostOf, ...patch },
                };
            }

            return { ...p, ...patch };
        });
    }, []);

    const onShare = useCallback(() => {
        if (!originalPost?._id) return;

        navigation.navigate("Main", {
            screen: "MessagesTab",
            params: {
                screen: "Conversations",
                params: { sharePostId: originalPost._id },
            },
        });
    }, [navigation, originalPost?._id]);

    const handleHeaderDeleted = useCallback(
        (id: string) => {
            onDeleted?.(id);
        },
        [onDeleted]
    );

    const mainContent = useMemo(() => {
        const score = formatRating(isSimple ? originalPost.rating : average);
        const coverUrl = originalPost.coverUrl?.trim();
        const title = originalPost.trackTitle?.trim() || "Titre inconnu";
        const artist = originalPost.artist?.trim() || "Artiste inconnu";
        const comment = originalPost.comment?.trim();

        return (
            <View style={styles.content}>
                <View style={[styles.coverFrame, fullBleed && styles.coverFrameFullBleed]}>
                    {coverUrl ? (
                        <Image source={{ uri: coverUrl }} style={styles.coverImage} />
                    ) : (
                        <View style={styles.coverFallback}>
                            <Ionicons
                                name={getFallbackIcon(originalPost.entityType)}
                                size={44}
                                color={colors.primary}
                            />
                        </View>
                    )}

                    {score ? (
                        <View style={styles.scoreBadge}>
                            <Text style={styles.scoreValue}>{score}</Text>
                            <Text style={styles.scoreSuffix}>/5</Text>
                        </View>
                    ) : null}

                    <View style={styles.coverMeta}>
                        <Text style={styles.coverTitle} numberOfLines={2}>
                            {title}
                        </Text>
                        <Text style={styles.coverArtist} numberOfLines={1}>
                            {artist}
                        </Text>
                    </View>
                </View>

                <View style={fullBleed && styles.bodyChrome}>
                    {!isSimple && ratingRows.length ? (
                        <View style={styles.criteriaList}>
                            {ratingRows.map((row) => {
                                const value = clampRating(row.value);
                                const width = `${(value / 5) * 100}%` as `${number}%`;

                                return (
                                    <View key={row.key} style={styles.criteriaRow}>
                                        <Text style={styles.criteriaLabel} numberOfLines={1}>
                                            {row.label}
                                        </Text>

                                        <View style={styles.criteriaMeter}>
                                            <View style={[styles.criteriaFill, { width }]} />
                                        </View>

                                        <Text style={styles.criteriaValue}>{formatRating(value)}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    ) : null}

                    {comment ? (
                        <Text style={styles.reviewText}>{comment}</Text>
                    ) : null}

                    <AudioPreview
                        previewUrl={originalPost.previewUrl ?? null}
                        title={title}
                        artist={artist}
                        coverUrl={originalPost.coverUrl ?? null}
                    />
                </View>
            </View>
        );
    }, [
        originalPost.coverUrl,
        originalPost.trackTitle,
        originalPost.artist,
        originalPost.entityType,
        originalPost.rating,
        originalPost.comment,
        originalPost.previewUrl,
        isSimple,
        average,
        ratingRows,
        fullBleed,
    ]);

    return (
        <View style={styles.outer}>
            <View style={styles.card}>
                <View style={fullBleed && styles.bodyChrome}>
                    {isRepost && reposter ? (
                        <TouchableOpacity
                            style={styles.repostBanner}
                            activeOpacity={0.8}
                            onPress={() => {
                                if (reposter?._id) {
                                    navigation.navigate("UserProfile", { userId: reposter._id });
                                }
                            }}
                        >
                            <Ionicons name="repeat" size={14} color={colors.primary} />
                            <Text style={styles.repostText}>
                                <Text style={styles.reposterName}>{reposter.pseudo}</Text> a reposté
                            </Text>
                        </TouchableOpacity>
                    ) : null}

                    {isRepost && localPost.repostComment?.trim()?.length ? (
                        <View style={styles.repostCommentWrap}>
                            <CommentBox text={localPost.repostComment} />
                        </View>
                    ) : null}

                    <Header
                        pseudo={originalPost.userId?.pseudo || "Utilisateur"}
                        avatarUrl={originalPost.userId?.avatarUrl || ""}
                        createdAt={originalPost.createdAt}
                        userId={originalPost.userId?._id || ""}
                        repostByPseudo={reposter?.pseudo}
                        repostByUserId={reposter?._id}
                        postId={localPost._id}
                        canDelete={canDelete}
                        onDeleted={handleHeaderDeleted}
                    />
                </View>

                {disableOpenDetail ? (
                    mainContent
                ) : (
                    <TouchableOpacity activeOpacity={0.94} onPress={openDetail}>
                        {mainContent}
                    </TouchableOpacity>
                )}

                <View style={fullBleed && styles.bodyChrome}>
                    <ActionsBar
                        post={socialPost}
                        onLocalUpdate={onLocalUpdate}
                        onOpenComments={openDetail}
                        onShare={onShare}
                    />
                </View>
            </View>
        </View>
    );
}

export default React.memo(PostCard);

const styles = StyleSheet.create({
    outer: {
        width: "100%",
        marginBottom: spacing.lg,
        paddingBottom: spacing.xl,
        borderBottomWidth: 1,
        borderBottomColor: colors.separator,
    },

    card: {
        width: "100%",
        backgroundColor: "transparent",
    },

    bodyChrome: {
        paddingHorizontal: spacing.lg,
    },

    repostBanner: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: spacing.sm,
        marginBottom: spacing.md,
        backgroundColor: colors.primaryFaint,
        borderWidth: 1,
        borderColor: colors.borderAccent,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: 7,
    },

    repostText: {
        color: colors.textMuted,
        fontSize: typography.caption,
        fontWeight: fontWeights.bold,
    },

    reposterName: {
        color: colors.text,
        fontWeight: fontWeights.black,
    },

    repostCommentWrap: {
        marginBottom: spacing.sm,
        width: "100%",
    },

    content: {
        marginTop: spacing.sm,
        width: "100%",
    },

    coverFrame: {
        width: "100%",
        aspectRatio: 1,
        overflow: "hidden",
        borderRadius: 30,
        backgroundColor: colors.surfaceInset,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        shadowColor: "#000",
        shadowOpacity: 0.34,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 12 },
        elevation: 8,
    },

    coverFrameFullBleed: {
        borderWidth: 0,
        shadowOpacity: 0.22,
        elevation: 4,
    },

    coverImage: {
        width: "100%",
        height: "100%",
    },

    coverFallback: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surfaceEditorial,
    },

    scoreBadge: {
        position: "absolute",
        right: spacing.md,
        bottom: spacing.lg,
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "center",
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
    },

    scoreValue: {
        color: colors.text,
        fontSize: 42,
        lineHeight: 44,
        fontWeight: fontWeights.black,
        fontVariant: ["tabular-nums"],
        textShadowColor: "rgba(0, 0, 0, 0.72)",
        textShadowOffset: { width: 0, height: 3 },
        textShadowRadius: 10,
    },

    scoreSuffix: {
        marginLeft: 3,
        color: colors.primary,
        fontSize: typography.subtitle,
        lineHeight: 23,
        fontWeight: fontWeights.black,
        textShadowColor: "rgba(0, 0, 0, 0.72)",
        textShadowOffset: { width: 0, height: 3 },
        textShadowRadius: 10,
    },

    coverMeta: {
        position: "absolute",
        left: spacing.lg,
        right: 104,
        bottom: spacing.lg,
    },

    coverTitle: {
        color: colors.text,
        fontSize: 25,
        lineHeight: 29,
        fontWeight: fontWeights.black,
        letterSpacing: 0,
        textShadowColor: "rgba(0, 0, 0, 0.55)",
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
    },

    coverArtist: {
        marginTop: spacing.xs,
        color: colors.textSoft,
        fontSize: typography.body,
        lineHeight: 19,
        fontWeight: fontWeights.bold,
        textShadowColor: "rgba(0, 0, 0, 0.55)",
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
    },

    criteriaList: {
        width: "100%",
        marginTop: spacing.lg,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.separator,
        gap: spacing.md,
    },

    criteriaRow: {
        width: "100%",
        minHeight: 34,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
    },

    criteriaLabel: {
        width: 92,
        color: colors.textSoft,
        fontSize: typography.body,
        fontWeight: fontWeights.extraBold,
    },

    criteriaMeter: {
        flex: 1,
        height: 7,
        overflow: "hidden",
        borderRadius: radius.pill,
        backgroundColor: colors.surfacePressed,
    },

    criteriaFill: {
        height: "100%",
        borderRadius: radius.pill,
        backgroundColor: colors.primary,
    },

    criteriaValue: {
        width: 38,
        textAlign: "right",
        color: colors.text,
        fontSize: typography.body,
        fontWeight: fontWeights.black,
        fontVariant: ["tabular-nums"],
    },

    reviewText: {
        marginTop: spacing.lg,
        width: "100%",
        color: colors.textSoft,
        fontSize: typography.subtitle,
        lineHeight: 25,
        fontWeight: fontWeights.extraBold,
    },
});
