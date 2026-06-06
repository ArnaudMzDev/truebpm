import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    PanResponder,
    RefreshControl,
    TouchableOpacity,
    Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { io, Socket } from "socket.io-client";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PostCard from "../components/PostCard";
import NotesStrip from "../components/NotesStrip";
import { PostType } from "../components/PostCard/types";
import { API_URL, SOCKET_URL } from "../lib/config";

import AppScreen from "../components/ui/AppScreen";
import AppHeader from "../components/ui/AppHeader";
import AppSectionLoader from "../components/ui/AppSectionLoader";
import AppScreenLoader from "../components/ui/AppScreenLoader";
import { colors, spacing, radius, typography, fontWeights } from "../theme";
import { useUser } from "../context/UserContext";
import { getStoredToken } from "../lib/authStorage";

type SuggestedUser = {
    _id: string;
    pseudo: string;
    avatarUrl?: string;
    bio?: string;
    followers?: number;
    following?: number;
    notesCount?: number;
};

type HomeFeed = "forYou" | "following";
type FeedListItem =
    | { type: "post"; post: PostType }
    | { type: "suggestions"; id: string; suggestions: SuggestedUser[] };

const LIMIT = 15;
const SUGGESTIONS_LIMIT = 8;
const HIDDEN_SUGGESTIONS_KEY = "home_hidden_suggestions";

