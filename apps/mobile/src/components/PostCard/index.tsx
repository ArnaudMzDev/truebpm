// apps/mobile/src/components/PostCard/index.tsx
import React, { useMemo, useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { PostType } from "./types";
import Header from "./Header";
import TrackInfo from "./TrackInfo";
import RatingSimple from "./RatingSimple";
import RatingMulti from "./RatingMulti";
import CommentBox from "./CommentBox";
import AudioPreview from "./AudioPreview";
import ActionsBar from "./ActionsBar";

type Props = { post: PostType };

export default function PostCard({ post }: Props) {
    const navigation = useNavigation<any>();
    const [localPost, setLocalPost] = useState<PostType>(post);

    const isSimple = localPost.mode === "general";

    const average = useMemo(() => {
        if (isSimple) return null;

        if (localPost.ratings && typeof localPost.ratings === "object") {
            const values = Object.values(localPost.ratings);
            if (!values.length) return null;
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            return Number(avg.toFixed(1));
        }

        const legacy = [localPost.prod, localPost.lyrics, localPost.emotion].filter((v) => typeof v === "number") as number[];
        if (!legacy.length) return null;

        const avg = legacy.reduce((a, b) => a + b, 0) / legacy.length;
        return Number(avg.toFixed(1));
    }, [localPost, isSimple]);

    const openDetail = () => navigation.push("PostDetail", { postId: localPost._id });

    return (
        <TouchableOpacity activeOpacity={0.95} onPress={openDetail}>
            <View style={styles.card}>
                <Header
                    pseudo={localPost.userId?.pseudo || "Utilisateur"}
                    avatarUrl={localPost.userId?.avatarUrl || ""}
                    createdAt={localPost.createdAt}
                    userId={localPost.userId?._id || ""}
                />

                <TrackInfo coverUrl={localPost.coverUrl} title={localPost.trackTitle} artist={localPost.artist} entityType={localPost.entityType} />

                {isSimple ? (
                    <RatingSimple rating={localPost.rating} />
                ) : (
                    <RatingMulti
                        entityType={localPost.entityType}
                        average={average}
                        ratings={localPost.ratings ?? null}
                        prod={localPost.prod ?? null}
                        lyrics={localPost.lyrics ?? null}
                        emotion={localPost.emotion ?? null}
                    />
                )}

                {localPost.comment?.trim().length ? <CommentBox text={localPost.comment} /> : null}

                <AudioPreview previewUrl={localPost.previewUrl} title={localPost.trackTitle} artist={localPost.artist} coverUrl={localPost.coverUrl} />

                <ActionsBar
                    post={localPost}
                    onLocalUpdate={(patch) => setLocalPost((p) => ({ ...p, ...patch }))}
                    onOpenComments={openDetail}
                />
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
});