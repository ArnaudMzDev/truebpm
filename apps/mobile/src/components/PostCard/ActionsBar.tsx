// apps/mobile/src/components/PostCard/ActionsBar.tsx
import React from "react";
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

import { PostType } from "./types";

const localIP = Constants.expoConfig?.hostUri?.split(":")[0];
const API_URL = `http://${localIP}:3000`;

async function safeJson(res: Response): Promise<any | null> {
    const text = await res.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        console.log("Non-JSON response:", text.slice(0, 200));
        return null;
    }
}

type Props = {
    post: PostType;
    onLocalUpdate: (patch: Partial<PostType>) => void;
    onOpenComments: () => void;

    // ✅ NEW
    onShare?: () => void;
};

export default function ActionsBar({ post, onLocalUpdate, onOpenComments, onShare }: Props) {
    const [liking, setLiking] = React.useState(false);
    const [reposting, setReposting] = React.useState(false);

    const toggleLike = async () => {
        if (liking) return;
        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        setLiking(true);
        const prevLiked = !!post.likedByMe;
        const prevCount = post.likesCount ?? 0;

        // optimistic
        onLocalUpdate({
            likedByMe: !prevLiked,
            likesCount: Math.max(0, prevCount + (!prevLiked ? 1 : -1)),
        });

        try {
            const res = await fetch(`${API_URL}/api/posts/${post._id}/like`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            const json = await safeJson(res);
            if (!res.ok) {
                // rollback
                onLocalUpdate({ likedByMe: prevLiked, likesCount: prevCount });
                return;
            }

            if (typeof json?.likesCount === "number") {
                onLocalUpdate({ likesCount: json.likesCount, likedByMe: json?.status === "liked" });
            }
        } finally {
            setLiking(false);
        }
    };

    const toggleRepost = async () => {
        if (reposting) return;
        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        setReposting(true);

        const prev = !!post.repostedByMe;
        const prevCount = post.repostsCount ?? 0;

        // optimistic
        onLocalUpdate({
            repostedByMe: !prev,
            repostsCount: Math.max(0, prevCount + (!prev ? 1 : -1)),
        });

        try {
            const res = await fetch(`${API_URL}/api/posts/${post._id}/repost`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            const json = await safeJson(res);
            if (!res.ok) {
                onLocalUpdate({ repostedByMe: prev, repostsCount: prevCount });
                return;
            }

            if (typeof json?.repostsCount === "number") {
                onLocalUpdate({
                    repostsCount: json.repostsCount,
                    repostedByMe: json?.status === "reposted",
                });
            }
        } finally {
            setReposting(false);
        }
    };

    return (
        <View style={styles.row}>
            {/* ❤️ Like */}
            <TouchableOpacity style={styles.btn} onPress={toggleLike} activeOpacity={0.85}>
                {liking ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <Ionicons name={post.likedByMe ? "heart" : "heart-outline"} size={18} color={post.likedByMe ? "#ff4d6d" : "#fff"} />
                )}
                <Text style={styles.count}>{post.likesCount ?? 0}</Text>
            </TouchableOpacity>

            {/* 💬 Comments */}
            <TouchableOpacity style={styles.btn} onPress={onOpenComments} activeOpacity={0.85}>
                <Ionicons name="chatbubble-outline" size={18} color="#fff" />
                <Text style={styles.count}>{post.commentsCount ?? 0}</Text>
            </TouchableOpacity>

            {/* 🔁 Repost */}
            <TouchableOpacity style={styles.btn} onPress={toggleRepost} activeOpacity={0.85}>
                {reposting ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <Ionicons name={post.repostedByMe ? "repeat" : "repeat-outline"} size={18} color={post.repostedByMe ? "#9B5CFF" : "#fff"} />
                )}
                <Text style={styles.count}>{post.repostsCount ?? 0}</Text>
            </TouchableOpacity>

            {/* ✈️ Share (NEW) */}
            <TouchableOpacity
                style={[styles.btn, styles.shareBtn]}
                onPress={onShare}
                activeOpacity={0.85}
                disabled={!onShare}
            >
                <Ionicons name="paper-plane-outline" size={18} color="#fff" />
                <Text style={styles.shareText}>Partager</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        marginTop: 12,
    },
    btn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 12,
        backgroundColor: "#161616",
        borderWidth: 1,
        borderColor: "#222",
    },
    count: {
        color: "#fff",
        fontWeight: "800",
        fontSize: 12,
    },
    shareBtn: {
        marginLeft: "auto",
        backgroundColor: "#222",
        borderColor: "#2a2a2a",
        paddingHorizontal: 12,
    },
    shareText: {
        color: "#fff",
        fontWeight: "900",
        fontSize: 12,
    },
});