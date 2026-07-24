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
import { DefaultAvatar } from "../components/ProfileFallbacks";
import PlayerWave from "../components/PlayerWave";
import { colors, spacing, radius, typography, fontWeights } from "../theme";
import { useUser } from "../context/UserContext";
import { usePlayer } from "../context/PlayerContext";
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

type ReleaseItem = {
    id: string;
    type: "song" | "album" | "artist";
    title?: string;
    name?: string;
    artist?: string;
    cover?: string | null;
    previewUrl?: string | null;
    releaseDate?: string | null;
};

type ReleaseSection = {
    id: string;
    title: string;
    subtitle: string;
    items: ReleaseItem[];
};

const LIMIT = 15;
const SUGGESTIONS_LIMIT = 8;
const HIDDEN_SUGGESTIONS_KEY = "home_hidden_suggestions";
const SEEN_FOR_YOU_POSTS_KEY = "home_seen_for_you_posts";
const MAX_SEEN_FOR_YOU_POSTS = 90;
const EXCLUDED_FOR_YOU_POSTS = 70;

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

function getPostIdentityIds(post: PostType) {
    const ids = [post?._id, (post as any)?.repostOf?._id]
        .map((id) => (id ? String(id) : ""))
        .filter(Boolean);
    return Array.from(new Set(ids));
}

function ReleaseCard({
                         item,
                         navigation,
                         isActive,
                         isPlaying,
                         onPlay,
                     }: {
    item: ReleaseItem;
    navigation: any;
    isActive: boolean;
    isPlaying: boolean;
    onPlay: () => void;
}) {
    const title = item.type === "artist" ? item.name || "" : item.title || "";
    const artist = item.type === "artist" ? "Artiste" : item.artist || "";

    const openTarget = () => {
        if (item.type === "artist") {
            navigation.navigate("ArtistDetail", {
                artistId: item.id,
                name: title,
                cover: item.cover || null,
            });
            return;
        }

        navigation.navigate("CreatePost", {
            entityType: item.type,
            entityId: item.id || null,
            track: {
                title,
                artist,
                cover: item.cover || null,
                previewUrl: item.previewUrl || null,
            },
        });
    };

    return (
        <TouchableOpacity style={styles.releaseCard} activeOpacity={0.88} onPress={openTarget}>
            {item.cover ? (
                <Image source={{ uri: item.cover }} style={styles.releaseCover} />
            ) : (
                <View style={styles.releaseCoverFallback}>
                    <Ionicons
                        name={item.type === "album" ? "disc" : item.type === "artist" ? "person" : "musical-notes"}
                        size={22}
                        color={colors.textMuted}
                    />
                </View>
            )}

            <View style={styles.releaseBody}>
                <Text style={styles.releaseTitle} numberOfLines={2}>
                    {title}
                </Text>
                <Text style={styles.releaseArtist} numberOfLines={1}>
                    {artist}
                </Text>
            </View>

            {item.type === "song" && item.previewUrl ? (
                <TouchableOpacity
                    style={[styles.releasePlay, isActive && styles.releasePlayActive]}
                    activeOpacity={0.84}
                    onPress={(event) => {
                        event.stopPropagation();
                        onPlay();
                    }}
                >
                    {isActive && isPlaying ? (
                        <PlayerWave active size="sm" color={colors.text} inactiveColor={colors.text} />
                    ) : (
                        <Ionicons name="play" size={13} color={colors.text} />
                    )}
                </TouchableOpacity>
            ) : null}
        </TouchableOpacity>
    );
}

