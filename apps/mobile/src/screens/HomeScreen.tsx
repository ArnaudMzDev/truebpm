import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
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
    const [suggestionsCollapsed, setSuggestionsCollapsed] = useState(false);
    const [hiddenSuggestionIds, setHiddenSuggestionIds] = useState<string[]>([]);
    const [followLoadingMap, setFollowLoadingMap] = useState<Record<string, boolean>>({});

    const didInit = useRef(false);
    const lastFeedRef = useRef<HomeFeed>("forYou");
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

    const openExplore = useCallback(() => {
        navigation.navigate("ExploreSearch");
    }, [navigation]);

    const openNotifications = useCallback(() => {
        setNotifUnread(0);
        navigation.navigate("SocialNotifications");
    }, [navigation]);

    const postKeyExtractor = useCallback((item: PostType) => item._id, []);

    const renderPostItem = useCallback(
        ({ item }: { item: PostType }) => (
            <PostCard post={item} onDeleted={handleDeleted} />
        ),
        [handleDeleted]
    );

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
            <View style={styles.heroIntro}>
                <Text style={styles.heroEyebrow}>TrueBPM</Text>
                <Text style={styles.heroTitle}>Feed</Text>
            </View>

            <View style={styles.notesWrap}>
                <NotesStrip navigation={navigation} />
            </View>

            <View style={styles.suggestionsBlock}>
                <View style={styles.suggestionsHeader}>
                    <TouchableOpacity
                        style={styles.suggestionsHeaderLeft}
                        onPress={toggleSuggestionsCollapsed}
                        activeOpacity={0.85}
                    >
                        <View style={styles.suggestionsTitleWrap}>
                            <Text style={styles.suggestionsEyebrow}>À écouter avec eux</Text>
                            <Text style={styles.suggestionsTitle}>Profils à suivre</Text>
                        </View>

                        <View style={styles.suggestionsChevronWrap}>
                            <Ionicons
                                name={suggestionsCollapsed ? "chevron-down" : "chevron-up"}
                                size={16}
                                color={colors.textMuted}
                            />
                        </View>
                    </TouchableOpacity>

                    {hiddenSuggestionIds.length > 0 ? (
                        <TouchableOpacity onPress={restoreSuggestions} activeOpacity={0.85}>
                            <Text style={styles.suggestionsLink}>Réafficher</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={openExplore}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.suggestionsLink}>Explorer</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {!suggestionsCollapsed ? (
                    loadingSuggestions ? (
                        <AppSectionLoader />
                    ) : visibleSuggestions.length > 0 ? (
                        <FlatList
                            data={visibleSuggestions}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyExtractor={suggestionKeyExtractor}
                            renderItem={renderSuggestionItem}
                            contentContainerStyle={styles.suggestionsListContent}
                        />
                    ) : (
                        <View style={styles.emptySuggestionsBox}>
                            <View style={styles.emptySuggestionsIconWrap}>
                                <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
                            </View>
                            <Text style={styles.emptySuggestionsText}>
                                Plus personne à proposer là, reviens après quelques écoutes.
                            </Text>
                        </View>
                    )
                ) : null}
            </View>

            <View style={styles.feedTabs}>
                <TouchableOpacity
                    style={[styles.feedTabBtn, activeFeed === "forYou" && styles.feedTabBtnActive]}
                    activeOpacity={0.86}
                    onPress={() => setActiveFeed("forYou")}
                >
                    <Ionicons
                        name="sparkles-outline"
                        size={15}
                        color={activeFeed === "forYou" ? colors.bg : colors.textMuted}
                    />
                    <Text style={[styles.feedTabText, activeFeed === "forYou" && styles.feedTabTextActive]}>
                        Pour toi
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.feedTabBtn, activeFeed === "following" && styles.feedTabBtnActive]}
                    activeOpacity={0.86}
                    onPress={() => setActiveFeed("following")}
                >
                    <Ionicons
                        name="people-outline"
                        size={15}
                        color={activeFeed === "following" ? colors.bg : colors.textMuted}
                    />
                    <Text style={[styles.feedTabText, activeFeed === "following" && styles.feedTabTextActive]}>
                        Abonnements
                    </Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.feedTitle}>
                {activeFeed === "forYou" ? "Avis récents" : "Chez les profils suivis"}
            </Text>
        </View>
    ), [
        activeFeed,
        hiddenSuggestionIds.length,
        loadingSuggestions,
        navigation,
        openExplore,
        renderSuggestionItem,
        restoreSuggestions,
        suggestionKeyExtractor,
        suggestionsCollapsed,
        toggleSuggestionsCollapsed,
        visibleSuggestions,
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

            <FlatList
                data={posts}
                keyExtractor={postKeyExtractor}
                renderItem={renderPostItem}
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
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    listContent: {
        paddingBottom: spacing.xxxl,
    },

    heroIntro: {
        marginBottom: spacing.lg,
        paddingTop: spacing.xs,
    },

    heroEyebrow: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 4,
    },

    heroTitle: {
        color: colors.text,
        fontSize: 26,
        fontWeight: fontWeights.black,
        lineHeight: 30,
    },

    notesWrap: {
        marginBottom: spacing.lg,
    },

    notifButton: {
        width: 42,
        height: 42,
        borderRadius: radius.lg,
        backgroundColor: colors.surface3,
        borderWidth: 1,
        borderColor: colors.border,
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

    suggestionsBlock: {
        marginBottom: spacing.xl,
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderSoft,
        borderRadius: radius.xl,
    },

    suggestionsHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.sm,
        gap: spacing.md,
    },

    suggestionsHeaderLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        flex: 1,
        justifyContent: "space-between",
    },

    suggestionsTitleWrap: {
        flex: 1,
        paddingRight: spacing.sm,
    },

    suggestionsChevronWrap: {
        width: 28,
        height: 28,
        borderRadius: radius.pill,
        backgroundColor: colors.surface3,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },

    suggestionsEyebrow: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        textTransform: "uppercase",
        marginBottom: 2,
        letterSpacing: 1,
    },

    suggestionsTitle: {
        color: colors.text,
        fontSize: 17,
        fontWeight: fontWeights.black,
    },

    suggestionsLink: {
        color: colors.primary,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.extraBold,
    },

    suggestionsListContent: {
        paddingRight: 4,
    },

    suggestionCard: {
        width: 176,
        marginRight: spacing.sm,
        position: "relative",
        padding: spacing.md,
        backgroundColor: colors.surface3,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.xl,
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
        borderWidth: 1,
        borderColor: colors.border,
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
        borderWidth: 1,
        borderColor: colors.border,
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
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: colors.borderAccent,
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

    emptySuggestionsBox: {
        backgroundColor: colors.surface3,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.xl,
        padding: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },

    emptySuggestionsIconWrap: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#151122",
        borderWidth: 1,
        borderColor: colors.borderAccent,
    },

    emptySuggestionsText: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        flex: 1,
    },

    feedTabs: {
        flexDirection: "row",
        gap: 4,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderSoft,
        borderRadius: radius.xl,
        padding: 4,
        marginBottom: spacing.md,
    },

    feedTabBtn: {
        flex: 1,
        minHeight: 42,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
        borderRadius: radius.lg,
    },

    feedTabBtnActive: {
        backgroundColor: colors.primary,
    },

    feedTabText: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.extraBold,
    },

    feedTabTextActive: {
        color: colors.bg,
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
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderSoft,
        borderRadius: radius.xl,
        padding: spacing.lg,
        alignItems: "center",
    },

    emptyFeedIconWrap: {
        width: 42,
        height: 42,
        borderRadius: radius.lg,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#151122",
        borderWidth: 1,
        borderColor: colors.borderAccent,
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
