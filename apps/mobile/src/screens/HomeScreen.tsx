import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    FlatList,
    RefreshControl,
    TouchableOpacity,
    Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { io, Socket } from "socket.io-client";

import PostCard from "../components/PostCard";
import { PostType } from "../components/PostCard/types";
import { API_URL, SOCKET_URL } from "../lib/config";
import { useUser } from "../context/UserContext";

type SuggestedUser = {
    _id: string;
    pseudo: string;
    avatarUrl?: string;
    bio?: string;
    followers?: number;
    following?: number;
    notesCount?: number;
};

const LIMIT = 15;
const SUGGESTIONS_LIMIT = 8;
const SUGGESTIONS_COLLAPSED_KEY = "home_suggestions_collapsed";
const HIDDEN_SUGGESTIONS_KEY = "home_hidden_suggestions";

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

function stripToken(raw: string | null) {
    if (!raw) return null;
    let t = raw.trim();
    if (t.toLowerCase().startsWith("bearer ")) t = t.slice(7).trim();
    if (
        (t.startsWith('"') && t.endsWith('"')) ||
        (t.startsWith("'") && t.endsWith("'"))
    ) {
        t = t.slice(1, -1).trim();
    }
    return t || null;
}

function SuggestionCard({
                            user,
                            navigation,
                            following,
                            followLoading,
                            onFollow,
                            onHide,
                        }: {
    user: SuggestedUser;
    navigation: any;
    following: boolean;
    followLoading: boolean;
    onFollow: () => void;
    onHide: () => void;
}) {
    return (
        <View style={styles.suggestionCard}>
            <TouchableOpacity
                style={styles.suggestionHideBtn}
                onPress={onHide}
                activeOpacity={0.8}
            >
                <Ionicons name="close" size={14} color="#888" />
            </TouchableOpacity>

            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => navigation.navigate("UserProfile", { userId: user._id })}
            >
                <Image
                    source={{ uri: user.avatarUrl || "https://picsum.photos/200" }}
                    style={styles.suggestionAvatar}
                />

                <Text style={styles.suggestionPseudo} numberOfLines={1}>
                    {user.pseudo}
                </Text>

                <Text style={styles.suggestionBio} numberOfLines={2}>
                    {user.bio?.trim() || "Découvrir ce profil"}
                </Text>

                <View style={styles.suggestionMetaRow}>
                    <Text style={styles.suggestionMetaText}>
                        {user.followers || 0} followers
                    </Text>
                    <Text style={styles.suggestionMetaDot}>•</Text>
                    <Text style={styles.suggestionMetaText}>
                        {user.notesCount || 0} notes
                    </Text>
                </View>
            </TouchableOpacity>

            <TouchableOpacity
                style={[
                    styles.suggestionBtn,
                    following && styles.suggestionBtnFollowing,
                    followLoading && { opacity: 0.7 },
                ]}
                onPress={onFollow}
                activeOpacity={0.85}
                disabled={followLoading}
            >
                <Text style={styles.suggestionBtnText}>
                    {followLoading ? "..." : following ? "Suivi" : "Suivre"}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

export default function HomeScreen({ navigation }: any) {
    const { toggleFollow, me } = useUser();

    const [posts, setPosts] = useState<PostType[]>([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);

    const [notifUnread, setNotifUnread] = useState(0);

    const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(true);
    const [suggestionsCollapsed, setSuggestionsCollapsed] = useState(false);
    const [hiddenSuggestionIds, setHiddenSuggestionIds] = useState<string[]>([]);
    const [followLoadingMap, setFollowLoadingMap] = useState<Record<string, boolean>>({});

    const didInit = useRef(false);
    const socketRef = useRef<Socket | null>(null);

    const followingIds = useMemo(() => {
        const arr = Array.isArray(me?.followingList) ? me.followingList : [];
        return new Set(arr.map((x: any) => String(x)));
    }, [me?.followingList]);

    const visibleSuggestions = useMemo(() => {
        return suggestions.filter(
            (u) =>
                !!u?._id &&
                !hiddenSuggestionIds.includes(String(u._id)) &&
                !followingIds.has(String(u._id))
        );
    }, [suggestions, hiddenSuggestionIds, followingIds]);

    const persistCollapsed = useCallback(async (value: boolean) => {
        try {
            await AsyncStorage.setItem(SUGGESTIONS_COLLAPSED_KEY, JSON.stringify(value));
        } catch {}
    }, []);

    const persistHiddenIds = useCallback(async (ids: string[]) => {
        try {
            await AsyncStorage.setItem(HIDDEN_SUGGESTIONS_KEY, JSON.stringify(ids));
        } catch {}
    }, []);

    const fetchPrefs = useCallback(async () => {
        try {
            const [rawCollapsed, rawHidden] = await Promise.all([
                AsyncStorage.getItem(SUGGESTIONS_COLLAPSED_KEY),
                AsyncStorage.getItem(HIDDEN_SUGGESTIONS_KEY),
            ]);

            if (rawCollapsed) {
                try {
                    setSuggestionsCollapsed(!!JSON.parse(rawCollapsed));
                } catch {}
            }

            if (rawHidden) {
                try {
                    const parsed = JSON.parse(rawHidden);
                    if (Array.isArray(parsed)) {
                        setHiddenSuggestionIds(parsed.map((x) => String(x)));
                    }
                } catch {}
            }
        } catch {}
    }, []);

    const fetchUnreadNotifications = useCallback(async () => {
        const token = await AsyncStorage.getItem("token");
        if (!token) {
            setNotifUnread(0);
            return;
        }

        const res = await fetch(`${API_URL}/api/notifications`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        const json = await safeJson(res);
        if (!res.ok) {
            setNotifUnread(0);
            return;
        }

        setNotifUnread(Math.max(0, Number(json?.unreadCount || 0)));
    }, []);

    const fetchSuggestions = useCallback(async () => {
        try {
            setLoadingSuggestions(true);

            const token = await AsyncStorage.getItem("token");
            if (!token) {
                setSuggestions([]);
                return;
            }

            const res = await fetch(`${API_URL}/api/user/suggestions?limit=${SUGGESTIONS_LIMIT}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const json = await safeJson(res);
            if (!res.ok) {
                console.log("Home suggestions error:", res.status, json);
                setSuggestions([]);
                return;
            }

            const nextUsers = Array.isArray(json?.users) ? json.users : [];
            setSuggestions(nextUsers);
        } catch (err) {
            console.log("Home suggestions fetch error:", err);
            setSuggestions([]);
        } finally {
            setLoadingSuggestions(false);
        }
    }, []);

    const fetchInitial = useCallback(async () => {
        try {
            setInitialLoading(true);
            setCursor(null);
            setHasMore(true);

            const token = await AsyncStorage.getItem("token");

            const res = await fetch(`${API_URL}/api/posts?limit=${LIMIT}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const json = await safeJson(res);

            if (!res.ok) {
                console.log("Home fetchInitial error:", res.status, json);
                setPosts([]);
                setCursor(null);
                setHasMore(false);
                return;
            }

            setPosts(json?.posts || []);
            setCursor(json?.nextCursor || null);
            setHasMore(!!json?.nextCursor);
        } catch (err) {
            console.log("Home fetchInitial error:", err);
        } finally {
            setInitialLoading(false);
        }
    }, []);

    const loadMore = useCallback(async () => {
        if (!cursor || loadingMore || !hasMore) return;

        try {
            setLoadingMore(true);

            const token = await AsyncStorage.getItem("token");

            const res = await fetch(
                `${API_URL}/api/posts?limit=${LIMIT}&cursor=${encodeURIComponent(cursor)}`,
                { headers: token ? { Authorization: `Bearer ${token}` } : {} }
            );
            const json = await safeJson(res);

            if (!res.ok) {
                console.log("Home loadMore error:", res.status, json);
                return;
            }

            const newPosts: PostType[] = json?.posts || [];

            setPosts((prev) => {
                const seen = new Set(prev.map((p) => p._id));
                const merged = [...prev];
                for (const p of newPosts) {
                    if (!seen.has(p._id)) merged.push(p);
                }
                return merged;
            });

            setCursor(json?.nextCursor || null);
            setHasMore(!!json?.nextCursor);
        } catch (err) {
            console.log("Home loadMore error:", err);
        } finally {
            setLoadingMore(false);
        }
    }, [cursor, loadingMore, hasMore]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([
            fetchInitial(),
            fetchUnreadNotifications(),
            fetchSuggestions(),
        ]);
        setRefreshing(false);
    };

    useEffect(() => {
        if (didInit.current) return;
        didInit.current = true;

        Promise.all([
            fetchPrefs(),
            fetchInitial(),
            fetchUnreadNotifications(),
            fetchSuggestions(),
        ]).catch(() => {});
    }, [fetchPrefs, fetchInitial, fetchUnreadNotifications, fetchSuggestions]);

    useEffect(() => {
        let alive = true;

        (async () => {
            const stored = await AsyncStorage.getItem("token");
            const rawToken = stripToken(stored);
            if (!rawToken) return;

            const s = io(SOCKET_URL, {
                transports: ["websocket", "polling"],
                auth: { token: rawToken },
                reconnection: true,
            });

            socketRef.current = s;

            s.on("notifications:unread_count", ({ unreadCount }: any) => {
                if (!alive) return;
                setNotifUnread(Math.max(0, Number(unreadCount || 0)));
            });
        })();

        return () => {
            alive = false;
            const s = socketRef.current;
            if (s) {
                s.removeAllListeners();
                s.disconnect();
            }
            socketRef.current = null;
        };
    }, []);

    const handleDeleted = useCallback((deletedId: string) => {
        setPosts((prev) =>
            prev.filter((p: any) => {
                if (p._id === deletedId) return false;
                const repostOfId = p?.repostOf?._id;
                if (repostOfId && String(repostOfId) === String(deletedId)) return false;
                return true;
            })
        );
    }, []);

    const toggleSuggestionsCollapsed = useCallback(async () => {
        setSuggestionsCollapsed((prev) => {
            const next = !prev;
            persistCollapsed(next).catch(() => {});
            return next;
        });
    }, [persistCollapsed]);

    const hideSuggestion = useCallback(
        async (userId: string) => {
            setHiddenSuggestionIds((prev) => {
                const next = prev.includes(userId) ? prev : [...prev, userId];
                persistHiddenIds(next).catch(() => {});
                return next;
            });
        },
        [persistHiddenIds]
    );

    const handleFollowSuggestion = useCallback(
        async (userId: string) => {
            if (!userId || followLoadingMap[userId]) return;

            setFollowLoadingMap((prev) => ({ ...prev, [userId]: true }));

            try {
                const result = await toggleFollow(userId);
                if (!result.ok) return;

                setSuggestions((prev) => prev.filter((u) => String(u._id) !== String(userId)));

                setTimeout(() => {
                    fetchSuggestions().catch(() => {});
                }, 250);
            } finally {
                setFollowLoadingMap((prev) => ({ ...prev, [userId]: false }));
            }
        },
        [fetchSuggestions, followLoadingMap, toggleFollow]
    );

    const restoreSuggestions = useCallback(async () => {
        setHiddenSuggestionIds([]);
        await persistHiddenIds([]);
        await fetchSuggestions();
    }, [fetchSuggestions, persistHiddenIds]);

    const ListHeader = () => (
        <View>
            <View style={styles.suggestionsBlock}>
                <View style={styles.suggestionsHeader}>
                    <TouchableOpacity
                        style={styles.suggestionsHeaderLeft}
                        onPress={toggleSuggestionsCollapsed}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.suggestionsTitle}>Suggestions pour toi</Text>
                        <Ionicons
                            name={suggestionsCollapsed ? "chevron-down" : "chevron-up"}
                            size={18}
                            color="#aaa"
                        />
                    </TouchableOpacity>

                    {hiddenSuggestionIds.length > 0 ? (
                        <TouchableOpacity onPress={restoreSuggestions} activeOpacity={0.85}>
                            <Text style={styles.suggestionsLink}>Réafficher</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={() => navigation.navigate("ExploreSearch")}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.suggestionsLink}>Explorer</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {!suggestionsCollapsed ? (
                    loadingSuggestions ? (
                        <ActivityIndicator color="#9B5CFF" style={{ marginVertical: 16 }} />
                    ) : visibleSuggestions.length > 0 ? (
                        <FlatList
                            data={visibleSuggestions}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyExtractor={(item) => item._id}
                            renderItem={({ item }) => (
                                <SuggestionCard
                                    user={item}
                                    navigation={navigation}
                                    following={followingIds.has(String(item._id))}
                                    followLoading={!!followLoadingMap[item._id]}
                                    onFollow={() => handleFollowSuggestion(item._id)}
                                    onHide={() => hideSuggestion(String(item._id))}
                                />
                            )}
                            contentContainerStyle={{ paddingRight: 6 }}
                        />
                    ) : (
                        <View style={styles.emptySuggestionsBox}>
                            <Text style={styles.emptySuggestionsText}>
                                Plus aucune suggestion pour le moment.
                            </Text>
                        </View>
                    )
                ) : null}
            </View>
        </View>
    );

    if (initialLoading && posts.length === 0) {
        return (
            <View style={styles.loader}>
                <ActivityIndicator size="large" color="#9B5CFF" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <Text style={styles.title}>Accueil</Text>

                <TouchableOpacity
                    style={styles.notifButton}
                    activeOpacity={0.85}
                    onPress={() => {
                        setNotifUnread(0);
                        navigation.navigate("SocialNotifications");
                    }}
                >
                    <Ionicons name="notifications-outline" size={24} color="#fff" />

                    {notifUnread > 0 ? (
                        <View style={styles.notifBadge}>
                            <Text style={styles.notifBadgeText}>
                                {notifUnread > 99 ? "99+" : notifUnread}
                            </Text>
                        </View>
                    ) : null}
                </TouchableOpacity>
            </View>

            <FlatList
                data={posts}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => <PostCard post={item} onDeleted={handleDeleted} />}
                ListHeaderComponent={ListHeader}
                contentContainerStyle={{ paddingBottom: 40 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#9B5CFF"
                    />
                }
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                    loadingMore ? (
                        <ActivityIndicator
                            size="small"
                            color="#9B5CFF"
                            style={{ marginVertical: 14 }}
                        />
                    ) : null
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
        paddingTop: 50,
        paddingHorizontal: 16,
    },
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
    },
    title: {
        color: "#fff",
        fontSize: 22,
        fontWeight: "700",
    },
    notifButton: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: "#141414",
        borderWidth: 1,
        borderColor: "#222",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
    },
    notifBadge: {
        position: "absolute",
        top: -4,
        right: -4,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 4,
        borderRadius: 9,
        backgroundColor: "#9B5CFF",
        alignItems: "center",
        justifyContent: "center",
    },
    notifBadgeText: {
        color: "#000",
        fontSize: 10,
        fontWeight: "900",
    },

    suggestionsBlock: {
        marginBottom: 18,
    },
    suggestionsHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    suggestionsHeaderLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    suggestionsTitle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "800",
    },
    suggestionsLink: {
        color: "#9B5CFF",
        fontSize: 13,
        fontWeight: "800",
    },

    suggestionCard: {
        width: 190,
        backgroundColor: "#111",
        borderWidth: 1,
        borderColor: "#222",
        borderRadius: 16,
        padding: 14,
        marginRight: 12,
        position: "relative",
    },
    suggestionHideBtn: {
        position: "absolute",
        top: 10,
        right: 10,
        zIndex: 2,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: "#181818",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#242424",
    },
    suggestionAvatar: {
        width: 54,
        height: 54,
        borderRadius: 27,
        marginBottom: 12,
        backgroundColor: "#1a1a1a",
    },
    suggestionPseudo: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "900",
        paddingRight: 18,
    },
    suggestionBio: {
        color: "#999",
        fontSize: 12,
        lineHeight: 17,
        marginTop: 6,
        minHeight: 34,
    },
    suggestionMetaRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 10,
    },
    suggestionMetaText: {
        color: "#777",
        fontSize: 11,
        fontWeight: "700",
    },
    suggestionMetaDot: {
        color: "#555",
        marginHorizontal: 6,
    },
    suggestionBtn: {
        marginTop: 14,
        backgroundColor: "#5E17EB",
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    suggestionBtnFollowing: {
        backgroundColor: "#242424",
        borderWidth: 1,
        borderColor: "#333",
    },
    suggestionBtnText: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "900",
    },
    emptySuggestionsBox: {
        backgroundColor: "#111",
        borderWidth: 1,
        borderColor: "#222",
        borderRadius: 14,
        padding: 16,
    },
    emptySuggestionsText: {
        color: "#777",
        fontSize: 13,
        textAlign: "center",
    },

    loader: {
        flex: 1,
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
    },
});