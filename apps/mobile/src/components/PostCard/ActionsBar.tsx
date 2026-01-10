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

async function safeJson(res: Response) {
    const txt = await res.text().catch(() => "");
    if (!txt) return null;
    try {
        return JSON.parse(txt);
    } catch {
        console.log("Non-JSON response:", txt.slice(0, 200));
        return null;
    }
}

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

        // snapshot au clic (évite les valeurs “qui bougent” pendant l’attente)
        const wasLiked = !!post.likedByMe;
        const wasCount = post.likesCount ?? 0;

        const optimisticLiked = !wasLiked;
        const optimisticCount = Math.max(0, wasCount + (optimisticLiked ? 1 : -1));

        try {
            setLoadingLike(true);

            // optimistic
            onLocalUpdate?.({
                likedByMe: optimisticLiked,
                likesCount: optimisticCount,
            });

            const res = await fetch(`${API_URL}/api/posts/${post._id}/like`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            const json = await safeJson(res);

            if (!res.ok) {
                // rollback
                onLocalUpdate?.({ likedByMe: wasLiked, likesCount: wasCount });
                return;
            }

            // ✅ robuste: si le serveur renvoie status/likesCount on prend, sinon on garde l'optimiste
            const serverLiked =
                json?.status === "liked" ? true : json?.status === "unliked" ? false : optimisticLiked;

            const serverCount =
                typeof json?.likesCount === "number" ? json.likesCount : optimisticCount;

            onLocalUpdate?.({ likedByMe: serverLiked, likesCount: serverCount });
        } finally {
            setLoadingLike(false);
        }
    };

    const toggleRepost = async () => {
        if (loadingRepost) return;

        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        const wasReposted = !!post.repostedByMe;
        const wasCount = post.repostsCount ?? 0;

        const optimisticReposted = !wasReposted;
        const optimisticCount = Math.max(0, wasCount + (optimisticReposted ? 1 : -1));

        try {
            setLoadingRepost(true);

            onLocalUpdate?.({
                repostedByMe: optimisticReposted,
                repostsCount: optimisticCount,
            });

            const res = await fetch(`${API_URL}/api/posts/${post._id}/repost`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            const json = await safeJson(res);

            if (!res.ok) {
                onLocalUpdate?.({ repostedByMe: wasReposted, repostsCount: wasCount });
                return;
            }

            // ✅ TON API peut renvoyer:
            // - { status: "reposted" | "unreposted", repostsCount }
            // - ou { success: true, post: {...} } (pas de status)
            const serverReposted =
                json?.status === "reposted"
                    ? true
                    : json?.status === "unreposted"
                        ? false
                        : optimisticReposted;

            const serverCount =
                typeof json?.repostsCount === "number"
                    ? json.repostsCount
                    : typeof json?.post?.repostsCount === "number"
                        ? json.post.repostsCount
                        : optimisticCount;

            onLocalUpdate?.({
                repostedByMe: serverReposted,
                repostsCount: serverCount,
            });
        } finally {
            setLoadingRepost(false);
        }
    };

    return (
        <View style={styles.row}>
            <TouchableOpacity
                style={styles.btn}
                onPress={toggleLike}
                activeOpacity={0.8}
                disabled={loadingLike}
            >
                <Ionicons name={likeIcon as any} size={18} color={liked ? "#ff4d6d" : "#bbb"} />
                <Text style={styles.count}>{post.likesCount ?? 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.btn}
                onPress={toggleRepost}
                activeOpacity={0.8}
                disabled={loadingRepost}
            >
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