import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    FlatList,
    RefreshControl,
    ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../lib/config";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import PostCard from "../components/PostCard";
import { PostType } from "../components/PostCard/types";
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

function toBearer(rawToken: string | null) {
    if (!rawToken) return null;
    return rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;
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

function EmptyMusicState({
                             text,
                             cta,
                             onPress,
                         }: {
    text: string;
    cta?: string;
    onPress?: () => void;
}) {
    return (
        <View style={styles.emptyBox}>
            <Ionicons name="sparkles-outline" size={16} color="#777" />
            <Text style={styles.emptyText}>{text}</Text>
            {cta && onPress ? (
                <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
                    <Text style={styles.emptyCta}>{cta}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

function EmptyPostsState({ tab }: { tab: ProfileTab }) {
    const text =
        tab === "posts"
            ? "Tu n’as encore publié aucun post."
            : tab === "reposts"
                ? "Tu n’as encore reposté aucun post."
                : "Aucun like pour le moment.";

    return (
        <View style={styles.emptyPostsBox}>
            <Ionicons name="albums-outline" size={18} color="#777" />
            <Text style={styles.emptyPostsText}>{text}</Text>
        </View>
    );
}

export default function ProfileScreen({ navigation }: any) {
    const [user, setUser] = useState<any>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [activeTab, setActiveTab] = useState<ProfileTab>("posts");

    const [posts, setPosts] = useState<PostType[]>([]);
    const [initialLoadingPosts, setInitialLoadingPosts] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);

    const LIMIT = 15;

    const { playPreview, togglePlay, isPlaying, currentTrack } = usePlayer();

    const handleLogout = useCallback(async () => {
        const stored = await AsyncStorage.getItem("token");
        const bearer = toBearer(stored);

        if (bearer) {
            await fetch(`${API_URL}/api/auth/logout`, {
                method: "POST",
                headers: { Authorization: bearer },
            }).catch(() => {});
        }

        await AsyncStorage.multiRemove(["token", "user"]);
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    }, [navigation]);

    const fetchMe = useCallback(async () => {
        const stored = await AsyncStorage.getItem("token");
        const bearer = toBearer(stored);

        if (!bearer) {
            await handleLogout();
            return null;
        }

        const res = await fetch(`${API_URL}/api/user/me`, {
            method: "GET",
            headers: { Authorization: bearer },
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

    const fetchTabPosts = useCallback(async (uid: string, tab: ProfileTab) => {
        try {
            setInitialLoadingPosts(true);
            setCursor(null);
            setHasMore(true);

            const bearer = toBearer(await AsyncStorage.getItem("token"));
            if (!bearer) return;

            const res = await fetch(
                `${API_URL}/api/posts/user/${encodeURIComponent(uid)}?tab=${tab}&limit=${LIMIT}`,
                { headers: { Authorization: bearer } }
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

            const bearer = toBearer(await AsyncStorage.getItem("token"));
            if (!bearer) return;

            const res = await fetch(
                `${API_URL}/api/posts/user/${encodeURIComponent(user._id)}?tab=${activeTab}&limit=${LIMIT}&cursor=${encodeURIComponent(cursor)}`,
                { headers: { Authorization: bearer } }
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
    }, [user, cursor, loadingMore, hasMore, activeTab]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        const me = await fetchMe();
        if (me?._id) await fetchTabPosts(me._id, activeTab);
        setRefreshing(false);
    }, [fetchMe, fetchTabPosts, activeTab]);

    useEffect(() => {
        (async () => {
            setLoadingUser(true);

            const storedUser = await AsyncStorage.getItem("user");
            if (storedUser) {
                try {
                    const cached = JSON.parse(storedUser);
                    if (cached?._id) setUser(cached);
                } catch {}
            }

            const me = await fetchMe();
            setLoadingUser(false);

            if (me?._id) await fetchTabPosts(me._id, activeTab);
            else setInitialLoadingPosts(false);
        })();
    }, [fetchMe, fetchTabPosts]);

    useFocusEffect(
        useCallback(() => {
            (async () => {
                const me = await fetchMe();
                if (me?._id) await fetchTabPosts(me._id, activeTab);
            })();
        }, [fetchMe, fetchTabPosts, activeTab])
    );

    useEffect(() => {
        if (!user?._id) return;
        fetchTabPosts(user._id, activeTab);
    }, [activeTab, user?._id, fetchTabPosts]);

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

    const profileCompletion = useMemo(() => {
        let score = 0;
        if (user?.bio?.trim()) score += 1;
        if (pinnedTrack) score += 1;
        if (favoriteArtists.length) score += 1;
        if (favoriteAlbums.length) score += 1;
        if (favoriteTracks.length) score += 1;
        return score;
    }, [user?.bio, pinnedTrack, favoriteArtists.length, favoriteAlbums.length, favoriteTracks.length]);

    if (loadingUser || !user || (initialLoadingPosts && posts.length === 0)) {
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

    const Header = () => (
        <View style={{ width: "100%" }}>
            <View style={styles.bannerBox}>
                <Image
                    source={{ uri: user.bannerUrl || "https://picsum.photos/600/200" }}
                    style={styles.banner}
                />
                <View style={styles.bannerOverlay} />
            </View>

            <View style={styles.topActions}>
                <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => navigation.navigate("EditProfile")}
                    activeOpacity={0.85}
                >
                    <Ionicons name="create-outline" size={15} color="#fff" />
                    <Text style={styles.editText}>Modifier</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
                    <Ionicons name="log-out-outline" size={15} color="#FF7A7A" />
                </TouchableOpacity>
            </View>

            <View style={styles.identityBlock}>
                <Image
                    source={{ uri: user.avatarUrl || "https://picsum.photos/200" }}
                    style={[styles.avatar, styles.avatarGlow]}
                />

                <Text style={styles.pseudo}>{user.pseudo}</Text>
                <Text style={styles.bio}>{user.bio || "Ajoute une bio pour personnaliser ton univers musical."}</Text>

                <View style={styles.profileBadgeRow}>
                    <View style={styles.profileBadge}>
                        <Ionicons name="sparkles" size={13} color="#9B5CFF" />
                        <Text style={styles.profileBadgeText}>Profil musical {profileCompletion}/5</Text>
                    </View>
                </View>
            </View>

            <View style={styles.stats}>
                <TouchableOpacity
                    style={styles.statBtn}
                    onPress={() => navigation.navigate("FollowersList", { userId: user._id })}
                    activeOpacity={0.8}
                >
                    <Text style={styles.statNumber}>{user.followers || 0}</Text>
                    <Text style={styles.statLabel}>Followers</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.statBtn}
                    onPress={() => navigation.navigate("FollowingList", { userId: user._id })}
                    activeOpacity={0.8}
                >
                    <Text style={styles.statNumber}>{user.following || 0}</Text>
                    <Text style={styles.statLabel}>Following</Text>
                </TouchableOpacity>

                <View style={styles.statBtn}>
                    <Text style={styles.statNumber}>{user.notesCount || 0}</Text>
                    <Text style={styles.statLabel}>Notes</Text>
                </View>
            </View>

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
                    <EmptyMusicState
                        text="Ajoute un son épinglé pour donner le ton de ton profil."
                        cta="Choisir un son"
                        onPress={() => navigation.navigate("EditProfile")}
                    />
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
                    <EmptyMusicState
                        text="Ajoute jusqu’à 3 artistes favoris."
                        cta="Compléter"
                        onPress={() => navigation.navigate("EditProfile")}
                    />
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
                    <EmptyMusicState
                        text="Ajoute tes albums de référence."
                        cta="Compléter"
                        onPress={() => navigation.navigate("EditProfile")}
                    />
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
                    <EmptyMusicState
                        text="Ajoute tes morceaux favoris pour enrichir ton profil."
                        cta="Compléter"
                        onPress={() => navigation.navigate("EditProfile")}
                    />
                )}
            </SectionBlock>

            <View style={styles.tabsRow}>
                <TabButton tab="posts" label="Posts" />
                <TabButton tab="reposts" label="Reposts" />
                <TabButton tab="likes" label="Likes" />
            </View>
        </View>
    );

    return (
        <FlatList
            data={posts}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => <PostCard post={item} />}
            ListHeaderComponent={Header}
            ListEmptyComponent={<EmptyPostsState tab={activeTab} />}
            contentContainerStyle={{ paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9B5CFF" />}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
                loadingMore ? <ActivityIndicator size="small" color="#9B5CFF" style={{ marginVertical: 16 }} /> : null
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

    topActions: {
        position: "absolute",
        top: 146,
        right: 16,
        flexDirection: "row",
        gap: 10,
        zIndex: 3,
    },
    editButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "#5E17EB",
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 12,
    },
    editText: {
        color: "#fff",
        fontWeight: "700",
    },
    logoutButton: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: "#1a0d0d",
        borderWidth: 1,
        borderColor: "#5b2323",
        alignItems: "center",
        justifyContent: "center",
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
    avatarGlow: {
        shadowColor: "#9B5CFF",
        shadowOpacity: 0.35,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
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

    profileBadgeRow: {
        flexDirection: "row",
        marginTop: 12,
    },
    profileBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "#121212",
        borderWidth: 1,
        borderColor: "#252525",
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 999,
    },
    profileBadgeText: {
        color: "#d0d0d0",
        fontSize: 12,
        fontWeight: "700",
    },

    stats: {
        flexDirection: "row",
        marginTop: 22,
        marginHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: "#0f0f0f",
        borderWidth: 1,
        borderColor: "#1c1c1c",
        borderRadius: 16,
    },
    statBtn: {
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
    emptyCta: {
        color: "#9B5CFF",
        fontWeight: "800",
        fontSize: 13,
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