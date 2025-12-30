import React, { useEffect, useState, useCallback } from "react";
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

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

import PostCard from "../components/PostCard";
import { PostType } from "../components/PostCard/types";

const localIP = Constants.expoConfig?.hostUri?.split(":")[0];
const API_URL = `http://${localIP}:3000`;

export default function UserProfileScreen({ route, navigation }: any) {
    const { userId } = route.params;

    const [user, setUser] = useState<any>(null);
    const [connectedUser, setConnectedUser] = useState<any>(null);

    const [posts, setPosts] = useState<PostType[]>([]);
    const [loadingInitial, setLoadingInitial] = useState(true);

    const [cursor, setCursor] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const [isFollowing, setIsFollowing] = useState<boolean>(false);

    const LIMIT = 15;

    /* -------------------- LOAD CONNECTED USER -------------------- */
    const loadConnectedUser = useCallback(async () => {
        const stored = await AsyncStorage.getItem("user");
        if (stored) {
            const u = JSON.parse(stored);
            setConnectedUser(u);

            if (
                u.followingList?.some(
                    (id: string) => id.toString() === userId
                )
            ) {
                setIsFollowing(true);
            } else {
                setIsFollowing(false);
            }
        }
    }, [userId]);

    /* -------------------- FETCH USER -------------------- */
    const fetchUser = useCallback(async () => {
        const res = await fetch(`${API_URL}/api/user/${userId}`);
        const json = await res.json();
        setUser(json.user);
    }, [userId]);

    /* -------------------- FETCH POSTS -------------------- */
    const fetchPosts = useCallback(async () => {
        const res = await fetch(
            `${API_URL}/api/posts/user/${userId}?limit=${LIMIT}`
        );
        const json = await res.json();

        setPosts(json.posts || []);
        setCursor(json.nextCursor || null);
        setHasMore(!!json.nextCursor);
    }, [userId]);

    /* -------------------- INITIAL LOAD -------------------- */
    useEffect(() => {
        (async () => {
            await Promise.all([
                loadConnectedUser(),
                fetchUser(),
                fetchPosts(),
            ]);
            setLoadingInitial(false);
        })();
    }, []);

    /* -------------------- LOAD MORE -------------------- */
    const loadMore = async () => {
        if (!cursor || loadingMore || !hasMore) return;

        try {
            setLoadingMore(true);

            const res = await fetch(
                `${API_URL}/api/posts/user/${userId}?limit=${LIMIT}&cursor=${cursor}`
            );
            const json = await res.json();

            setPosts((prev) => [...prev, ...(json.posts || [])]);
            setCursor(json.nextCursor || null);
            setHasMore(!!json.nextCursor);
        } finally {
            setLoadingMore(false);
        }
    };

    /* -------------------- REFRESH -------------------- */
    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([
            fetchUser(),
            fetchPosts(),
            loadConnectedUser(),
        ]);
        setRefreshing(false);
    };

    /* -------------------- FOLLOW / UNFOLLOW -------------------- */
    const handleFollowToggle = async () => {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        fetch(`${API_URL}/api/follow`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                targetId: userId,
            }),
        });

        const json = await res.json();
        if (!res.ok) {
            console.log("Follow error:", json);
            return;
        }

        setIsFollowing(json.following);

        // Update followers count on viewed profile
        setUser(prev => {
            if (!prev) return prev;

            const delta = json.status === "followed" ? 1 : -1;

            return {
                ...prev,
                followers: Math.max(0, (prev.followers || 0) + delta),
            };
        });

        // Update connected user locally
        if (connectedUser) {
            let newFollowingList = [...(connectedUser.followingList || [])];

            if (json.following) {
                newFollowingList.push(userId);
            } else {
                newFollowingList = newFollowingList.filter(
                    (id: string) => id !== userId
                );
            }

            const updatedUser = {
                ...connectedUser,
                followingList: newFollowingList,
                following: json.followingCount,
            };

            setConnectedUser(updatedUser);
            await AsyncStorage.setItem("user", JSON.stringify(updatedUser));
        }
    };

    if (loadingInitial || !user) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color="#9B5CFF" />
            </View>
        );
    }

    const isSelf = connectedUser?._id === user._id;

    /* -------------------- HEADER -------------------- */
    const Header = () => (
        <View>
            <Image
                source={{
                    uri: user.bannerUrl || "https://picsum.photos/600/200",
                }}
                style={styles.banner}
            />

            <Image
                source={{
                    uri: user.avatarUrl || "https://picsum.photos/200",
                }}
                style={styles.avatar}
            />

            <Text style={styles.pseudo}>{user.pseudo}</Text>
            <Text style={styles.bio}>{user.bio}</Text>

            {/* STATS */}
            <View style={styles.statsRow}>
                <TouchableOpacity
                    style={styles.statBox}
                    onPress={() =>
                        navigation.push("FollowersList", { userId })
                    }
                >
                    <Text style={styles.statNumber}>
                        {user.followers || 0}
                    </Text>
                    <Text style={styles.statLabel}>Followers</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.statBox}
                    onPress={() =>
                        navigation.push("FollowingList", { userId })
                    }
                >
                    <Text style={styles.statNumber}>
                        {user.following || 0}
                    </Text>
                    <Text style={styles.statLabel}>Following</Text>
                </TouchableOpacity>

                <View style={styles.statBox}>
                    <Text style={styles.statNumber}>
                        {user.notesCount || 0}
                    </Text>
                    <Text style={styles.statLabel}>Notes</Text>
                </View>
            </View>

            {!isSelf && (
                <TouchableOpacity
                    onPress={handleFollowToggle}
                    style={[
                        styles.followBtn,
                        isFollowing ? styles.following : styles.notFollowing
                    ]}
                    activeOpacity={0.8}
                >
                    <Text style={styles.followText}>
                        {isFollowing ? "Ne plus suivre" : "Suivre"}
                    </Text>
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
                loadingMore ? (
                    <ActivityIndicator
                        color="#9B5CFF"
                        style={{ marginVertical: 12 }}
                    />
                ) : null
            }
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor="#9B5CFF"
                />
            }
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
    banner: {
        width: "100%",
        height: 160,
    },
    avatar: {
        width: 90,
        height: 90,
        borderRadius: 45,
        borderWidth: 3,
        borderColor: "#000",
        marginTop: -50,
        marginLeft: 20,
    },
    pseudo: {
        fontSize: 24,
        color: "#fff",
        fontWeight: "800",
        marginLeft: 20,
        marginTop: 10,
    },
    bio: {
        color: "#ccc",
        marginLeft: 20,
        marginRight: 20,
        marginTop: 8,
    },
    statsRow: {
        flexDirection: "row",
        justifyContent: "space-around",
        marginTop: 20,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: "#222",
    },
    statBox: {
        alignItems: "center",
    },
    statNumber: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
    },
    statLabel: {
        color: "#aaa",
        fontSize: 13,
        marginTop: 2,
    },
    followBtn: {
        alignSelf: "flex-start",
        backgroundColor: "#5E17EB",
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 10,
        marginLeft: 20,
        marginTop: 14,
    },
    following: {
        backgroundColor: "#330000",
        borderWidth: 1,
        borderColor: "#FF4444",
    },
    followText: {
        color: "#fff",
        fontWeight: "700",
    },
    sectionTitle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
        marginLeft: 20,
        marginTop: 26,
        marginBottom: 16,
    },
    notFollowing: {
        backgroundColor: "#5E17EB",
    },
});