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
    Alert,
    ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { API_URL } from "../lib/config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PostCard from "../components/PostCard";
import { PostType } from "../components/PostCard/types";
import PlayerWave from "../components/PlayerWave";
import { DefaultAvatar, DefaultBanner } from "../components/ProfileFallbacks";
import AppScreenLoader from "../components/ui/AppScreenLoader";
import { useUser } from "../context/UserContext";
import { usePlayer } from "../context/PlayerContext";
import { getStoredToken } from "../lib/authStorage";
import { useAppBottomSpacing } from "../hooks/useAppBottomSpacing";
import {
    colors,
    spacing,
    radius,
    typography,
    fontWeights,
} from "../theme";

type MusicRef = {
    entityId: string;
    entityType: "song" | "album" | "artist";
    title: string;
    artist: string;
    coverUrl: string;
    previewUrl: string;
};

type ProfileTab = "posts" | "reposts" | "likes";
type FollowStatus = "self" | "none" | "requested" | "following";

type Compatibility = {
    locked?: boolean;
    score?: number;
    sharedEntities?: Array<{
        key: string;
        title: string;
        artist: string;
        coverUrl?: string | null;
        myRating: number;
        theirRating: number;
        diff: number;
    }>;
    sharedArtists?: string[];
    sharedFavorites?: number;
    agreements?: number;
    disagreements?: Array<{
        key: string;
        title: string;
        artist: string;
        myRating: number;
        theirRating: number;
        diff: number;
    }>;
};

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

function MusicHorizontalCard({
                                 item,
                                 compact = false,
                                 onPress,
                             }: {
    item: MusicRef;
    compact?: boolean;
    onPress?: () => void;
}) {
    const Wrapper = onPress ? TouchableOpacity : View;

    return (
        <Wrapper style={[styles.musicCard, compact && styles.musicCardCompact]} onPress={onPress} activeOpacity={0.86}>
            {item.coverUrl ? (
                <Image source={{ uri: item.coverUrl }} style={styles.musicCardCover} />
            ) : (
                <View style={[styles.musicCardCover, styles.musicPlaceholder]}>
                    <Ionicons
                        name={
                            item.entityType === "artist"
                                ? "person"
                                : item.entityType === "album"
                                    ? "disc"
                                    : "musical-notes"
                        }
                        size={20}
                        color={colors.textMuted}
                    />
                </View>
            )}

            <Text style={styles.musicCardTitle} numberOfLines={1}>
                {item.title}
            </Text>
            <Text style={styles.musicCardArtist} numberOfLines={1}>
                {item.artist}
            </Text>
        </Wrapper>
    );
}

function SectionBlock({
                          title,
                          icon,
                          children,
                      }: {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    children: React.ReactNode;
}) {
    return (
        <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
                <View style={styles.sectionIconWrap}>
                    <Ionicons name={icon} size={15} color={colors.primary} />
                </View>
                <Text style={styles.sectionBlockTitle}>{title}</Text>
            </View>
            {children}
        </View>
    );
}

function EmptyMusicState({ text }: { text: string }) {
    return (
        <View style={styles.emptyBox}>
            <Ionicons name="sparkles-outline" size={16} color={colors.textMuted} />
            <Text style={styles.emptyText}>{text}</Text>
        </View>
    );
}

function EmptyPostsState({ tab }: { tab: ProfileTab }) {
    const text =
        tab === "posts"
            ? "Aucun post pour le moment."
            : tab === "reposts"
                ? "Aucun repost pour le moment."
                : "Aucun like visible pour le moment.";

    return (
        <View style={styles.emptyPostsBox}>
            <Ionicons name="albums-outline" size={18} color={colors.textMuted} />
            <Text style={styles.emptyPostsText}>{text}</Text>
        </View>
    );
}

function PrivateLockedState({
                                followStatus,
                                onToggleFollow,
                                loading,
                            }: {
    followStatus: FollowStatus;
    onToggleFollow: () => void;
    loading: boolean;
}) {
    const label =
        followStatus === "requested"
            ? "Demandé"
            : followStatus === "following"
                ? "Suivi"
                : "Demander à suivre";

    return (
        <View style={styles.privateBox}>
            <View style={styles.privateIconWrap}>
                <Ionicons name="lock-closed" size={18} color={colors.text} />
            </View>

            <Text style={styles.privateTitle}>Ce compte est privé</Text>
            <Text style={styles.privateText}>
                Tu dois être accepté pour voir les posts, les reposts et les likes de ce profil.
            </Text>

            <TouchableOpacity
                style={[styles.privateBtn, loading && { opacity: 0.7 }]}
                activeOpacity={0.85}
                disabled={loading}
                onPress={onToggleFollow}
            >
                <Text style={styles.privateBtnText}>{loading ? "..." : label}</Text>
            </TouchableOpacity>
        </View>
    );
}

