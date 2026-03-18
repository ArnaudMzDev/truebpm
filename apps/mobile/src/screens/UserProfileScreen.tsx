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
import { API_URL } from "../lib/config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import PostCard from "../components/PostCard";
import { PostType } from "../components/PostCard/types";
import { useUser } from "../context/UserContext";
import { usePlayer } from "../context/PlayerContext";

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

function MusicHorizontalCard({
                                 item,
                                 compact = false,
                             }: {
    item: MusicRef;
    compact?: boolean;
}) {
    return (
        <View style={[styles.musicCard, compact && styles.musicCardCompact]}>
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
                        size={18}
                        color="#9a9a9a"
                    />
                </View>
            )}

            <Text style={styles.musicCardTitle} numberOfLines={1}>
                {item.title}
            </Text>
            <Text style={styles.musicCardArtist} numberOfLines={1}>
                {item.artist}
            </Text>
        </View>
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
                <Ionicons name={icon} size={16} color="#9B5CFF" />
                <Text style={styles.sectionBlockTitle}>{title}</Text>
            </View>
            {children}
        </View>
    );
}

function EmptyMusicState({ text }: { text: string }) {
    return (
        <View style={styles.emptyBox}>
            <Ionicons name="sparkles-outline" size={16} color="#777" />
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
            <Ionicons name="albums-outline" size={18} color="#777" />
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
            <Ionicons name="lock-closed" size={20} color="#fff" />
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

    const { me, toggleFollow, subscribe } = useUser();
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

    const LIMIT = 15;

    const isSelf = useMemo(() => {
        return me?._id?.toString?.() === userId?.toString?.();
    }, [me, userId]);

    const followStatus = (user?.followStatus || "none") as FollowStatus;
    const isFollowing = followStatus === "following";

    const fetchUser = useCallback(async () => {
        const token = await AsyncStorage.getItem("token");

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

    const fetchTabPosts = useCallback(async (uid: string, tab: ProfileTab) => {
        const token = await AsyncStorage.getItem("token");

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
            await Promise.all([fetchUser(), fetchTabPosts(userId, activeTab)]);
            setLoadingInitial(false);
        })();
    }, [fetchUser, fetchTabPosts, userId]);

    useEffect(() => {
        if (!userId) return;
        fetchTabPosts(userId, activeTab);
    }, [activeTab, userId, fetchTabPosts]);

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

            const token = await AsyncStorage.getItem("token");

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
        await Promise.all([fetchUser(), fetchTabPosts(userId, activeTab)]);
        setRefreshing(false);
    }, [fetchUser, fetchTabPosts, userId, activeTab]);

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
                    followers: prev.followStatus === "following" ? Math.max(0, prevFollowers - 1) : prevFollowers,
                };
            });

            await fetchTabPosts(userId, activeTab);
        } finally {
            setFollowLoading(false);
        }
    }, [isSelf, followLoading, toggleFollow, userId, fetchTabPosts, activeTab]);

    const canMessage = useMemo(() => {
        if (isSelf) return true;
        if (!user) return false;
        if ((user.messagePrivacy || "everyone") === "everyone") return true;
        return isFollowing;
    }, [isSelf, user, isFollowing]);

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

        const token = await AsyncStorage.getItem("token");
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
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color="#9B5CFF" />
            </View>
        );
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
            <View style={styles.bannerBox}>
                <Image
                    source={{ uri: user.bannerUrl || "https://picsum.photos/600/200" }}
                    style={styles.banner}
                />
                <View style={styles.bannerOverlay} />
            </View>

            <View style={styles.identityBlock}>
                <Image
                    source={{ uri: user.avatarUrl || "https://picsum.photos/200" }}
                    style={styles.avatar}
                />

                <Text style={styles.pseudo}>{user.pseudo}</Text>
                <Text style={styles.bio}>{user.bio || "Aucune bio."}</Text>

                <View style={styles.badgesRow}>
                    {user?.isPrivate ? (
                        <View style={styles.badge}>
                            <Ionicons name="lock-closed" size={12} color="#fff" />
                            <Text style={styles.badgeText}>Compte privé</Text>
                        </View>
                    ) : null}

                    {user?.messagePrivacy === "following" ? (
                        <View style={styles.badgeSecondary}>
                            <Ionicons name="chatbubble-ellipses-outline" size={12} color="#fff" />
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

            {!isSelf && (
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
            )}

            <SectionBlock title="Son épinglé" icon="musical-notes-outline">
                {pinnedTrack ? (
                    <TouchableOpacity
                        activeOpacity={canPlayPinned ? 0.9 : 1}
                        onPress={canPlayPinned ? handlePlayPinned : undefined}
                        style={[styles.pinnedCard, isPinnedCurrent && isPlaying && styles.pinnedCardPlaying]}
                    >
                        {pinnedTrack.coverUrl ? (
                            <Image source={{ uri: pinnedTrack.coverUrl }} style={styles.pinnedCover} />
                        ) : (
                            <View style={[styles.pinnedCover, styles.musicPlaceholder]}>
                                <Ionicons name="musical-notes" size={22} color="#999" />
                            </View>
                        )}

                        <View style={{ flex: 1 }}>
                            <Text style={styles.pinnedLabel}>Titre du moment</Text>
                            <Text style={styles.pinnedTitle} numberOfLines={1}>
                                {pinnedTrack.title}
                            </Text>
                            <Text style={styles.pinnedArtist} numberOfLines={1}>
                                {pinnedTrack.artist}
                            </Text>
                        </View>

                        {canPlayPinned ? (
                            <View style={[styles.pinnedPlayBtn, isPinnedCurrent && isPlaying && styles.pinnedPlayBtnActive]}>
                                <Ionicons
                                    name={isPinnedCurrent && isPlaying ? "pause" : "play"}
                                    size={18}
                                    color="#fff"
                                />
                            </View>
                        ) : null}
                    </TouchableOpacity>
                ) : (
                    <EmptyMusicState text="Aucun son épinglé pour le moment." />
                )}
            </SectionBlock>

            <SectionBlock title="Artistes favoris" icon="person-outline">
                {favoriteArtists.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
                        {favoriteArtists.map((item) => (
                            <MusicHorizontalCard key={`artist:${item.entityId}`} item={item} compact />
                        ))}
                    </ScrollView>
                ) : (
                    <EmptyMusicState text="Aucun artiste favori affiché." />
                )}
            </SectionBlock>

            <SectionBlock title="Albums favoris" icon="disc-outline">
                {favoriteAlbums.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
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
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
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
                keyExtractor={(item) => item._id}
                renderItem={() => null}
                ListEmptyComponent={
                    <PrivateLockedState
                        followStatus={followStatus}
                        onToggleFollow={handleFollowToggle}
                        loading={followLoading}
                    />
                }
                contentContainerStyle={{ paddingBottom: 60 }}
                style={{ backgroundColor: "#000" }}
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

    return (
        <FlatList
            ListHeaderComponent={Header}
            data={posts}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => <PostCard post={item} />}
            ListEmptyComponent={<EmptyPostsState tab={activeTab} />}
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
    loading: {
        flex: 1,
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
    },

    bannerBox: {
        width: "100%",
        height: 190,
        backgroundColor: "#111",
        position: "relative",
    },
    banner: {
        width: "100%",
        height: "100%",
    },
    bannerOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.18)",
    },

    identityBlock: {
        marginTop: -48,
        paddingHorizontal: 20,
    },
    avatar: {
        width: 96,
        height: 96,
        borderRadius: 48,
        borderWidth: 4,
        borderColor: "#000",
        backgroundColor: "#111",
    },
    pseudo: {
        fontSize: 24,
        color: "#fff",
        fontWeight: "800",
        marginTop: 12,
    },
    bio: {
        color: "#c9c9c9",
        fontSize: 14,
        lineHeight: 20,
        marginTop: 8,
        marginRight: 16,
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
        backgroundColor: "#2A1A1A",
        borderWidth: 1,
        borderColor: "#4B2A2A",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    badgeSecondary: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "#151515",
        borderWidth: 1,
        borderColor: "#272727",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    badgeText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "700",
    },

    statsRow: {
        flexDirection: "row",
        marginTop: 22,
        marginHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: "#0f0f0f",
        borderWidth: 1,
        borderColor: "#1c1c1c",
        borderRadius: 16,
    },
    statBox: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 10,
    },
    statNumber: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "800",
    },
    statLabel: {
        color: "#8f8f8f",
        fontSize: 12,
        marginTop: 4,
        fontWeight: "600",
    },

    actionsRow: {
        flexDirection: "row",
        gap: 12,
        marginHorizontal: 16,
        marginTop: 14,
    },
    msgBtn: {
        flex: 1,
        backgroundColor: "#191919",
        borderWidth: 1,
        borderColor: "#2a2a2a",
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    msgBtnDisabled: {
        backgroundColor: "#101010",
        borderColor: "#202020",
    },
    msgText: {
        color: "#fff",
        fontWeight: "800",
    },
    followBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    following: {
        backgroundColor: "#330000",
        borderWidth: 1,
        borderColor: "#FF4444",
    },
    notFollowing: {
        backgroundColor: "#5E17EB",
    },
    requestedBtn: {
        backgroundColor: "#26203A",
        borderWidth: 1,
        borderColor: "#5E17EB",
    },
    followText: {
        color: "#fff",
        fontWeight: "800",
    },

    sectionBlock: {
        marginTop: 22,
        marginHorizontal: 16,
        backgroundColor: "#0d0d0d",
        borderWidth: 1,
        borderColor: "#1c1c1c",
        borderRadius: 18,
        padding: 14,
    },
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
    },
    sectionBlockTitle: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "800",
    },

    pinnedCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#131313",
        borderWidth: 1,
        borderColor: "#242424",
        borderRadius: 16,
        padding: 12,
        gap: 12,
    },
    pinnedCardPlaying: {
        borderColor: "#6f37f0",
        backgroundColor: "#151022",
    },
    pinnedCover: {
        width: 60,
        height: 60,
        borderRadius: 12,
        backgroundColor: "#1a1a1a",
    },
    pinnedLabel: {
        color: "#9B5CFF",
        fontSize: 12,
        fontWeight: "800",
        marginBottom: 4,
    },
    pinnedTitle: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "800",
    },
    pinnedArtist: {
        color: "#a6a6a6",
        fontSize: 13,
        marginTop: 4,
    },
    pinnedPlayBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#5E17EB",
    },
    pinnedPlayBtnActive: {
        backgroundColor: "#7B3DFF",
    },

    horizontalList: {
        paddingRight: 6,
    },
    musicCard: {
        width: 132,
        marginRight: 10,
        backgroundColor: "#131313",
        borderWidth: 1,
        borderColor: "#232323",
        borderRadius: 14,
        padding: 10,
    },
    musicCardCompact: {
        width: 128,
    },
    musicCardCover: {
        width: "100%",
        height: 108,
        borderRadius: 10,
        backgroundColor: "#1b1b1b",
        marginBottom: 10,
    },
    musicPlaceholder: {
        alignItems: "center",
        justifyContent: "center",
    },
    musicCardTitle: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "800",
    },
    musicCardArtist: {
        color: "#8d8d8d",
        fontSize: 12,
        marginTop: 4,
    },

    emptyBox: {
        alignItems: "flex-start",
        gap: 8,
        backgroundColor: "#131313",
        borderWidth: 1,
        borderColor: "#232323",
        borderRadius: 14,
        padding: 14,
    },
    emptyText: {
        color: "#8c8c8c",
        fontSize: 13,
        lineHeight: 18,
    },

    privateBox: {
        marginHorizontal: 16,
        marginTop: 8,
        padding: 18,
        borderRadius: 18,
        backgroundColor: "#111",
        borderWidth: 1,
        borderColor: "#232323",
        alignItems: "center",
    },
    privateTitle: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "800",
        marginTop: 12,
    },
    privateText: {
        color: "#888",
        fontSize: 13,
        lineHeight: 19,
        marginTop: 8,
        textAlign: "center",
    },
    privateBtn: {
        marginTop: 16,
        backgroundColor: "#5E17EB",
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 18,
    },
    privateBtnText: {
        color: "#fff",
        fontWeight: "800",
    },

    tabsRow: {
        flexDirection: "row",
        gap: 10,
        marginHorizontal: 16,
        marginTop: 24,
        marginBottom: 12,
    },
    tabBtn: {
        flex: 1,
        backgroundColor: "#111",
        borderWidth: 1,
        borderColor: "#232323",
        borderRadius: 12,
        paddingVertical: 11,
        alignItems: "center",
    },
    tabBtnActive: {
        backgroundColor: "#5E17EB",
        borderColor: "#5E17EB",
    },
    tabBtnText: {
        color: "#b8b8b8",
        fontWeight: "800",
        fontSize: 13,
    },
    tabBtnTextActive: {
        color: "#fff",
    },

    emptyPostsBox: {
        marginHorizontal: 16,
        marginTop: 6,
        padding: 16,
        borderRadius: 16,
        backgroundColor: "#111",
        borderWidth: 1,
        borderColor: "#1f1f1f",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    emptyPostsText: {
        color: "#8b8b8b",
        fontSize: 13,
        flex: 1,
    },
});