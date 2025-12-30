import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { PostType } from "./types";
import Header from "./Header";
import TrackInfo from "./TrackInfo";
import RatingSimple from "./RatingSimple";
import RatingMulti from "./RatingMulti";
import CommentBox from "./CommentBox";
import AudioPreview from "./AudioPreview";

type Props = {
    post: PostType;
};

export default function PostCard({ post }: Props) {
    const isSimple = post.mode === "general";

    const average = useMemo(() => {
        if (isSimple) return null;

        if (post.ratings && typeof post.ratings === "object") {
            const values = Object.values(post.ratings);
            if (!values.length) return null;
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            return Number(avg.toFixed(1));
        }

        // legacy fallback
        const legacy = [post.prod, post.lyrics, post.emotion].filter(
            (v) => typeof v === "number"
        ) as number[];

        if (!legacy.length) return null;

        const avg = legacy.reduce((a, b) => a + b, 0) / legacy.length;
        return Number(avg.toFixed(1));
    }, [post, isSimple]);

    return (
        <View style={styles.card}>
            <Header
                pseudo={post.userId?.pseudo}
                avatarUrl={post.userId?.avatarUrl}
                createdAt={post.createdAt}
                userId={post.userId?._id}
            />

            <TrackInfo
                coverUrl={post.coverUrl}
                title={post.trackTitle}
                artist={post.artist}
                entityType={post.entityType}
            />

            {isSimple ? (
                <RatingSimple rating={post.rating} />
            ) : (
                <RatingMulti
                    entityType={post.entityType}
                    average={average}
                    ratings={post.ratings ?? null}
                    prod={post.prod ?? null}
                    lyrics={post.lyrics ?? null}
                    emotion={post.emotion ?? null}
                />
            )}

            {post.comment?.trim().length ? <CommentBox text={post.comment} /> : null}

            <AudioPreview
                previewUrl={post.previewUrl}
                title={post.trackTitle}
                artist={post.artist}
                coverUrl={post.coverUrl}
            />
        </View>
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