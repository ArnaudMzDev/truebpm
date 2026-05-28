import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { PostType } from "./types";
import Header from "./Header";
import TrackInfo from "./TrackInfo";
import RatingSimple from "./RatingSimple";
import RatingMulti from "./RatingMulti";
import CommentBox from "./CommentBox";
import AudioPreview from "./AudioPreview";
import ActionsBar from "./ActionsBar";
import { useUser } from "../../context/UserContext";
import AppCard from "../ui/AppCard";
import { colors, spacing, radius, typography, fontWeights } from "../../theme";

type Props = {
    post: PostType;
    onDeleted?: (postId: string) => void;
    disableOpenDetail?: boolean;
};

function PostCard({
                      post,
                      onDeleted,
                      disableOpenDetail = false,
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

    const mainContent = useMemo(() => (
        <View style={styles.content}>
            <TrackInfo
                coverUrl={originalPost.coverUrl}
                title={originalPost.trackTitle}
                artist={originalPost.artist}
                entityType={originalPost.entityType}
            />

            <View style={styles.ratingWrap}>
                {isSimple ? (
                    <RatingSimple rating={originalPost.rating ?? null} />
                ) : (
                    <RatingMulti
                        entityType={originalPost.entityType}
                        average={average}
                        ratings={originalPost.ratings ?? null}
                        prod={originalPost.prod ?? null}
                        lyrics={originalPost.lyrics ?? null}
                        emotion={originalPost.emotion ?? null}
                    />
                )}
            </View>

            {originalPost.comment?.trim().length ? (
                <View style={styles.commentWrap}>
                    <CommentBox text={originalPost.comment} />
                </View>
            ) : null}

            <AudioPreview
                previewUrl={originalPost.previewUrl ?? null}
                title={originalPost.trackTitle ?? ""}
                artist={originalPost.artist ?? ""}
                coverUrl={originalPost.coverUrl ?? null}
            />
        </View>
    ), [
        originalPost.coverUrl,
        originalPost.trackTitle,
        originalPost.artist,
        originalPost.entityType,
        originalPost.rating,
        originalPost.ratings,
        originalPost.prod,
        originalPost.lyrics,
        originalPost.emotion,
        originalPost.comment,
        originalPost.previewUrl,
        isSimple,
        average,
    ]);

    return (
        <View style={styles.outer}>
            <AppCard style={styles.card}>
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

                {disableOpenDetail ? (
                    mainContent
                ) : (
                    <TouchableOpacity activeOpacity={0.94} onPress={openDetail}>
                        {mainContent}
                    </TouchableOpacity>
                )}

                <ActionsBar
                    post={socialPost}
                    onLocalUpdate={onLocalUpdate}
                    onOpenComments={openDetail}
                    onShare={onShare}
                />
            </AppCard>
        </View>
    );
}

export default React.memo(PostCard);

const styles = StyleSheet.create({
    outer: {
        width: "100%",
        marginBottom: spacing.lg,
    },

    card: {
        width: "100%",
        backgroundColor: colors.surfaceRaised,
        borderRadius: radius.xxl,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.borderSoft,
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
        marginTop: 0,
        width: "100%",
    },

    ratingWrap: {
        marginTop: 0,
        width: "100%",
    },

    commentWrap: {
        marginTop: spacing.sm,
        width: "100%",
    },
});