async function safeJson(res: Response): Promise<any | null> {
    const text = await res.text();
    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch {
        if (__DEV__) console.log("Non-JSON response:", text.slice(0, 200));
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
                activeOpacity={0.85}
            >
                <Ionicons name="close" size={12} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => navigation.navigate("UserProfile", { userId: user._id })}
            >
                <View style={styles.suggestionTopRow}>
                    <Image
                        source={{ uri: user.avatarUrl || "https://picsum.photos/200" }}
                        style={styles.suggestionAvatar}
                    />

                    <View style={styles.suggestionIdentity}>
                        <Text style={styles.suggestionPseudo} numberOfLines={1}>
                            {user.pseudo}
                        </Text>

                        <Text style={styles.suggestionBio} numberOfLines={1}>
                            {user.bio?.trim() || "Découvrir ce profil"}
                        </Text>
                    </View>
                </View>

                <Text style={styles.suggestionMetaText}>
                    {(user.notesCount || 0) > 0 ? `${user.notesCount} avis publiés` : "Profil à découvrir"}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={onFollow}
                disabled={followLoading}
                activeOpacity={0.86}
                style={[
                    styles.suggestionAction,
                    following && styles.suggestionActionFollowing,
                    followLoading && styles.suggestionActionDisabled,
                ]}
            >
                <Text style={[styles.suggestionActionText, following && styles.suggestionActionTextFollowing]}>
                    {followLoading ? "..." : following ? "Suivi" : "Suivre"}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

export default function HomeScreen({ navigation }: any) {
    const { toggleFollow, me } = useUser();

    const tabBarHeight = useBottomTabBarHeight();
    const insets = useSafeAreaInsets();
    const bottomSpacing = tabBarHeight + Math.max(insets.bottom, 10) + 20;

    const [posts, setPosts] = useState<PostType[]>([]);
    const [activeFeed, setActiveFeed] = useState<HomeFeed>("forYou");
    const [initialLoading, setInitialLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);

    const [notifUnread, setNotifUnread] = useState(0);

    const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(true);
    const [hiddenSuggestionIds, setHiddenSuggestionIds] = useState<string[]>([]);
    const [followLoadingMap, setFollowLoadingMap] = useState<Record<string, boolean>>({});

    const didInit = useRef(false);
    const lastFeedRef = useRef<HomeFeed>("forYou");
    const socketRef = useRef<Socket | null>(null);
    const suggestionsTouchRef = useRef(false);

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

    const persistHiddenIds = useCallback(async (ids: string[]) => {
        try {
            await AsyncStorage.setItem(HIDDEN_SUGGESTIONS_KEY, JSON.stringify(ids));
        } catch {}
    }, []);

    const fetchPrefs = useCallback(async () => {
        try {
            const rawHidden = await AsyncStorage.getItem(HIDDEN_SUGGESTIONS_KEY);

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
        const token = await getStoredToken();
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

            const token = await getStoredToken();
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
            setPosts([]);
            setCursor(null);
            setHasMore(true);

            const token = await getStoredToken();

            const res = await fetch(`${API_URL}/api/posts?feed=${activeFeed}&limit=${LIMIT}`, {
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
    }, [activeFeed]);

    const loadMore = useCallback(async () => {
        if (!cursor || loadingMore || !hasMore) return;

        try {
            setLoadingMore(true);

            const token = await getStoredToken();

            const res = await fetch(
                `${API_URL}/api/posts?feed=${activeFeed}&limit=${LIMIT}&cursor=${encodeURIComponent(cursor)}`,
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
    }, [activeFeed, cursor, loadingMore, hasMore]);

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
        lastFeedRef.current = activeFeed;

        Promise.all([
            fetchPrefs(),
            fetchInitial(),
            fetchUnreadNotifications(),
            fetchSuggestions(),
        ]).catch(() => {});
    }, [activeFeed, fetchPrefs, fetchInitial, fetchUnreadNotifications, fetchSuggestions]);

    useEffect(() => {
        if (!didInit.current) return;
        if (lastFeedRef.current === activeFeed) return;
        lastFeedRef.current = activeFeed;
        fetchInitial().catch(() => {});
    }, [activeFeed, fetchInitial]);

    useEffect(() => {
        let alive = true;

        (async () => {
            const stored = await getStoredToken();
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

    const openExplore = useCallback(() => {
        navigation.navigate("ExploreSearch");
    }, [navigation]);

    const openNotifications = useCallback(() => {
        setNotifUnread(0);
        navigation.navigate("SocialNotifications");
    }, [navigation]);

    const suggestionKeyExtractor = useCallback((item: SuggestedUser) => item._id, []);

    const renderSuggestionItem = useCallback(
        ({ item }: { item: SuggestedUser }) => (
            <SuggestionCard
                user={item}
                navigation={navigation}
                following={followingIds.has(String(item._id))}
                followLoading={!!followLoadingMap[item._id]}
                onFollow={() => handleFollowSuggestion(item._id)}
                onHide={() => hideSuggestion(String(item._id))}
            />
        ),
        [followLoadingMap, followingIds, handleFollowSuggestion, hideSuggestion, navigation]
    );

    const markSuggestionsTouchStart = useCallback(() => {
        suggestionsTouchRef.current = true;
    }, []);

    const markSuggestionsTouchEnd = useCallback(() => {
        setTimeout(() => {
            suggestionsTouchRef.current = false;
        }, 80);
    }, []);

    const feedSeed = useMemo(() => {
        return posts.reduce((acc, post, index) => {
            const id = String(post?._id || "");
            return acc + id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) + index * 17;
        }, activeFeed === "forYou" ? 11 : 29);
    }, [activeFeed, posts]);

    const feedItems = useMemo<FeedListItem[]>(() => {
        const postItems = posts.map<FeedListItem>((post) => ({ type: "post", post }));

        if (loadingSuggestions || visibleSuggestions.length === 0 || posts.length < 2) {
            return postItems;
        }

        const maxFirstSlot = Math.max(1, Math.min(4, posts.length - 1));
        const firstAfter = Math.min(posts.length - 2, 1 + (feedSeed % maxFirstSlot));
        const secondAfter = firstAfter + 6 + (feedSeed % 3);
        const rails = new Map<number, SuggestedUser[]>();

        rails.set(firstAfter, visibleSuggestions.slice(0, 4));

        if (visibleSuggestions.length > 4 && secondAfter < posts.length - 1) {
            rails.set(secondAfter, visibleSuggestions.slice(4, 8));
        }

        const nextItems: FeedListItem[] = [];
        posts.forEach((post, index) => {
            nextItems.push({ type: "post", post });

            const railSuggestions = rails.get(index);
            if (railSuggestions?.length) {
                nextItems.push({
                    type: "suggestions",
                    id: `suggestions-${activeFeed}-${index}-${railSuggestions.map((user) => user._id).join("-")}`,
                    suggestions: railSuggestions,
                });
            }
        });

        return nextItems;
    }, [activeFeed, feedSeed, loadingSuggestions, posts, visibleSuggestions]);

    const feedKeyExtractor = useCallback((item: FeedListItem) => {
        if (item.type === "post") return item.post._id;
        return item.id;
    }, []);

    const renderFeedItem = useCallback(
        ({ item }: { item: FeedListItem }) => {
            if (item.type === "post") {
                return <PostCard post={item.post} onDeleted={handleDeleted} />;
            }

            return (
                <View
                    style={styles.inlineSuggestionsBlock}
                    onTouchStart={markSuggestionsTouchStart}
                    onTouchEnd={markSuggestionsTouchEnd}
                    onTouchCancel={markSuggestionsTouchEnd}
                >
                    <View style={styles.inlineSuggestionsHeader}>
                        <View style={styles.inlineSuggestionsTitleWrap}>
                            <Text style={styles.inlineSuggestionsEyebrow}>À suivre</Text>
                            <Text style={styles.inlineSuggestionsTitle}>Quelques profils pour ton feed</Text>
                        </View>

                        {hiddenSuggestionIds.length > 0 ? (
                            <TouchableOpacity onPress={restoreSuggestions} activeOpacity={0.85}>
                                <Text style={styles.inlineSuggestionsLink}>Réafficher</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity onPress={openExplore} activeOpacity={0.85}>
                                <Text style={styles.inlineSuggestionsLink}>Explorer</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <FlatList
                        data={item.suggestions}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={suggestionKeyExtractor}
                        renderItem={renderSuggestionItem}
                        contentContainerStyle={styles.suggestionsListContent}
                    />
                </View>
            );
        },
        [
            handleDeleted,
            hiddenSuggestionIds.length,
            markSuggestionsTouchEnd,
            markSuggestionsTouchStart,
            openExplore,
            renderSuggestionItem,
            restoreSuggestions,
            suggestionKeyExtractor,
        ]
    );

    const switchFeed = useCallback((nextFeed: HomeFeed) => {
        setActiveFeed((current) => (current === nextFeed ? current : nextFeed));
    }, []);

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onMoveShouldSetPanResponder: (_, gesture) => {
                    if (suggestionsTouchRef.current) return false;

                    const horizontal = Math.abs(gesture.dx);
                    const vertical = Math.abs(gesture.dy);
                    return horizontal > 28 && horizontal > vertical * 1.35;
                },
                onPanResponderRelease: (_, gesture) => {
                    const horizontal = Math.abs(gesture.dx);
                    const vertical = Math.abs(gesture.dy);

                    if (horizontal < 72 || horizontal < vertical * 1.2) return;

                    if (gesture.dx < 0 && activeFeed === "forYou") {
                        switchFeed("following");
                    } else if (gesture.dx > 0 && activeFeed === "following") {
                        switchFeed("forYou");
                    }
                },
            }),
        [activeFeed, switchFeed]
    );

    const listContentStyle = useMemo(
        () => [styles.listContent, { paddingBottom: bottomSpacing }],
        [bottomSpacing]
    );

    const listFooter = useMemo(
        () => (loadingMore ? <AppSectionLoader /> : <View style={styles.footerSpacer} />),
        [loadingMore]
    );

    const listEmpty = useMemo(() => {
        if (initialLoading) return null;

        return (
            <View style={styles.emptyFeedBox}>
                <View style={styles.emptyFeedIconWrap}>
                    <Ionicons
                        name={activeFeed === "forYou" ? "sparkles-outline" : "people-outline"}
                        size={18}
                        color={colors.primary}
                    />
                </View>
                <Text style={styles.emptyFeedTitle}>
                    {activeFeed === "forYou" ? "Aucun avis pour l’instant." : "Pas encore de posts ici."}
                </Text>
                <Text style={styles.emptyFeedText}>
                    {activeFeed === "forYou"
                        ? "Lance un premier son ou suis quelques profils pour réveiller le feed."
                        : "Ton feed prendra vie dès que les profils suivis publieront."}
                </Text>
            </View>
        );
    }, [activeFeed, initialLoading]);

    const listHeader = useMemo(() => (
        <View>
            <View style={styles.feedTabsWrap}>
                <View style={styles.feedTabs}>
                    <TouchableOpacity
                        style={[styles.feedTabBtn, activeFeed === "forYou" && styles.feedTabBtnActive]}
                        activeOpacity={0.86}
                        onPress={() => switchFeed("forYou")}
                    >
                        <Text style={[styles.feedTabText, activeFeed === "forYou" && styles.feedTabTextActive]}>
                            Pour toi
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.feedTabBtn, activeFeed === "following" && styles.feedTabBtnActive]}
                        activeOpacity={0.86}
                        onPress={() => switchFeed("following")}
                    >
                        <Text style={[styles.feedTabText, activeFeed === "following" && styles.feedTabTextActive]}>
                            Abonnements
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.notesWrap}>
                <NotesStrip navigation={navigation} />
            </View>

            <Text style={styles.feedTitle}>
                {activeFeed === "forYou" ? "Avis récents" : "Chez les profils suivis"}
            </Text>
        </View>
    ), [
        activeFeed,
        navigation,
        switchFeed,
    ]);

    if (initialLoading && posts.length === 0) {
        return <AppScreenLoader label="Chargement du feed..." />;
    }

    return (
        <AppScreen>
            <AppHeader
                title="Accueil"
                right={
                    <TouchableOpacity
                        style={styles.notifButton}
                        activeOpacity={0.85}
                        onPress={openNotifications}
                    >
                        <Ionicons name="notifications-outline" size={22} color={colors.text} />

                        {notifUnread > 0 ? (
                            <View style={styles.notifBadge}>
                                <Text style={styles.notifBadgeText}>
                                    {notifUnread > 99 ? "99+" : notifUnread}
                                </Text>
                            </View>
                        ) : null}
                    </TouchableOpacity>
                }
            />

            <View style={styles.feedGestureArea} {...panResponder.panHandlers}>
                <FlatList
                    data={feedItems}
                    keyExtractor={feedKeyExtractor}
                    renderItem={renderFeedItem}
                    ListHeaderComponent={listHeader}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={listContentStyle}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                        />
                    }
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    ListEmptyComponent={listEmpty}
                    ListFooterComponent={listFooter}
                />
            </View>
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    feedGestureArea: {
        flex: 1,
    },

    listContent: {
        paddingBottom: spacing.xxxl,
    },

    feedTabsWrap: {
        alignItems: "center",
        paddingTop: spacing.xs,
        marginBottom: spacing.lg,
    },

    notesWrap: {
        marginBottom: spacing.lg,
    },

    notifButton: {
        width: 42,
        height: 42,
        borderRadius: radius.lg,
        backgroundColor: colors.surface3,
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
        borderRadius: radius.pill,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: colors.bg,
    },

    notifBadgeText: {
        color: colors.bg,
        fontSize: 10,
        fontWeight: fontWeights.black,
    },

    inlineSuggestionsBlock: {
        marginTop: spacing.sm,
        marginBottom: spacing.xl,
        paddingVertical: spacing.md,
        backgroundColor: "rgba(9, 11, 16, 0.72)",
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: "rgba(130, 146, 171, 0.14)",
    },

    inlineSuggestionsHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.xs,
        marginBottom: spacing.sm,
        gap: spacing.md,
    },

    inlineSuggestionsTitleWrap: {
        flex: 1,
        paddingRight: spacing.sm,
    },

    inlineSuggestionsEyebrow: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        textTransform: "uppercase",
        marginBottom: 2,
        letterSpacing: 1,
    },

    inlineSuggestionsTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: fontWeights.black,
    },

    inlineSuggestionsLink: {
        color: colors.primary,
        fontSize: typography.caption,
        fontWeight: fontWeights.extraBold,
    },

    suggestionsListContent: {
        paddingHorizontal: spacing.xs,
    },

    suggestionCard: {
        width: 176,
        marginRight: spacing.sm,
        position: "relative",
        padding: spacing.md,
        backgroundColor: "rgba(20, 24, 33, 0.72)",
        borderRadius: radius.xxl,
    },

    suggestionHideBtn: {
        position: "absolute",
        top: 8,
        right: 8,
        zIndex: 2,
        width: 22,
        height: 22,
        borderRadius: radius.pill,
        backgroundColor: colors.surface4,
        alignItems: "center",
        justifyContent: "center",
    },

    suggestionTopRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: spacing.sm,
        paddingRight: 12,
    },

    suggestionAvatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: colors.surface4,
        marginRight: spacing.sm,
    },

    suggestionIdentity: {
        flex: 1,
        minWidth: 0,
    },

    suggestionPseudo: {
        color: colors.text,
        fontSize: 14,
        fontWeight: fontWeights.black,
    },

    suggestionBio: {
        color: colors.textMuted,
        fontSize: 11,
        lineHeight: 15,
        marginTop: 3,
    },

    suggestionMetaText: {
        color: colors.textFaint,
        fontSize: 11,
        fontWeight: fontWeights.bold,
        marginTop: spacing.sm,
    },

    suggestionAction: {
        marginTop: spacing.md,
        alignSelf: "flex-start",
        minHeight: 30,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primaryDark,
    },

    suggestionActionFollowing: {
        backgroundColor: colors.primaryFaint,
    },

    suggestionActionDisabled: {
        opacity: 0.62,
    },

    suggestionActionText: {
        color: colors.text,
        fontSize: typography.caption,
        fontWeight: fontWeights.black,
    },

    suggestionActionTextFollowing: {
        color: colors.primary,
    },

    feedTabs: {
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        backgroundColor: "rgba(20, 24, 33, 0.34)",
        borderRadius: radius.pill,
        padding: 3,
    },

    feedTabBtn: {
        minHeight: 30,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.pill,
        paddingHorizontal: spacing.md,
    },

    feedTabBtnActive: {
        backgroundColor: "rgba(151, 89, 255, 0.18)",
    },

    feedTabText: {
        color: colors.textMuted,
        fontSize: typography.caption,
        fontWeight: fontWeights.extraBold,
    },

    feedTabTextActive: {
        color: colors.text,
        fontWeight: fontWeights.black,
    },

    feedTitle: {
        color: colors.text,
        fontSize: 20,
        fontWeight: fontWeights.black,
        marginBottom: spacing.md,
        paddingHorizontal: spacing.xs,
    },

    emptyFeedBox: {
        marginTop: spacing.xs,
        backgroundColor: "rgba(15, 18, 24, 0.62)",
        borderRadius: radius.xxl,
        padding: spacing.lg,
        alignItems: "center",
    },

    emptyFeedIconWrap: {
        width: 42,
        height: 42,
        borderRadius: radius.lg,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primaryFaint,
        marginBottom: spacing.md,
    },

    emptyFeedTitle: {
        color: colors.text,
        fontSize: typography.body,
        fontWeight: fontWeights.black,
        textAlign: "center",
        marginBottom: spacing.xs,
    },

    emptyFeedText: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        lineHeight: 19,
        textAlign: "center",
    },

    footerSpacer: {
        height: spacing.sm,
    },
});
