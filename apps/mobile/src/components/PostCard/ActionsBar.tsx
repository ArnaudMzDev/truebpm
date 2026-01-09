import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { PostType } from "./types";

const localIP = Constants.expoConfig?.hostUri?.split(":")[0];
const API_URL = `http://${localIP}:3000`;

type Props = {
    post: PostType;
    onLocalUpdate?: (patch: Partial<PostType>) => void;
    onOpenComments?: () => void;
};

export default function ActionsBar({ post, onLocalUpdate, onOpenComments }: Props) {
    const [loadingLike, setLoadingLike] = useState(false);
    const [loadingRepost, setLoadingRepost] = useState(false);

    const liked = !!post.likedByMe;
    const reposted = !!post.repostedByMe;

    const likeIcon = useMemo(() => (liked ? "heart" : "heart-outline"), [liked]);
    const repostIcon = useMemo(() => (reposted ? "repeat" : "repeat-outline"), [reposted]);

    const toggleLike = async () => {
        if (loadingLike) return;
        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        try {
            setLoadingLike(true);

            // optimistic
            onLocalUpdate?.({
                likedByMe: !liked,
                likesCount: Math.max(0, (post.likesCount || 0) + (!liked ? 1 : -1)),
            });

            const res = await fetch(`${API_URL}/api/posts/${post._id}/like`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            const json = await res.json().catch(() => null);
            if (!res.ok) {
                // rollback (simple)
                onLocalUpdate?.({
                    likedByMe: liked,
                    likesCount: post.likesCount || 0,
                });
                return;
            }

            onLocalUpdate?.({
                likedByMe: json?.status === "liked",
                likesCount: typeof json?.likesCount === "number" ? json.likesCount : post.likesCount,
            });
        } finally {
            setLoadingLike(false);
        }
    };

    const toggleRepost = async () => {
        if (loadingRepost) return;
        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        try {
            setLoadingRepost(true);

            onLocalUpdate?.({
                repostedByMe: !reposted,
                repostsCount: Math.max(0, (post.repostsCount || 0) + (!reposted ? 1 : -1)),
            });

            const res = await fetch(`${API_URL}/api/posts/${post._id}/repost`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            const json = await res.json().catch(() => null);
            if (!res.ok) {
                onLocalUpdate?.({
                    repostedByMe: reposted,
                    repostsCount: post.repostsCount || 0,
                });
                return;
            }

            onLocalUpdate?.({
                repostedByMe: json?.status === "reposted",
                repostsCount: typeof json?.repostsCount === "number" ? json.repostsCount : post.repostsCount,
            });
        } finally {
            setLoadingRepost(false);
        }
    };

    return (
        <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={toggleLike} activeOpacity={0.8}>
                <Ionicons name={likeIcon as any} size={18} color={liked ? "#ff4d6d" : "#bbb"} />
                <Text style={styles.count}>{post.likesCount ?? 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btn} onPress={toggleRepost} activeOpacity={0.8}>
                <Ionicons name={repostIcon as any} size={18} color={reposted ? "#9B5CFF" : "#bbb"} />
                <Text style={styles.count}>{post.repostsCount ?? 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btn} onPress={onOpenComments} activeOpacity={0.8}>
                <Ionicons name={"chatbubble-outline"} size={18} color={"#bbb"} />
                <Text style={styles.count}>{post.commentsCount ?? 0}</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", marginTop: 12 },
    btn: { flexDirection: "row", alignItems: "center", marginRight: 18 },
    count: { color: "#bbb", marginLeft: 6, fontSize: 13, fontWeight: "600" },
});