export default function UserProfileScreen({ route, navigation }: any) {
    const { userId } = route.params;
    const insets = useSafeAreaInsets();
    const bottomSpacing = useAppBottomSpacing({ extra: 28 });

    const { me, toggleFollow, subscribe, refreshMe } = useUser();
    const { playPreview, togglePlay, isPlaying, currentTrack } = usePlayer();

    const [user, setUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<ProfileTab>("posts");

    const [posts, setPosts] = useState<PostType[]>([]);
    const [loadingInitial, setLoadingInitial] = useState(true);

    const [cursor, setCursor] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const [openingChat, setOpeningChat] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [isPrivateLocked, setIsPrivateLocked] = useState(false);

    const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
    const [requestActionLoading, setRequestActionLoading] = useState(false);
    const [muteNotificationsLoading, setMuteNotificationsLoading] = useState(false);
    const [compatibility, setCompatibility] = useState<Compatibility | null>(null);

    const LIMIT = 15;

    const isSelf = useMemo(() => {
        return me?._id?.toString?.() === userId?.toString?.();
    }, [me, userId]);

    const followStatus = (user?.followStatus || "none") as FollowStatus;
    const isFollowing = followStatus === "following";

    const fetchUser = useCallback(async () => {
        const token = await getStoredToken();

        const res = await fetch(`${API_URL}/api/user/${userId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const json = await safeJson(res);

        if (!res.ok) {
            console.log("fetchUser error:", res.status, json);
            return;
        }

        setUser(json?.user ?? null);
    }, [userId]);

    const fetchPendingRequestForProfile = useCallback(async () => {
        if (isSelf) {
            setPendingRequestId(null);
            return;
        }

        const token = await getStoredToken();
        if (!token) {
            setPendingRequestId(null);
            return;
        }

        const res = await fetch(`${API_URL}/api/follow/requests`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        const json = await safeJson(res);
        if (!res.ok) {
            console.log("fetchPendingRequestForProfile error:", res.status, json);
            setPendingRequestId(null);
            return;
        }

        const requests = Array.isArray(json?.requests) ? json.requests : [];

        const match = requests.find((r: any) => {
            const requester =
                typeof r?.requesterId === "string"
                    ? r.requesterId
                    : r?.requesterId?._id || r?.requesterId;

            return String(requester) === String(userId);
        });

        setPendingRequestId(match?._id ? String(match._id) : null);
    }, [isSelf, userId]);

    const fetchCompatibility = useCallback(async () => {
        if (isSelf) {
            setCompatibility(null);
            return;
        }

        const token = await getStoredToken();
        if (!token) {
            setCompatibility(null);
            return;
        }

        const res = await fetch(`${API_URL}/api/user/${userId}/compatibility`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const json = await safeJson(res);

        if (!res.ok) {
            console.log("fetchCompatibility error:", res.status, json);
            setCompatibility(null);
            return;
        }

        setCompatibility(json?.compatibility || null);
    }, [isSelf, userId]);

    const fetchTabPosts = useCallback(async (uid: string, tab: ProfileTab) => {
        const token = await getStoredToken();

        const res = await fetch(
            `${API_URL}/api/posts/user/${uid}?tab=${tab}&limit=${LIMIT}`,
            { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );

        const json = await safeJson(res);

        if (!res.ok) {
            console.log("fetchPosts error:", res.status, json);
            return;
        }

        setPosts(json?.posts || []);
        setCursor(json?.nextCursor || null);
        setHasMore(!!json?.nextCursor);
        setIsPrivateLocked(!!json?.isPrivateLocked);
    }, []);

    useEffect(() => {
        (async () => {
            setLoadingInitial(true);
            await Promise.all([
                fetchUser(),
                fetchTabPosts(userId, activeTab),
                fetchPendingRequestForProfile(),
                fetchCompatibility(),
            ]);
            setLoadingInitial(false);
        })();
    }, [fetchUser, fetchTabPosts, fetchPendingRequestForProfile, fetchCompatibility, userId, activeTab]);

    useEffect(() => {
        if (!userId) return;
        fetchTabPosts(userId, activeTab);
    }, [activeTab, userId, fetchTabPosts]);

    useFocusEffect(
        useCallback(() => {
            (async () => {
                await Promise.all([
                    fetchUser(),
                    fetchTabPosts(userId, activeTab),
                    fetchPendingRequestForProfile(),
                    fetchCompatibility(),
                    refreshMe(),
                ]);
            })();
        }, [fetchUser, fetchTabPosts, fetchPendingRequestForProfile, fetchCompatibility, refreshMe, userId, activeTab])
    );

    useEffect(() => {
        const unsub = subscribe((event) => {
            if (event.type !== "FOLLOW_TOGGLED") return;
            if (event.targetId?.toString?.() !== userId?.toString?.()) return;

            setUser((prev: any) => {
                if (!prev) return prev;
                const nextFollowing = event.following;

                return {
                    ...prev,
                    followStatus: nextFollowing ? "following" : "none",
                    followers: Math.max(0, (prev.followers || 0) + (nextFollowing ? 1 : -1)),
                };
            });

            setIsPrivateLocked((prev) => {
                if (event.following) return false;
                return prev;
            });
        });

        return unsub;
    }, [subscribe, userId]);

    const loadMore = useCallback(async () => {
        if (!cursor || loadingMore || !hasMore || isPrivateLocked) return;

        try {
            setLoadingMore(true);

            const token = await getStoredToken();

            const res = await fetch(
                `${API_URL}/api/posts/user/${userId}?tab=${activeTab}&limit=${LIMIT}&cursor=${encodeURIComponent(cursor)}`,
                { headers: token ? { Authorization: `Bearer ${token}` } : {} }
            );

            const json = await safeJson(res);

            if (!res.ok) return;

            setPosts((prev) => [...prev, ...(json?.posts || [])]);
            setCursor(json?.nextCursor || null);
            setHasMore(!!json?.nextCursor);
            setIsPrivateLocked(!!json?.isPrivateLocked);
        } finally {
            setLoadingMore(false);
        }
    }, [cursor, loadingMore, hasMore, userId, activeTab, isPrivateLocked]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([
            fetchUser(),
            fetchTabPosts(userId, activeTab),
            fetchPendingRequestForProfile(),
            fetchCompatibility(),
            refreshMe(),
        ]);
        setRefreshing(false);
    }, [fetchUser, fetchTabPosts, fetchPendingRequestForProfile, fetchCompatibility, refreshMe, userId, activeTab]);

    const handleFollowToggle = useCallback(async () => {
        if (isSelf || followLoading) return;

        setFollowLoading(true);
        try {
            const r = await toggleFollow(userId);
            if (!r.ok) {
                Alert.alert("Erreur", r.error || "Impossible de modifier le suivi.");
                return;
            }

            setUser((prev: any) => {
                if (!prev) return prev;

                const prevFollowers = Number(prev.followers || 0);

                if (r.status === "requested") {
                    return {
                        ...prev,
                        followStatus: "requested",
                    };
                }

                if (r.status === "following") {
                    return {
                        ...prev,
                        followStatus: "following",
                        followers: prev.followStatus === "following" ? prevFollowers : prevFollowers + 1,
                    };
                }

                return {
                    ...prev,
                    followStatus: "none",
                    followers:
                        prev.followStatus === "following"
                            ? Math.max(0, prevFollowers - 1)
                            : prevFollowers,
                };
            });

            await Promise.all([
                fetchTabPosts(userId, activeTab),
                fetchPendingRequestForProfile(),
                fetchCompatibility(),
                refreshMe(),
            ]);
        } finally {
            setFollowLoading(false);
        }
    }, [
        isSelf,
        followLoading,
        toggleFollow,
        userId,
        fetchTabPosts,
        activeTab,
        fetchPendingRequestForProfile,
        fetchCompatibility,
        refreshMe,
    ]);

    const handleRequestAction = useCallback(
        async (action: "accept" | "decline") => {
            if (!pendingRequestId || requestActionLoading) return;

            const token = await getStoredToken();
            if (!token) {
                Alert.alert("Erreur", "Tu n'es pas connecté.");
                return;
            }

            setRequestActionLoading(true);
            try {
                const res = await fetch(
                    `${API_URL}/api/follow/requests/${pendingRequestId}`,
                    {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ action }),
                    }
                );

                const json = await safeJson(res);
                if (!res.ok) {
                    Alert.alert("Erreur", json?.error || "Impossible de traiter la demande.");
                    return;
                }

                setPendingRequestId(null);

                await Promise.all([
                    fetchUser(),
                    fetchTabPosts(userId, activeTab),
                    fetchPendingRequestForProfile(),
                    fetchCompatibility(),
                    refreshMe(),
                ]);

                if (action === "accept") {
                    setIsPrivateLocked(false);
                }
            } finally {
                setRequestActionLoading(false);
            }
        },
        [
            pendingRequestId,
            requestActionLoading,
            fetchUser,
            fetchTabPosts,
            fetchPendingRequestForProfile,
            fetchCompatibility,
            refreshMe,
            userId,
            activeTab,
        ]
    );

    const canMessage = useMemo(() => {
        if (isSelf) return true;
        if (!user) return false;
        if ((user.messagePrivacy || "everyone") === "everyone") return true;
        return isFollowing;
    }, [isSelf, user, isFollowing]);

    const notificationsMutedByMe = !!user?.notificationsMutedByMe;

    const handleToggleProfileNotifications = useCallback(async () => {
        if (isSelf || muteNotificationsLoading) return;

        const token = await getStoredToken();
        if (!token) {
            Alert.alert("Erreur", "Tu n'es pas connecté.");
            return;
        }

        const nextMuted = !notificationsMutedByMe;
        setMuteNotificationsLoading(true);
        setUser((prev: any) =>
            prev ? { ...prev, notificationsMutedByMe: nextMuted } : prev
        );

        try {
            const res = await fetch(`${API_URL}/api/user/notification-mutes/${userId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
                },
                body: JSON.stringify({ muted: nextMuted }),
            });
            const json = await safeJson(res);

            if (!res.ok) {
                throw new Error(json?.error || "Impossible de modifier les notifications.");
            }

            setUser((prev: any) =>
                prev ? { ...prev, notificationsMutedByMe: !!json?.muted } : prev
            );
        } catch (e) {
            setUser((prev: any) =>
                prev ? { ...prev, notificationsMutedByMe } : prev
            );
            Alert.alert("Réglage impossible", "Réessaie dans quelques secondes.");
        } finally {
            setMuteNotificationsLoading(false);
        }
    }, [isSelf, muteNotificationsLoading, notificationsMutedByMe, userId]);

    const openChat = useCallback(async () => {
        if (isSelf) return;
        if (!user?._id) return;
        if (openingChat) return;

        if (!canMessage) {
            Alert.alert(
                "Messages limités",
                "Cet utilisateur accepte uniquement les messages des comptes qu’il suit."
            );
            return;
        }

        const token = await getStoredToken();
        if (!token) {
            Alert.alert("Erreur", "Tu n'es pas connecté.");
            return;
        }

        setOpeningChat(true);
        try {
            const res = await fetch(`${API_URL}/api/conversations`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ otherUserId: user._id }),
            });

            const json = await safeJson(res);
            if (!res.ok) {
                Alert.alert("Erreur", json?.error || "Impossible d'ouvrir la conversation.");
                return;
            }

            const conversationId =
                json?.conversation?._id || json?.conversationId || json?._id || null;

            if (!conversationId) {
                Alert.alert("Erreur", "Conversation introuvable.");
                return;
            }

            navigation.navigate("Main", {
                screen: "Notifications",
                params: {
                    screen: "Chat",
                    params: {
                        conversationId,
                        otherUser: {
                            _id: user._id,
                            pseudo: user.pseudo,
                            avatarUrl: user.avatarUrl || "",
                            isOnline: user.isOnline || false,
                            lastSeenAt: user.lastSeenAt || null,
                        },
                    },
                },
            });
        } finally {
            setOpeningChat(false);
        }
    }, [isSelf, user, openingChat, navigation, canMessage]);

    const pinnedTrack = user?.pinnedTrack as MusicRef | null;
    const favoriteArtists = (user?.favoriteArtists || []) as MusicRef[];
    const favoriteAlbums = (user?.favoriteAlbums || []) as MusicRef[];
    const favoriteTracks = (user?.favoriteTracks || []) as MusicRef[];

    const isPinnedCurrent =
        !!pinnedTrack &&
        !!currentTrack &&
        currentTrack.title === pinnedTrack.title &&
        currentTrack.artist === pinnedTrack.artist &&
        currentTrack.url === (pinnedTrack.previewUrl || "");

    const canPlayPinned =
        !!pinnedTrack &&
        pinnedTrack.entityType === "song" &&
        !!pinnedTrack.previewUrl;

    const handlePlayPinned = useCallback(async () => {
        if (!pinnedTrack || !canPlayPinned) return;

        if (isPinnedCurrent) {
            await togglePlay();
            return;
        }

        await playPreview({
            title: pinnedTrack.title,
            artist: pinnedTrack.artist,
            url: pinnedTrack.previewUrl,
            coverUrl: pinnedTrack.coverUrl,
        });
    }, [pinnedTrack, canPlayPinned, isPinnedCurrent, togglePlay, playPreview]);

    if (loadingInitial || !user) {
        return <AppScreenLoader label="Chargement du profil..." />;
    }

    const TabButton = ({ tab, label }: { tab: ProfileTab; label: string }) => {
        const active = activeTab === tab;
        return (
            <TouchableOpacity
                style={[styles.tabBtn, active && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.85}
            >
                <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
            </TouchableOpacity>
        );
    };

    const followButtonLabel =
        followStatus === "requested"
            ? "Demandé"
            : followStatus === "following"
                ? "Ne plus suivre"
                : user?.isPrivate
                    ? "Demander"
                    : "Suivre";

    const Header = () => (
        <View>
            <View style={styles.heroWrap}>
                <View style={styles.bannerBox}>
                    {user.bannerUrl ? (
                        <Image
                            source={{ uri: user.bannerUrl }}
                            style={styles.banner}
                            resizeMode="cover"
                        />
                    ) : (
                        <DefaultBanner style={styles.banner} />
                    )}
                    <View style={styles.bannerOverlay} />
                </View>

                <View style={[styles.topActionsLeft, { top: insets.top + 10 }]}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="arrow-back" size={20} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.identityBlock}>
                <View style={styles.identityTopRow}>
                    <View style={styles.avatarWrap}>
                        {user.avatarUrl ? (
                            <Image
                                source={{ uri: user.avatarUrl }}
                                style={styles.avatar}
                                resizeMode="cover"
                            />
                        ) : (
                            <DefaultAvatar label={user.pseudo} seed={user._id} size={112} style={styles.avatar} />
                        )}
                    </View>

                    {!isFollowing ? (
                        <View style={styles.profileStatusPill}>
                            <Ionicons
                                name={user?.isPrivate ? "lock-closed" : "pulse"}
                                size={13}
                                color={colors.primary}
                            />
                            <Text style={styles.profileStatusText}>
                                {user?.isPrivate ? "Privé" : "Public"}
                            </Text>
                        </View>
                    ) : null}
                </View>

                <Text style={styles.pseudo}>{user.pseudo}</Text>
                <Text style={styles.bio}>{user.bio || "Aucune bio."}</Text>

                <View style={styles.badgesRow}>
                    {user?.isPrivate ? (
                        <View style={styles.badge}>
                            <Ionicons name="lock-closed" size={12} color={colors.text} />
                            <Text style={styles.badgeText}>Compte privé</Text>
                        </View>
                    ) : null}

                    {user?.messagePrivacy === "following" ? (
                        <View style={styles.badgeSecondary}>
                            <Ionicons
                                name="chatbubble-ellipses-outline"
                                size={12}
                                color={colors.text}
                            />
                            <Text style={styles.badgeText}>Messages abonnements</Text>
                        </View>
                    ) : null}
                </View>
            </View>

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

            {!isSelf && compatibility && !compatibility.locked ? (
                <View style={styles.compatCard}>
                    <View style={styles.compatTopRow}>
                        <View style={styles.compatScoreWrap}>
                            <Text style={styles.compatScore}>{compatibility.score || 0}</Text>
                            <Text style={styles.compatScoreMax}>%</Text>
                        </View>

                        <View style={styles.compatCopy}>
                            <Text style={styles.compatEyebrow}>Compatibilité musicale</Text>
                            <Text style={styles.compatTitle}>
                                {(compatibility.score || 0) >= 70
                                    ? "Vous êtes sur la même longueur d’onde."
                                    : (compatibility.score || 0) >= 45
                                        ? "Il y a de quoi comparer vos goûts."
                                        : "Vos goûts risquent de débattre."}
                            </Text>
                        </View>
                    </View>

                    {compatibility.sharedArtists?.length ? (
                        <Text style={styles.compatMeta} numberOfLines={2}>
                            En commun : {compatibility.sharedArtists.slice(0, 3).join(", ")}
                        </Text>
                    ) : compatibility.sharedEntities?.length ? (
                        <Text style={styles.compatMeta} numberOfLines={2}>
                            Vous avez déjà noté {compatibility.sharedEntities.length} même son.
                        </Text>
                    ) : (
                        <Text style={styles.compatMeta}>
                            Note plus de sons pour affiner la comparaison.
                        </Text>
                    )}

                    {compatibility.disagreements?.length ? (
                        <View style={styles.compatDebateRow}>
                            <Ionicons name="flash-outline" size={13} color={colors.warning} />
                            <Text style={styles.compatDebateText} numberOfLines={1}>
                                Désaccord sur {compatibility.disagreements[0].title}
                            </Text>
                        </View>
                    ) : null}
                </View>
            ) : null}

            {!isSelf && pendingRequestId ? (
                <View style={styles.requestCard}>
                    <View style={styles.requestHeader}>
                        <View style={styles.requestIconWrap}>
                            <Ionicons name="person-add-outline" size={15} color={colors.primary} />
                        </View>
                        <Text style={styles.requestTitle}>Demande en attente</Text>
                    </View>

                    <Text style={styles.requestText}>
                        {user.pseudo} a demandé à te suivre.
                    </Text>

                    <View style={styles.requestActionsRow}>
                        <TouchableOpacity
                            style={[styles.requestDeclineBtn, requestActionLoading && { opacity: 0.7 }]}
                            activeOpacity={0.85}
                            disabled={requestActionLoading}
                            onPress={() => handleRequestAction("decline")}
                        >
                            <Text style={styles.requestDeclineText}>
                                {requestActionLoading ? "..." : "Refuser"}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.requestAcceptBtn, requestActionLoading && { opacity: 0.7 }]}
                            activeOpacity={0.85}
                            disabled={requestActionLoading}
                            onPress={() => handleRequestAction("accept")}
                        >
                            <Text style={styles.requestAcceptText}>
                                {requestActionLoading ? "..." : "Accepter"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : !isSelf ? (
                <>
                    <View style={styles.actionsRow}>
                        <TouchableOpacity
                            onPress={openChat}
                            style={[
                                styles.msgBtn,
                                !canMessage && styles.msgBtnDisabled,
                                openingChat && { opacity: 0.7 },
                            ]}
                            activeOpacity={0.85}
                            disabled={openingChat}
                        >
                            <Text style={styles.msgText}>
                                {openingChat
                                    ? "Ouverture..."
                                    : canMessage
                                        ? "Message"
                                        : "Messages limités"}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleFollowToggle}
                            style={[
                                styles.followBtn,
                                isFollowing ? styles.following : styles.notFollowing,
                                followStatus === "requested" && styles.requestedBtn,
                                followLoading && { opacity: 0.7 },
                            ]}
                            activeOpacity={0.85}
                            disabled={followLoading}
                        >
                            <Text style={styles.followText}>{followButtonLabel}</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.profileNotifBtn,
                            notificationsMutedByMe && styles.profileNotifBtnMuted,
                            muteNotificationsLoading && { opacity: 0.7 },
                        ]}
                        activeOpacity={0.85}
                        disabled={muteNotificationsLoading}
                        onPress={handleToggleProfileNotifications}
                    >
                        <Ionicons
                            name={notificationsMutedByMe ? "notifications-off-outline" : "notifications-outline"}
                            size={17}
                            color={notificationsMutedByMe ? colors.textMuted : colors.primary}
                        />
                        <Text
                            style={[
                                styles.profileNotifText,
                                notificationsMutedByMe && styles.profileNotifTextMuted,
                            ]}
                        >
                            {notificationsMutedByMe
                                ? "Notifications coupées pour ce profil"
                                : "Recevoir ses notifications"}
                        </Text>
                    </TouchableOpacity>
                </>
            ) : null}

            <SectionBlock title="Son épinglé" icon="musical-notes-outline">
                {pinnedTrack ? (
                    <TouchableOpacity
                        activeOpacity={canPlayPinned ? 0.9 : 1}
                        onPress={canPlayPinned ? handlePlayPinned : undefined}
                        style={[
                            styles.pinnedCard,
                            isPinnedCurrent && isPlaying && styles.pinnedCardPlaying,
                        ]}
                    >
                        {pinnedTrack.coverUrl ? (
                            <Image source={{ uri: pinnedTrack.coverUrl }} style={styles.pinnedCover} />
                        ) : (
                            <View style={[styles.pinnedCover, styles.musicPlaceholder]}>
                                <Ionicons name="musical-notes" size={22} color={colors.textMuted} />
                            </View>
                        )}

                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.pinnedLabel}>Titre du moment</Text>
                            <Text style={styles.pinnedTitle} numberOfLines={1}>
                                {pinnedTrack.title}
                            </Text>
                            <Text style={styles.pinnedArtist} numberOfLines={1}>
                                {pinnedTrack.artist}
                            </Text>
                        </View>

                        {canPlayPinned ? (
                            <View
                                style={[
                                    styles.pinnedPlayBtn,
                                    isPinnedCurrent && isPlaying && styles.pinnedPlayBtnActive,
                                ]}
                            >
                                <Ionicons
                                    name={isPinnedCurrent && isPlaying ? "pause" : "play"}
                                    size={17}
                                    color={colors.text}
                                />
                            </View>
                        ) : null}

                        {canPlayPinned ? (
                            <PlayerWave active={!!(isPinnedCurrent && isPlaying)} size="sm" />
                        ) : null}
                    </TouchableOpacity>
                ) : (
                    <EmptyMusicState text="Aucun son épinglé pour le moment." />
                )}
            </SectionBlock>

            <SectionBlock title="Artistes favoris" icon="person-outline">
                {favoriteArtists.length > 0 ? (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.horizontalList}
                    >
                        {favoriteArtists.map((item) => (
                            <MusicHorizontalCard
                                key={`artist:${item.entityId}`}
                                item={item}
                                compact
                                onPress={() =>
                                    navigation.navigate("ArtistDetail", {
                                        artistId: item.entityId,
                                        name: item.title,
                                        cover: item.coverUrl || null,
                                    })
                                }
                            />
                        ))}
                    </ScrollView>
                ) : (
                    <EmptyMusicState text="Aucun artiste favori affiché." />
                )}
            </SectionBlock>

            <SectionBlock title="Albums favoris" icon="disc-outline">
                {favoriteAlbums.length > 0 ? (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.horizontalList}
                    >
                        {favoriteAlbums.map((item) => (
                            <MusicHorizontalCard key={`album:${item.entityId}`} item={item} compact />
                        ))}
                    </ScrollView>
                ) : (
                    <EmptyMusicState text="Aucun album favori affiché." />
                )}
            </SectionBlock>

            <SectionBlock title="Morceaux favoris" icon="headset-outline">
                {favoriteTracks.length > 0 ? (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.horizontalList}
                    >
                        {favoriteTracks.map((item) => (
                            <MusicHorizontalCard key={`track:${item.entityId}`} item={item} compact />
                        ))}
                    </ScrollView>
                ) : (
                    <EmptyMusicState text="Aucun morceau favori affiché." />
                )}
            </SectionBlock>

            <View style={styles.tabsRow}>
                <TabButton tab="posts" label="Posts" />
                <TabButton tab="reposts" label="Reposts" />
                <TabButton tab="likes" label="Likes" />
            </View>
        </View>
    );

    if (isPrivateLocked && !isSelf) {
        return (
            <FlatList
                ListHeaderComponent={Header}
                data={[]}
                keyExtractor={(_, index) => String(index)}
                renderItem={() => null}
                ListEmptyComponent={
                    <PrivateLockedState
                        followStatus={followStatus}
                        onToggleFollow={handleFollowToggle}
                        loading={followLoading}
                    />
                }
                contentContainerStyle={[styles.listContentPrivate, { paddingBottom: bottomSpacing }]}
                style={styles.list}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primary}
                    />
                }
                showsVerticalScrollIndicator={false}
            />
        );
    }

    return (
        <FlatList
            ListHeaderComponent={Header}
            data={posts}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
                <View style={styles.postRow}>
                    <PostCard post={item} />
                </View>
            )}
            ListEmptyComponent={<EmptyPostsState tab={activeTab} />}
            contentContainerStyle={[styles.listContent, { paddingBottom: bottomSpacing }]}
            style={styles.list}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
                loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} /> : null
            }
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            showsVerticalScrollIndicator={false}
        />
    );
}