function ReleasesBlock({
                           sections,
                           loading,
                           navigation,
                           isCurrentPreview,
                           isPlaying,
                           onPlay,
                           onHorizontalTouchStart,
                           onHorizontalTouchEnd,
                       }: {
    sections: ReleaseSection[];
    loading: boolean;
    navigation: any;
    isCurrentPreview: (item: ReleaseItem) => boolean;
    isPlaying: boolean;
    onPlay: (item: ReleaseItem) => void;
    onHorizontalTouchStart: () => void;
    onHorizontalTouchEnd: () => void;
}) {
    const hasItems = sections.some((section) => section.items.length > 0);
    if (!loading && !hasItems) return null;

    return (
        <View
            style={styles.releasesWrap}
            onTouchStart={onHorizontalTouchStart}
            onTouchEnd={onHorizontalTouchEnd}
            onTouchCancel={onHorizontalTouchEnd}
        >
            <View style={styles.releasesHeader}>
                <Text style={styles.releaseEyebrow}>Vendredi sorties</Text>
                <Text style={styles.releasesTitle}>Les nouveautés à noter</Text>
                <Text style={styles.releasesSubtitle}>
                    France et international, prêtes à passer en avis.
                </Text>
            </View>

            {loading ? (
                <AppSectionLoader />
            ) : (
                sections.map((section) =>
                    section.items.length > 0 ? (
                        <View key={section.id} style={styles.releaseSection}>
                            <View style={styles.releaseSectionHead}>
                                <Text style={styles.releaseSectionTitle}>{section.title}</Text>
                                <Text style={styles.releaseSectionSubtitle}>{section.subtitle}</Text>
                            </View>
                            <FlatList
                                horizontal
                                data={section.items}
                                keyExtractor={(item, index) => `release:${section.id}:${item.type}:${item.id}:${index}`}
                                renderItem={({ item }) => (
                                    <ReleaseCard
                                        item={item}
                                        navigation={navigation}
                                        isActive={isCurrentPreview(item)}
                                        isPlaying={isPlaying}
                                        onPlay={() => onPlay(item)}
                                    />
                                )}
                                showsHorizontalScrollIndicator={false}
                                nestedScrollEnabled
                                contentContainerStyle={styles.releaseList}
                                onScrollBeginDrag={onHorizontalTouchStart}
                                onScrollEndDrag={onHorizontalTouchEnd}
                                onMomentumScrollEnd={onHorizontalTouchEnd}
                            />
                        </View>
                    ) : null
                )
            )}
        </View>
    );
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
                    {user.avatarUrl ? (
                        <Image source={{ uri: user.avatarUrl }} style={styles.suggestionAvatar} />
                    ) : (
                        <DefaultAvatar label={user.pseudo} seed={user._id} size={54} style={styles.suggestionAvatar} />
                    )}

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
    const { playPreview, togglePlay, isPlaying, currentTrack } = usePlayer();

    const tabBarHeight = useBottomTabBarHeight();
    const insets = useSafeAreaInsets();
    const bottomSpacing = tabBarHeight + Math.max(insets.bottom, 10) + 20;

    const [posts, setPosts] = useState<PostType[]>([]);
    const [activeFeed, setActiveFeed] = useState<HomeFeed>("forYou");
    const [feedError, setFeedError] = useState("");
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
    const [releaseSections, setReleaseSections] = useState<ReleaseSection[]>([]);
    const [loadingReleases, setLoadingReleases] = useState(false);

    const didInit = useRef(false);
    const lastFeedRef = useRef<HomeFeed>("forYou");
    const socketRef = useRef<Socket | null>(null);
    const suggestionsTouchRef = useRef(false);
    const horizontalInteractionRef = useRef(false);

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

    const getSeenForYouIds = useCallback(async () => {
        try {
            const raw = await AsyncStorage.getItem(SEEN_FOR_YOU_POSTS_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.map((id) => String(id)).filter(Boolean).slice(0, MAX_SEEN_FOR_YOU_POSTS);
        } catch {
            return [];
        }
    }, []);

    const rememberSeenForYouPosts = useCallback(async (nextPosts: PostType[]) => {
        if (!nextPosts.length) return;

        try {
            const previous = await getSeenForYouIds();
            const seen = new Set<string>();
            const merged: string[] = [];

            for (const id of nextPosts.flatMap(getPostIdentityIds)) {
                if (!seen.has(id)) {
                    seen.add(id);
                    merged.push(id);
                }
            }

            for (const id of previous) {
                if (!seen.has(id)) {
                    seen.add(id);
                    merged.push(id);
                }
            }

            await AsyncStorage.setItem(
                SEEN_FOR_YOU_POSTS_KEY,
                JSON.stringify(merged.slice(0, MAX_SEEN_FOR_YOU_POSTS))
            );
        } catch {}
    }, [getSeenForYouIds]);

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

    const fetchReleases = useCallback(async () => {
        try {
            setLoadingReleases(true);
            const res = await fetch(`${API_URL}/api/search/apple?mode=releases`);
            const json = await safeJson(res);

            if (!res.ok || !Array.isArray(json?.sections)) {
                console.log("Home releases error:", res.status, json);
                setReleaseSections([]);
                return;
            }

            setReleaseSections(json.sections as ReleaseSection[]);
        } catch (err) {
            console.log("Home releases fetch error:", err);
            setReleaseSections([]);
        } finally {
            setLoadingReleases(false);
        }
    }, []);

    const fetchInitial = useCallback(async () => {
        try {
            setInitialLoading(true);
            setFeedError("");
            setPosts([]);
            setCursor(null);
            setHasMore(true);

            const token = await getStoredToken();
            const params = new URLSearchParams({
                feed: activeFeed,
                limit: String(LIMIT),
            });
            let excludedForYouIds: string[] = [];

            if (activeFeed === "forYou") {
                excludedForYouIds = (await getSeenForYouIds()).slice(0, EXCLUDED_FOR_YOU_POSTS);
                params.set("seed", `${Date.now()}`);
                if (excludedForYouIds.length) {
                    params.set("exclude", excludedForYouIds.join(","));
                }
            }

            let res = await fetch(`${API_URL}/api/posts?${params.toString()}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            let json = await safeJson(res);

            if (
                activeFeed === "forYou" &&
                res.ok &&
                excludedForYouIds.length > 0 &&
                Array.isArray(json?.posts) &&
                json.posts.length === 0
            ) {
                params.delete("exclude");
                await AsyncStorage.removeItem(SEEN_FOR_YOU_POSTS_KEY);
                res = await fetch(`${API_URL}/api/posts?${params.toString()}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                json = await safeJson(res);
            }

            if (!res.ok || !Array.isArray(json?.posts)) {
                console.log("Home fetchInitial error:", res.status, json);
                setPosts([]);
                setCursor(null);
                setHasMore(false);
                setFeedError(
                    res.status === 404 || (res.ok && !json)
                        ? "Le feed n’est pas disponible sur ce serveur. Vérifie que l’API TrueBPM est bien lancée."
                        : json?.error || "Impossible de charger les posts pour le moment."
                );
                return;
            }

            const nextPosts = json.posts;

            setPosts(nextPosts);
            setCursor(json?.nextCursor || null);
            setHasMore(!!json?.nextCursor);

            if (activeFeed === "forYou") {
                await rememberSeenForYouPosts(nextPosts);
            }
        } catch (err) {
            console.log("Home fetchInitial error:", err);
            setFeedError("Impossible de joindre l’API TrueBPM. Vérifie ta connexion locale.");
        } finally {
            setInitialLoading(false);
        }
    }, [activeFeed, getSeenForYouIds, rememberSeenForYouPosts]);

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

            if (activeFeed === "forYou") {
                await rememberSeenForYouPosts(newPosts);
            }
        } catch (err) {
            console.log("Home loadMore error:", err);
        } finally {
            setLoadingMore(false);
        }
    }, [activeFeed, cursor, loadingMore, hasMore, rememberSeenForYouPosts]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([
            fetchInitial(),
            fetchUnreadNotifications(),
            fetchSuggestions(),
            fetchReleases(),
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
            fetchReleases(),
        ]).catch(() => {});
    }, [activeFeed, fetchPrefs, fetchInitial, fetchUnreadNotifications, fetchSuggestions, fetchReleases]);

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

    const openBlindTest = useCallback(() => {
        navigation.navigate("BlindTestHome");
    }, [navigation]);

    const isCurrentReleasePreview = useCallback(
        (item: ReleaseItem) => {
            return item.type === "song" && !!item.previewUrl && currentTrack?.url === item.previewUrl;
        },
        [currentTrack]
    );

    const playReleasePreview = useCallback(
        async (item: ReleaseItem) => {
            if (item.type !== "song" || !item.previewUrl) return;

            if (isCurrentReleasePreview(item)) {
                await togglePlay();
                return;
            }

            await playPreview({
                title: item.title || "",
                artist: item.artist || "",
                url: item.previewUrl,
                coverUrl: item.cover || "",
            });
        },
        [isCurrentReleasePreview, playPreview, togglePlay]
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

    const markSuggestionsTouchStart = useCallback(() => {
        suggestionsTouchRef.current = true;
        horizontalInteractionRef.current = true;
    }, []);

    const markSuggestionsTouchEnd = useCallback(() => {
        setTimeout(() => {
            suggestionsTouchRef.current = false;
            horizontalInteractionRef.current = false;
        }, 240);
    }, []);

    const markHorizontalTouchStart = useCallback(() => {
        horizontalInteractionRef.current = true;
    }, []);

    const markHorizontalTouchEnd = useCallback(() => {
        setTimeout(() => {
            horizontalInteractionRef.current = false;
        }, 240);
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
                    if (suggestionsTouchRef.current || horizontalInteractionRef.current) return false;

                    const horizontal = Math.abs(gesture.dx);
                    const vertical = Math.abs(gesture.dy);
                    return horizontal > 46 && horizontal > vertical * 1.65;
                },
                onPanResponderRelease: (_, gesture) => {
                    if (suggestionsTouchRef.current || horizontalInteractionRef.current) return;

                    const horizontal = Math.abs(gesture.dx);
                    const vertical = Math.abs(gesture.dy);

                    if (horizontal < 96 || horizontal < vertical * 1.45) return;

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

        if (feedError) {
            return (
                <View style={styles.emptyFeedBox}>
                    <View style={styles.emptyFeedIconWrap}>
                        <Ionicons name="cloud-offline-outline" size={19} color={colors.danger} />
                    </View>
                    <Text style={styles.emptyFeedTitle}>Le feed ne répond pas.</Text>
                    <Text style={styles.emptyFeedText}>{feedError}</Text>
                    <TouchableOpacity style={styles.emptyRetry} activeOpacity={0.84} onPress={() => fetchInitial()}>
                        <Text style={styles.emptyRetryText}>Réessayer</Text>
                    </TouchableOpacity>
                </View>
            );
        }

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
    }, [activeFeed, feedError, fetchInitial, initialLoading]);

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

            <View
                style={styles.notesWrap}
                onTouchStart={markHorizontalTouchStart}
                onTouchEnd={markHorizontalTouchEnd}
                onTouchCancel={markHorizontalTouchEnd}
            >
                <NotesStrip navigation={navigation} />
            </View>

            {activeFeed === "forYou" ? (
                <ReleasesBlock
                    sections={releaseSections}
                    loading={loadingReleases}
                    navigation={navigation}
                    isCurrentPreview={isCurrentReleasePreview}
                    isPlaying={isPlaying}
                    onPlay={playReleasePreview}
                    onHorizontalTouchStart={markHorizontalTouchStart}
                    onHorizontalTouchEnd={markHorizontalTouchEnd}
                />
            ) : null}

            <Text style={styles.feedTitle}>
                {activeFeed === "forYou" ? "Avis récents" : "Chez les profils suivis"}
            </Text>
        </View>
    ), [
        activeFeed,
        isCurrentReleasePreview,
        isPlaying,
        loadingReleases,
        markHorizontalTouchEnd,
        markHorizontalTouchStart,
        navigation,
        playReleasePreview,
        releaseSections,
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
                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            accessibilityLabel="Ouvrir le Blind Test"
                            style={styles.blindTestButton}
                            activeOpacity={0.85}
                            onPress={openBlindTest}
                        >
                            <Ionicons name="game-controller-outline" size={21} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            accessibilityLabel="Ouvrir les notifications"
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
                    </View>
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

    releasesWrap: {
        marginBottom: spacing.xl,
    },

    releasesHeader: {
        paddingHorizontal: spacing.xs,
        marginBottom: spacing.sm,
    },

    releaseEyebrow: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        textTransform: "uppercase",
        letterSpacing: 2.2,
        marginBottom: 4,
    },

    releasesTitle: {
        color: colors.text,
        fontSize: 20,
        fontWeight: fontWeights.black,
    },

    releasesSubtitle: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        lineHeight: 18,
        marginTop: 4,
    },

    releaseSection: {
        marginTop: spacing.md,
    },

    releaseSectionHead: {
        paddingHorizontal: spacing.xs,
        marginBottom: spacing.sm,
    },

    releaseSectionTitle: {
        color: colors.text,
        fontSize: typography.body,
        fontWeight: fontWeights.black,
    },

    releaseSectionSubtitle: {
        color: colors.textMuted,
        fontSize: typography.caption,
        fontWeight: fontWeights.medium,
        marginTop: 3,
    },

    releaseList: {
        gap: spacing.sm,
        paddingRight: spacing.md,
        paddingHorizontal: spacing.xs,
    },

    releaseCard: {
        width: 154,
        minHeight: 218,
        borderRadius: radius.xxl,
        backgroundColor: colors.surfaceRaised,
        padding: spacing.sm,
        position: "relative",
    },

    releaseCover: {
        width: "100%",
        aspectRatio: 1,
        borderRadius: 20,
        backgroundColor: colors.surface4,
    },

    releaseCoverFallback: {
        width: "100%",
        aspectRatio: 1,
        borderRadius: 20,
        backgroundColor: colors.surface4,
        alignItems: "center",
        justifyContent: "center",
    },

    releaseBody: {
        paddingTop: spacing.sm,
        paddingRight: 32,
    },

    releaseTitle: {
        color: colors.text,
        fontSize: typography.bodySm,
        lineHeight: 18,
        fontWeight: fontWeights.black,
    },

    releaseArtist: {
        color: colors.textMuted,
        fontSize: typography.caption,
        lineHeight: 17,
        fontWeight: fontWeights.medium,
        marginTop: 3,
    },

    releasePlay: {
        position: "absolute",
        right: spacing.sm,
        bottom: spacing.sm,
        width: 30,
        height: 30,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.control,
    },

    releasePlayActive: {
        backgroundColor: colors.controlActive,
    },

    headerActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },

    blindTestButton: {
        width: 42,
        height: 42,
        borderRadius: radius.lg,
        backgroundColor: colors.primarySoft,
        justifyContent: "center",
        alignItems: "center",
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
        backgroundColor: colors.surfaceFeed,
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
        backgroundColor: colors.surfaceRaised,
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
        backgroundColor: colors.controlActive,
    },

    suggestionActionFollowing: {
        backgroundColor: colors.control,
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
        color: colors.textMuted,
    },

    feedTabs: {
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        backgroundColor: colors.surfaceInset,
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
        backgroundColor: colors.control,
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
        backgroundColor: colors.surfaceFeed,
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

    emptyRetry: {
        minHeight: 44,
        marginTop: spacing.lg,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.xl,
        borderRadius: radius.pill,
        backgroundColor: colors.primarySoft,
    },

    emptyRetryText: {
        color: colors.accentMuted,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.black,
    },

    footerSpacer: {
        height: spacing.sm,
    },
});
