// apps/mobile/src/screens/UserProfileScreen.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    ActivityIndicator,
    TouchableOpacity,
    FlatList,
    RefreshControl,
} from "react-native";
import Constants from "expo-constants";

import PostCard from "../components/PostCard";
import { PostType } from "../components/PostCard/types";
import { useUser } from "../context/UserContext";

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

export default function UserProfileScreen({ route, navigation }: any) {
    const { userId } = route.params;

    const { me, toggleFollow, subscribe } = useUser();

    const [user, setUser] = useState<any>(null);

    const [posts, setPosts] = useState<PostType[]>([]);
    const [loadingInitial, setLoadingInitial] = useState(true);

    const [cursor, setCursor] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const LIMIT = 15;

    const isSelf = useMemo(() => {
        return me?._id?.toString?.() === userId?.toString?.();
    }, [me, userId]);

    const isFollowing = useMemo(() => {
        const list = me?.followingList || [];
        return list.some((id: any) => id?.toString?.() === userId?.toString?.());
    }, [me, userId]);

    /* -------------------- FETCH USER -------------------- */
    const fetchUser = useCallback(async () => {
        const res = await fetch(`${API_URL}/api/user/${userId}`);
        const json = await safeJson(res);

        if (!res.ok) {
            console.log("fetchUser error:", res.status, json);
            return;
        }

        setUser(json?.user ?? null);
    }, [userId]);

    /* -------------------- FETCH POSTS -------------------- */
    const fetchPosts = useCallback(async () => {
        const res = await fetch(`${API_URL}/api/posts/user/${userId}?limit=${LIMIT}`);
        const json = await safeJson(res);

        if (!res.ok) {
            console.log("fetchPosts error:", res.status, json);
            return;
        }

        setPosts(json?.posts || []);
        setCursor(json?.nextCursor || null);
        setHasMore(!!json?.nextCursor);
    }, [userId]);

    /* -------------------- INITIAL LOAD -------------------- */
    useEffect(() => {
        (async () => {
            setLoadingInitial(true);
            await Promise.all([fetchUser(), fetchPosts()]);
            setLoadingInitial(false);
        })();
    }, [fetchUser, fetchPosts]);

    /* -------------------- REALTIME SYNC (EVENT BUS) -------------------- */
    useEffect(() => {
        // Quand on follow/unfollow CE profil depuis n'importe où (liste, autre écran)
        // -> update le compteur followers ici
        const unsub = subscribe((event) => {
            if (event.type !== "FOLLOW_TOGGLED") return;
            if (event.targetId?.toString?.() !== userId?.toString?.()) return;

            setUser((prev: any) => {
                if (!prev) return prev;
                const delta = event.following ? 1 : -1;
                return {
                    ...prev,
                    followers: Math.max(0, (prev.followers || 0) + delta),
                };
            });
        });

        return unsub;
    }, [subscribe, userId]);

    /* -------------------- LOAD MORE -------------------- */
    const loadMore = useCallback(async () => {
        if (!cursor || loadingMore || !hasMore) return;

        try {
            setLoadingMore(true);

            const res = await fetch(
                `${API_URL}/api/posts/user/${userId}?limit=${LIMIT}&cursor=${encodeURIComponent(cursor)}`
            );
            const json = await safeJson(res);

            if (!res.ok) return;

            setPosts((prev) => [...prev, ...(json?.posts || [])]);
            setCursor(json?.nextCursor || null);
            setHasMore(!!json?.nextCursor);
        } finally {
            setLoadingMore(false);
        }
    }, [cursor, loadingMore, hasMore, userId]);

    /* -------------------- REFRESH -------------------- */
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([fetchUser(), fetchPosts()]);
        setRefreshing(false);
    }, [fetchUser, fetchPosts]);

    /* -------------------- FOLLOW / UNFOLLOW -------------------- */
    const handleFollowToggle = useCallback(async () => {
        if (isSelf) return;

        const r = await toggleFollow(userId);
        if (!r.ok) return;

        // ✅ Le "me" global se met à jour via UserContext
        // ✅ Le compteur followers du profil courant est mis à jour via l'event bus ci-dessus
    }, [isSelf, toggleFollow, userId]);

    if (loadingInitial || !user) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color="#9B5CFF" />
            </View>
        );
    }

    const Header = () => (
        <View>
            <Image
                source={{ uri: user.bannerUrl || "https://picsum.photos/600/200" }}
                style={styles.banner}
            />

            <Image
                source={{ uri: user.avatarUrl || "https://picsum.photos/200" }}
                style={styles.avatar}
            />

            <Text style={styles.pseudo}>{user.pseudo}</Text>
            <Text style={styles.bio}>{user.bio || "Aucune bio."}</Text>

            <View style={styles.statsRow}>
                <TouchableOpacity
                    style={styles.statBox}
                    onPress={() => navigation.push("FollowersList", { userId })}
                    activeOpacity={0.8}
                >
                    <Text style={styles.statNumber}>{user.followers || 0}</Text>
                    <Text style={styles.statLabel}>Followers</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.statBox}
                    onPress={() => navigation.push("FollowingList", { userId })}
                    activeOpacity={0.8}
                >
                    <Text style={styles.statNumber}>{user.following || 0}</Text>
                    <Text style={styles.statLabel}>Following</Text>
                </TouchableOpacity>

                <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{user.notesCount || 0}</Text>
                    <Text style={styles.statLabel}>Notes</Text>
                </View>
            </View>

            {!isSelf && (
                <TouchableOpacity
                    onPress={handleFollowToggle}
                    style={[styles.followBtn, isFollowing ? styles.following : styles.notFollowing]}
                    activeOpacity={0.85}
                >
                    <Text style={styles.followText}>{isFollowing ? "Ne plus suivre" : "Suivre"}</Text>
                </TouchableOpacity>
            )}

            <Text style={styles.sectionTitle}>Posts</Text>
        </View>
    );

    return (
        <FlatList
            ListHeaderComponent={Header}
            data={posts}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => <PostCard post={item} />}
            contentContainerStyle={{ paddingBottom: 60 }}
            style={{ backgroundColor: "#000" }}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
                loadingMore ? <ActivityIndicator color="#9B5CFF" style={{ marginVertical: 12 }} /> : null
            }
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9B5CFF" />
            }
        />
    );
}

const styles = StyleSheet.create({
    loading: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
    banner: { width: "100%", height: 160 },
    avatar: {
        width: 90,
        height: 90,
        borderRadius: 45,
        borderWidth: 3,
        borderColor: "#000",
        marginTop: -50,
        marginLeft: 20,
    },
    pseudo: { fontSize: 24, color: "#fff", fontWeight: "800", marginLeft: 20, marginTop: 10 },
    bio: { color: "#ccc", marginLeft: 20, marginRight: 20, marginTop: 8 },
    statsRow: {
        flexDirection: "row",
        justifyContent: "space-around",
        marginTop: 20,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: "#222",
    },
    statBox: { alignItems: "center" },
    statNumber: { color: "#fff", fontSize: 18, fontWeight: "700" },
    statLabel: { color: "#aaa", fontSize: 13, marginTop: 2 },

    followBtn: {
        alignSelf: "flex-start",
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 10,
        marginLeft: 20,
        marginTop: 14,
    },
    following: { backgroundColor: "#330000", borderWidth: 1, borderColor: "#FF4444" },
    notFollowing: { backgroundColor: "#5E17EB" },
    followText: { color: "#fff", fontWeight: "700" },

    sectionTitle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
        marginLeft: 20,
        marginTop: 26,
        marginBottom: 16,
    },
});