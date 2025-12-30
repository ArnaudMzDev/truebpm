import React, { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    FlatList,
    RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useFocusEffect } from "@react-navigation/native";

import PostCard from "../components/PostCard";
import { PostType } from "../components/PostCard/types";

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

export default function ProfileScreen({ navigation }: any) {
    const [user, setUser] = useState<any>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [posts, setPosts] = useState<PostType[]>([]);
    const [initialLoadingPosts, setInitialLoadingPosts] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);

    const LIMIT = 15;

    const handleLogout = useCallback(async () => {
        await AsyncStorage.multiRemove(["token", "user"]);
        navigation.replace("Login");
    }, [navigation]);

    const fetchMe = useCallback(async () => {
        const token = await AsyncStorage.getItem("token");
        if (!token) {
            await handleLogout();
            return null;
        }

        const res = await fetch(`${API_URL}/api/user/me`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
        });

        const json = await safeJson(res);

        if (!res.ok || !json?.user?._id) {
            await handleLogout();
            return null;
        }

        setUser(json.user);
        await AsyncStorage.setItem("user", JSON.stringify(json.user));
        return json.user;
    }, [handleLogout]);

    const fetchInitialPosts = useCallback(async (uid: string) => {
        try {
            setInitialLoadingPosts(true);
            setCursor(null);
            setHasMore(true);

            const res = await fetch(
                `${API_URL}/api/posts?userId=${encodeURIComponent(uid)}&limit=${LIMIT}`
            );
            const json = await safeJson(res);

            if (!res.ok) return;

            setPosts(json?.posts || []);
            setCursor(json?.nextCursor || null);
            setHasMore(!!json?.nextCursor);
        } catch (err) {
            console.log(err);
        } finally {
            setInitialLoadingPosts(false);
        }
    }, []);

    const loadMore = useCallback(async () => {
        if (!user?._id) return;
        if (!cursor || loadingMore || !hasMore) return;

        try {
            setLoadingMore(true);

            const res = await fetch(
                `${API_URL}/api/posts?userId=${encodeURIComponent(
                    user._id
                )}&limit=${LIMIT}&cursor=${encodeURIComponent(cursor)}`
            );
            const json = await safeJson(res);

            if (!res.ok) return;

            const newPosts = json?.posts || [];
            setPosts((prev) => [...prev, ...newPosts]);

            setCursor(json?.nextCursor || null);
            setHasMore(!!json?.nextCursor);
        } catch (err) {
            console.log(err);
        } finally {
            setLoadingMore(false);
        }
    }, [user, cursor, loadingMore, hasMore]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        const me = await fetchMe();
        if (me?._id) await fetchInitialPosts(me._id);
        setRefreshing(false);
    }, [fetchMe, fetchInitialPosts]);

    useEffect(() => {
        (async () => {
            setLoadingUser(true);

            const stored = await AsyncStorage.getItem("user");
            if (stored) {
                try {
                    const cached = JSON.parse(stored);
                    if (cached?._id) setUser(cached);
                } catch {}
            }

            const me = await fetchMe();
            setLoadingUser(false);

            if (me?._id) await fetchInitialPosts(me._id);
            else setInitialLoadingPosts(false);
        })();
    }, [fetchMe, fetchInitialPosts]);

    useFocusEffect(
        useCallback(() => {
            (async () => {
                const me = await fetchMe();
                if (me?._id) await fetchInitialPosts(me._id);
            })();
        }, [fetchMe, fetchInitialPosts])
    );

    if (loadingUser || !user || (initialLoadingPosts && posts.length === 0)) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color="#9B5CFF" />
            </View>
        );
    }

    const Header = () => (
        <View style={{ width: "100%" }}>
            <View style={styles.bannerBox}>
                <Image
                    source={{ uri: user.bannerUrl || "https://picsum.photos/600/200" }}
                    style={styles.banner}
                />
            </View>

            <View style={styles.buttonsRow}>
                <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => navigation.navigate("EditProfile")}
                >
                    <Text style={styles.editText}>Modifier</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Text style={styles.logoutIcon}>⏻</Text>
                </TouchableOpacity>
            </View>

            <Image
                source={{ uri: user.avatarUrl || "https://picsum.photos/200" }}
                style={[styles.avatar, styles.avatarGlow]}
            />

            <Text style={styles.pseudo}>{user.pseudo}</Text>
            <Text style={styles.bio}>{user.bio || "Aucune bio."}</Text>

            {/* ✅ STATS CLIQUABLES (zones larges) */}
            <View style={styles.stats}>
                <TouchableOpacity
                    style={styles.statBtn}
                    onPress={() => navigation.navigate("FollowersList", { userId: user._id })}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Text style={styles.statNumber} pointerEvents="none">
                        {user.followers || 0}
                    </Text>
                    <Text style={styles.statLabel} pointerEvents="none">
                        Followers
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.statBtn}
                    onPress={() => navigation.navigate("FollowingList", { userId: user._id })}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Text style={styles.statNumber} pointerEvents="none">
                        {user.following || 0}
                    </Text>
                    <Text style={styles.statLabel} pointerEvents="none">
                        Following
                    </Text>
                </TouchableOpacity>

                <View style={styles.statBtn}>
                    <Text style={styles.statNumber}>{user.notesCount || 0}</Text>
                    <Text style={styles.statLabel}>Notes</Text>
                </View>
            </View>

            <Text style={styles.postsTitle}>Mes posts</Text>
        </View>
    );

    return (
        <FlatList
            data={posts}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => <PostCard post={item} />}
            ListHeaderComponent={Header}
            contentContainerStyle={{ paddingBottom: 40 }}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9B5CFF" />
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
                loadingMore ? (
                    <ActivityIndicator size="small" color="#9B5CFF" style={{ marginVertical: 16 }} />
                ) : null
            }
            style={{ flex: 1, backgroundColor: "#000" }}
        />
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
    },
    bannerBox: { width: "100%", height: 160, backgroundColor: "#111" },
    banner: { width: "100%", height: "100%" },
    buttonsRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        paddingHorizontal: 16,
        marginTop: 10,
        gap: 10,
    },
    editButton: {
        backgroundColor: "#5E17EB",
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 10,
    },
    editText: { color: "#fff", fontWeight: "600" },
    logoutButton: {
        backgroundColor: "#330000",
        borderWidth: 1,
        borderColor: "#FF4444",
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 10,
    },
    logoutIcon: { color: "#FF5555", fontSize: 14, fontWeight: "700" },

    avatar: {
        width: 90,
        height: 90,
        borderRadius: 45,
        borderWidth: 3,
        borderColor: "#000",
        marginTop: -50,
        marginLeft: 20,
    },
    avatarGlow: {
        shadowColor: "#9B5CFF",
        shadowOpacity: 0.4,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 },
    },
    pseudo: { fontSize: 22, color: "#fff", fontWeight: "800", marginTop: 10, marginLeft: 20 },
    bio: { color: "#ccc", fontSize: 14, marginTop: 6, marginLeft: 20, marginRight: 20 },

    stats: {
        flexDirection: "row",
        marginTop: 25,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderColor: "#222",
    },

    // ✅ vraie zone tappable
    statBtn: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 8,
    },

    statNumber: { color: "#fff", fontSize: 18, fontWeight: "700" },
    statLabel: { color: "#aaa", fontSize: 13 },

    postsTitle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
        marginLeft: 20,
        marginTop: 30,
        marginBottom: 10,
    },
});