const styles = StyleSheet.create({
    list: {
        backgroundColor: colors.bg,
        flex: 1,
    },

    listContent: {
        paddingBottom: 60,
    },

    listContentPrivate: {
        paddingBottom: 60,
    },

    postRow: {
        paddingHorizontal: 16,
    },

    heroWrap: {
        position: "relative",
        marginTop: 0,
        marginHorizontal: 0,
    },

    bannerBox: {
        width: "100%",
        aspectRatio: 16 / 9,
        backgroundColor: colors.surface2,
        position: "relative",
        overflow: "hidden",
    },

    banner: {
        width: "100%",
        height: "100%",
    },

    bannerOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.22)",
    },

    topActionsLeft: {
        position: "absolute",
        top: 12,
        left: 12,
        zIndex: 3,
    },

    backButton: {
        width: 40,
        height: 40,
        borderRadius: radius.lg,
        backgroundColor: colors.control,
        alignItems: "center",
        justifyContent: "center",
    },

    identityBlock: {
        marginTop: -58,
        marginHorizontal: 20,
    },

    identityTopRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: spacing.md,
    },

    avatarWrap: {
        borderRadius: 999,
        padding: 4,
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.borderSoft,
    },

    avatar: {
        width: 112,
        height: 112,
        borderRadius: 56,
        borderWidth: 3,
        borderColor: colors.surface4,
        backgroundColor: colors.surface2,
    },

    profileStatusPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        backgroundColor: colors.control,
        paddingHorizontal: spacing.sm,
        paddingVertical: 7,
        borderRadius: radius.pill,
        marginBottom: spacing.sm,
    },

    profileStatusText: {
        color: colors.textSoft,
        fontSize: typography.caption,
        fontWeight: fontWeights.bold,
    },

    pseudo: {
        fontSize: 28,
        color: colors.text,
        fontWeight: fontWeights.black,
        marginTop: spacing.sm,
        lineHeight: 32,
    },

    bio: {
        color: colors.textSoft,
        fontSize: typography.body,
        lineHeight: 21,
        marginTop: 8,
    },

    badgesRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 12,
    },

    badge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: colors.dangerSoft,
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },

    badgeSecondary: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: colors.control,
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },

    badgeText: {
        color: colors.text,
        fontSize: typography.caption,
        fontWeight: fontWeights.bold,
    },

    statsRow: {
        flexDirection: "row",
        marginTop: spacing.lg,
        marginHorizontal: 20,
        paddingVertical: spacing.md,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: colors.borderSoft,
    },

    statBox: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 2,
    },

    statNumber: {
        color: colors.text,
        fontSize: 20,
        fontWeight: fontWeights.black,
    },

    statLabel: {
        color: colors.textMuted,
        fontSize: typography.caption,
        marginTop: 4,
        fontWeight: fontWeights.medium,
    },

    compatCard: {
        marginHorizontal: 16,
        marginTop: spacing.md,
        borderRadius: radius.xxl,
        padding: spacing.md,
        backgroundColor: colors.surfaceFeed,
    },

    compatTopRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
    },

    compatScoreWrap: {
        width: 62,
        height: 62,
        borderRadius: 31,
        backgroundColor: colors.primarySoft,
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "center",
        paddingBottom: 13,
    },

    compatScore: {
        color: colors.text,
        fontSize: 24,
        lineHeight: 27,
        fontWeight: fontWeights.black,
    },

    compatScoreMax: {
        color: colors.primary,
        fontSize: 13,
        lineHeight: 18,
        fontWeight: fontWeights.black,
    },

    compatCopy: {
        flex: 1,
        minWidth: 0,
    },

    compatEyebrow: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        textTransform: "uppercase",
        letterSpacing: 1.2,
        marginBottom: 4,
    },

    compatTitle: {
        color: colors.text,
        fontSize: typography.bodySm,
        lineHeight: 19,
        fontWeight: fontWeights.black,
    },

    compatMeta: {
        color: colors.textMuted,
        fontSize: typography.caption,
        lineHeight: 18,
        marginTop: spacing.sm,
        fontWeight: fontWeights.bold,
    },

    compatDebateRow: {
        marginTop: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },

    compatDebateText: {
        flex: 1,
        color: colors.textSoft,
        fontSize: typography.caption,
        fontWeight: fontWeights.extraBold,
    },

    actionsRow: {
        flexDirection: "row",
        gap: spacing.sm,
        marginHorizontal: 16,
        marginTop: spacing.md,
    },

    msgBtn: {
        flex: 1,
        backgroundColor: colors.control,
        paddingVertical: 12,
        borderRadius: radius.xl,
        alignItems: "center",
        justifyContent: "center",
    },

    msgBtnDisabled: {
        backgroundColor: colors.controlMuted,
    },

    msgText: {
        color: colors.text,
        fontWeight: fontWeights.extraBold,
        fontSize: typography.bodySm,
    },

    followBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: radius.xl,
        alignItems: "center",
        justifyContent: "center",
    },

    following: {
        backgroundColor: colors.dangerSoft,
    },

    notFollowing: {
        backgroundColor: colors.controlActive,
    },

    requestedBtn: {
        backgroundColor: colors.control,
    },

    followText: {
        color: colors.text,
        fontWeight: fontWeights.extraBold,
        fontSize: typography.bodySm,
    },

    profileNotifBtn: {
        marginHorizontal: 16,
        marginTop: spacing.sm,
        minHeight: 46,
        borderRadius: radius.xl,
        backgroundColor: colors.surfaceInset,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
    },

    profileNotifBtnMuted: {
        backgroundColor: colors.controlMuted,
    },

    profileNotifText: {
        color: colors.textSoft,
        fontSize: typography.caption,
        fontWeight: fontWeights.extraBold,
    },

    profileNotifTextMuted: {
        color: colors.textMuted,
    },

    requestCard: {
        marginHorizontal: 16,
        marginTop: 14,
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        padding: 14,
    },

    requestHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
    },

    requestIconWrap: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.control,
    },

    requestTitle: {
        color: colors.text,
        fontSize: 15,
        fontWeight: fontWeights.black,
    },

    requestText: {
        color: colors.textSoft,
        fontSize: 13,
        lineHeight: 18,
    },

    requestActionsRow: {
        flexDirection: "row",
        gap: 10,
        marginTop: 14,
    },

    requestDeclineBtn: {
        flex: 1,
        backgroundColor: colors.control,
        paddingVertical: 12,
        borderRadius: radius.lg,
        alignItems: "center",
        justifyContent: "center",
    },

    requestAcceptBtn: {
        flex: 1,
        backgroundColor: colors.controlActive,
        paddingVertical: 12,
        borderRadius: radius.lg,
        alignItems: "center",
        justifyContent: "center",
    },

    requestDeclineText: {
        color: colors.text,
        fontWeight: fontWeights.extraBold,
        fontSize: typography.bodySm,
    },

    requestAcceptText: {
        color: colors.text,
        fontWeight: fontWeights.extraBold,
        fontSize: typography.bodySm,
    },

    sectionBlock: {
        marginTop: spacing.md,
        marginHorizontal: 16,
        backgroundColor: colors.surfaceFeed,
        borderRadius: radius.xxl,
        padding: spacing.md,
    },

    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
    },

    sectionIconWrap: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primaryFaint,
    },

    sectionBlockTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: fontWeights.black,
    },

    pinnedCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surfaceRaised,
        borderRadius: radius.xl,
        padding: spacing.md,
        gap: spacing.md,
    },

    pinnedCardPlaying: {
        backgroundColor: colors.control,
    },

    pinnedCover: {
        width: 64,
        height: 64,
        borderRadius: radius.lg,
        backgroundColor: colors.surface4,
    },

    pinnedLabel: {
        color: colors.primary,
        fontSize: typography.caption,
        fontWeight: fontWeights.black,
        marginBottom: 4,
        letterSpacing: 0.6,
    },

    pinnedTitle: {
        color: colors.text,
        fontSize: 15,
        fontWeight: fontWeights.black,
    },

    pinnedArtist: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        marginTop: 4,
    },

    pinnedPlayBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.controlActive,
    },

    pinnedPlayBtnActive: {
        backgroundColor: colors.primary,
    },

    horizontalList: {
        paddingRight: 8,
    },

    musicCard: {
        width: 148,
        marginRight: spacing.sm,
        backgroundColor: colors.surfaceRaised,
        borderRadius: radius.xl,
        padding: spacing.sm,
    },

    musicCardCompact: {
        width: 148,
    },

    musicCardCover: {
        width: "100%",
        height: 124,
        borderRadius: radius.lg,
        backgroundColor: colors.surface4,
        marginBottom: spacing.sm,
    },

    musicPlaceholder: {
        alignItems: "center",
        justifyContent: "center",
    },

    musicCardTitle: {
        color: colors.text,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.extraBold,
        lineHeight: 18,
    },

    musicCardArtist: {
        color: colors.textMuted,
        fontSize: typography.caption,
        marginTop: 4,
        lineHeight: 16,
    },

    emptyBox: {
        alignItems: "flex-start",
        gap: 8,
        backgroundColor: colors.surfaceRaised,
        borderRadius: radius.xl,
        padding: 14,
    },

    emptyText: {
        color: colors.textMuted,
        fontSize: 13,
        lineHeight: 18,
    },

    privateBox: {
        marginHorizontal: 16,
        marginTop: 8,
        padding: 20,
        borderRadius: radius.xl,
        backgroundColor: colors.surfaceFeed,
        alignItems: "center",
    },

    privateIconWrap: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primaryFaint,
    },

    privateTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: fontWeights.black,
        marginTop: 12,
    },

    privateText: {
        color: colors.textMuted,
        fontSize: 13,
        lineHeight: 19,
        marginTop: 8,
        textAlign: "center",
    },

    privateBtn: {
        marginTop: 16,
        backgroundColor: colors.controlActive,
        borderRadius: radius.lg,
        paddingVertical: 12,
        paddingHorizontal: 18,
    },

    privateBtnText: {
        color: colors.text,
        fontWeight: fontWeights.extraBold,
        fontSize: typography.bodySm,
    },

    tabsRow: {
        flexDirection: "row",
        gap: spacing.sm,
        marginHorizontal: 16,
        marginTop: spacing.lg,
        marginBottom: spacing.md,
        backgroundColor: colors.surfaceInset,
        borderRadius: radius.xxl,
        padding: 4,
    },

    tabBtn: {
        flex: 1,
        borderRadius: radius.lg,
        paddingVertical: 11,
        alignItems: "center",
    },

    tabBtnActive: {
        backgroundColor: colors.control,
    },

    tabBtnText: {
        color: colors.textMuted,
        fontWeight: fontWeights.extraBold,
        fontSize: typography.bodySm,
    },

    tabBtnTextActive: {
        color: colors.text,
    },

    emptyPostsBox: {
        marginHorizontal: 16,
        marginTop: 6,
        padding: 16,
        borderRadius: radius.xl,
        backgroundColor: colors.surfaceFeed,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    emptyPostsText: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        flex: 1,
    },

});
