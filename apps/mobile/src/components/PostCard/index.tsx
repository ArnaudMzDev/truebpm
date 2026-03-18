// apps/mobile/src/components/PostCard/index.tsx
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

type Props = {
    post: PostType;
    onDeleted?: (postId: string) => void;
};

export default function PostCard({ post, onDeleted }: Props) {
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
        localPost.userId?._id?.toString?.() === me._id?.toString?.();

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

    const openDetail = () => navigation.push("PostDetail", { postId: originalPost._id });

    const onLocalUpdate = (patch: Partial<PostType>) => {
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
    };

    const onShare = useCallback(() => {
        if (!originalPost?._id) return;

        navigation.navigate("Main", {
            screen: "Notifications",
            params: {
                screen: "Conversations",
                params: { sharePostId: originalPost._id },
            },
        });
    }, [navigation, originalPost?._id]);

    return (
        <View style={styles.outer}>
            <TouchableOpacity activeOpacity={0.95} onPress={openDetail}>
                <View style={styles.card}>
                    {isRepost && reposter ? (
                        <View style={styles.repostBanner}>
                            <Ionicons name="repeat" size={16} color="#9B5CFF" />
                            <Text style={styles.repostText}>
                                <Text style={styles.reposterName}>{reposter.pseudo}</Text> a reposté
                            </Text>
                        </View>
                    ) : null}

                    {isRepost && localPost.repostComment?.trim()?.length ? (
                        <View style={{ marginBottom: 10 }}>
                            <CommentBox text={localPost.repostComment} />
                        </View>
                    ) : null}

                    <View style={isRepost ? styles.quoted : undefined}>
                        <Header
                            pseudo={originalPost.userId?.pseudo || "Utilisateur"}
                            avatarUrl={originalPost.userId?.avatarUrl || ""}
                            createdAt={originalPost.createdAt}
                            userId={originalPost.userId?._id || ""}
                            repostByPseudo={reposter?.pseudo}
                            repostByUserId={reposter?._id}
                            postId={localPost._id}
                            canDelete={canDelete}
                            onDeleted={(id) => onDeleted?.(id)}
                        />

                        <TrackInfo
                            coverUrl={originalPost.coverUrl}
                            title={originalPost.trackTitle}
                            artist={originalPost.artist}
                            entityType={originalPost.entityType}
                        />

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

                        {originalPost.comment?.trim().length ? (
                            <CommentBox text={originalPost.comment} />
                        ) : null}


                        <AudioPreview
                            previewUrl={originalPost.previewUrl}
                            title={originalPost.trackTitle}
                            artist={originalPost.artist}
                            coverUrl={originalPost.coverUrl}
                        />

                        <ActionsBar
                            post={socialPost}
                            onLocalUpdate={onLocalUpdate}
                            onOpenComments={openDetail}
                            onShare={onShare}
                        />
                    </View>
                </View>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    outer: {
        width: "100%",
    },

    card: {
        width: "100%",
        backgroundColor: "#111",
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#222",
        marginBottom: 16,
        alignSelf: "stretch",
    },

    repostBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 10,
    },
    repostText: {
        color: "#bbb",
        fontWeight: "700",
        fontSize: 12,
    },
    reposterName: {
        color: "#fff",
        fontWeight: "900",
    },

    quoted: {
        width: "100%",
        borderWidth: 1,
        borderColor: "#1e1e1e",
        borderRadius: 14,
        padding: 12,
        backgroundColor: "#0d0d0d",
    },
});