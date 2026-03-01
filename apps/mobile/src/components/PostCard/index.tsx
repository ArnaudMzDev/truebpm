// apps/mobile/src/components/PostCard/index.tsx
import React, { useMemo, useState, useCallback } from "react";
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

    const isRepost = localPost.type === "repost" && !!localPost.repostOf;

    // ✅ le post de référence (likes / reposts / commentaires)
    const basePost: PostType = (isRepost ? localPost.repostOf : localPost) as PostType;

    // ✅ reposter (pour le bandeau)
    const reposter = localPost.repostedBy ?? null;

    // ✅ droit de suppression : post normal + auteur = moi
    const canDelete =
        localPost.type !== "repost" &&
        !!me?._id &&
        localPost.userId?._id?.toString?.() === me._id?.toString?.();

    const isSimple = basePost.mode === "general";

    const average = useMemo(() => {
        if (isSimple) return null;

        if (basePost.ratings && typeof basePost.ratings === "object") {
            const values = Object.values(basePost.ratings);
            if (!values.length) return null;
            return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));
        }

        const legacy = [basePost.prod, basePost.lyrics, basePost.emotion].filter(
            (v) => typeof v === "number"
        ) as number[];

        if (!legacy.length) return null;

        return Number((legacy.reduce((a, b) => a + b, 0) / legacy.length).toFixed(1));
    }, [basePost, isSimple]);

    const openDetail = () => navigation.push("PostDetail", { postId: basePost._id });

    // ✅ patch local (likes / reposts)
    const onLocalUpdate = (patch: Partial<PostType>) => {
        setLocalPost((p) => {
            if (p.type === "repost" && p.repostOf) {
                return { ...p, repostOf: { ...p.repostOf, ...patch } };
            }
            return { ...p, ...patch };
        });
    };

    // ✅ Share: ouvre Messages -> Conversations avec sharePostId
    const onShare = useCallback(() => {
        if (!basePost?._id) return;

        navigation.navigate("Main", {
            screen: "Notifications", // tab Messages
            params: {
                screen: "Conversations",
                params: { sharePostId: basePost._id },
            },
        });
    }, [navigation, basePost?._id]);

    return (
        <TouchableOpacity activeOpacity={0.95} onPress={openDetail}>
            <View style={styles.card}>
                {/* 🔁 bandeau repost */}
                {isRepost && reposter ? (
                    <View style={styles.repostBanner}>
                        <Ionicons name="repeat" size={16} color="#9B5CFF" />
                        <Text style={styles.repostText}>
                            <Text style={styles.reposterName}>{reposter.pseudo}</Text>{" "}
                            a reposté
                        </Text>
                    </View>
                ) : null}

                {/* 💬 commentaire du repost */}
                {isRepost && localPost.repostComment?.trim()?.length ? (
                    <View style={{ marginBottom: 10 }}>
                        <CommentBox text={localPost.repostComment} />
                    </View>
                ) : null}

                <View style={isRepost ? styles.quoted : undefined}>
                    <Header
                        pseudo={basePost.userId?.pseudo || "Utilisateur"}
                        avatarUrl={basePost.userId?.avatarUrl || ""}
                        createdAt={basePost.createdAt}
                        userId={basePost.userId?._id || ""}
                        repostByPseudo={reposter?.pseudo}
                        repostByUserId={reposter?._id}
                        postId={localPost._id}
                        canDelete={canDelete}
                        onDeleted={(id) => onDeleted?.(id)}
                    />

                    <TrackInfo
                        coverUrl={basePost.coverUrl}
                        title={basePost.trackTitle}
                        artist={basePost.artist}
                        entityType={basePost.entityType}
                    />

                    {isSimple ? (
                        <RatingSimple rating={basePost.rating} />
                    ) : (
                        <RatingMulti
                            entityType={basePost.entityType}
                            average={average}
                            ratings={basePost.ratings ?? null}
                            prod={basePost.prod ?? null}
                            lyrics={basePost.lyrics ?? null}
                            emotion={basePost.emotion ?? null}
                        />
                    )}

                    {basePost.comment?.trim().length ? <CommentBox text={basePost.comment} /> : null}

                    <AudioPreview
                        previewUrl={basePost.previewUrl}
                        title={basePost.trackTitle}
                        artist={basePost.artist}
                        coverUrl={basePost.coverUrl}
                    />

                    <ActionsBar
                        post={basePost}
                        onLocalUpdate={onLocalUpdate}
                        onOpenComments={openDetail}
                        onShare={onShare} // ✅ NEW
                    />
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: "#111",
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#222",
        marginBottom: 16,
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
        borderWidth: 1,
        borderColor: "#1e1e1e",
        borderRadius: 14,
        padding: 12,
        backgroundColor: "#0d0d0d",
    },
});