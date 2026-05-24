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
import {
    colors,
    spacing,
    radius,
    typography,
    fontWeights,
    shadows,
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
                <View style={styles.sectionIconWrap}>
                    <Ionicons name={icon} size={15} color={colors.primary} />
                </View>
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
            <Ionicons name="sparkles-outline" size={16} color={colors.textMuted} />
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
            <Ionicons name="albums-outline" size={18} color={colors.textMuted} />
            <Text style={styles.emptyPostsText}>{text}</Text>
        </View>
    );
}

function MiniWave({ active }: { active: boolean }) {
    return (
        <View style={styles.waveWrap}>
            {[0, 1, 2].map((i) => (
                <View
                    key={i}
                    style={[
                        styles.waveBar,
                        {
                            height: i === 1 ? 16 : i === 0 ? 11 : 8,
                            backgroundColor: active ? colors.primary : colors.textFaint,
                            opacity: active ? 0.95 : 0.45,
                        },
                    ]}
                />
            ))}
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
                `${API_URL}/api/posts/user/${encodeURIComponent(
                    user._id
                )}?tab=${activeTab}&limit=${LIMIT}&cursor=${encodeURIComponent(cursor)}`,
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
    }, [fetchMe, fetchTabPosts, activeTab]);

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

    const handleDeleted = useCallback((deletedId: string) => {
        setPosts((prev) =>
            prev.filter((p: any) => {
                if (String(p._id) === String(deletedId)) return false;
                const repostOfId = p?.repostOf?._id;
                if (repostOfId && String(repostOfId) === String(deletedId)) return false;
                return true;
            })
        );
    }, []);

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
                <ActivityIndicator size="large" color={colors.primary} />
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

    const HeaderBlock = () => (
        <View style={{ width: "100%" }}>
            <View style={styles.heroWrap}>
                <View style={styles.bannerBox}>
                    <Image
                        source={{ uri: user.bannerUrl || "https://picsum.photos/600/200" }}
                        style={styles.banner}
                    />
                    <View style={styles.bannerOverlay} />
                    <View style={styles.bannerShade} />
                </View>

                <View style={styles.topActions}>
                    <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => navigation.navigate("EditProfile")}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="create-outline" size={15} color={colors.text} />
                        <Text style={styles.editText}>Modifier</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.settingsButton}
                        onPress={() => navigation.navigate("Settings")}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="settings-outline" size={18} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.identityBlock}>
                <View style={styles.avatarWrap}>
                    <Image
                        source={{ uri: user.avatarUrl || "https://picsum.photos/200" }}
                        style={[styles.avatar, styles.avatarGlow]}
                    />
                </View>

                <Text style={styles.pseudo}>{user.pseudo}</Text>
                <Text style={styles.bio}>
                    {user.bio || "Ajoute une bio pour personnaliser ton univers musical."}
                </Text>

                <View style={styles.profileBadgeRow}>
                    <View style={styles.profileBadge}>
                        <Ionicons name="sparkles" size={13} color={colors.primary} />
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

                        {canPlayPinned ? <MiniWave active={!!(isPinnedCurrent && isPlaying)} /> : null}
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
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.horizontalList}
                    >
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
                    <EmptyMusicState
                        text="Ajoute tes albums de référence."
                        cta="Compléter"
                        onPress={() => navigation.navigate("EditProfile")}
                    />
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
            renderItem={({ item }) => (
                <View style={styles.postRow}>
                    <PostCard post={item} onDeleted={handleDeleted} />
                </View>
            )}
            ListHeaderComponent={HeaderBlock}
            ListEmptyComponent={<EmptyPostsState tab={activeTab} />}
            contentContainerStyle={styles.listContent}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={colors.primary}
                />
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
                loadingMore ? (
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 16 }} />
                ) : null
            }
            style={styles.list}
            showsVerticalScrollIndicator={false}
        />
    );
}

const styles = StyleSheet.create({
    list: {
        flex: 1,
        backgroundColor: colors.bg,
    },

    listContent: {
        paddingBottom: 40,
    },

    postRow: {
        paddingHorizontal: 16,
    },

    loading: {
        flex: 1,
        backgroundColor: colors.bg,
        justifyContent: "center",
        alignItems: "center",
    },

    heroWrap: {
        position: "relative",
    },

    bannerBox: {
        width: "100%",
        height: 220,
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
        backgroundColor: "rgba(0,0,0,0.18)",
    },

    bannerShade: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 90,
        backgroundColor: "rgba(0,0,0,0.45)",
    },

    topActions: {
        position: "absolute",
        top: 168,
        right: 16,
        flexDirection: "row",
        gap: 10,
        zIndex: 3,
    },

    editButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: colors.primaryDark,
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderRadius: radius.lg,
        ...shadows.glowPrimary,
    },

    editText: {
        color: colors.text,
        fontWeight: fontWeights.bold,
        fontSize: typography.bodySm,
    },

    settingsButton: {
        width: 40,
        height: 40,
        borderRadius: radius.lg,
        backgroundColor: colors.surface3,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },

    identityBlock: {
        marginTop: -52,
        paddingHorizontal: 20,
    },

    avatarWrap: {
        alignSelf: "flex-start",
        borderRadius: 999,
        padding: 4,
        backgroundColor: colors.bg,
    },

    avatar: {
        width: 104,
        height: 104,
        borderRadius: 52,
        borderWidth: 3,
        borderColor: colors.surface4,
        backgroundColor: colors.surface2,
    },

    avatarGlow: {
        shadowColor: colors.primary,
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
    },

    pseudo: {
        fontSize: 28,
        color: colors.text,
        fontWeight: fontWeights.black,
        marginTop: 12,
        lineHeight: 32,
    },

    bio: {
        color: colors.textSoft,
        fontSize: typography.body,
        lineHeight: 21,
        marginTop: 8,
        marginRight: 16,
    },

    profileBadgeRow: {
        flexDirection: "row",
        marginTop: 14,
    },

    profileBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "#12101B",
        borderWidth: 1,
        borderColor: colors.borderAccent,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radius.pill,
    },

    profileBadgeText: {
        color: colors.textSoft,
        fontSize: typography.caption,
        fontWeight: fontWeights.bold,
    },

    stats: {
        flexDirection: "row",
        marginTop: 22,
        marginHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderSoft,
        borderRadius: radius.xl,
    },

    statBtn: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 10,
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

    sectionBlock: {
        marginTop: 22,
        marginHorizontal: 16,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderSoft,
        borderRadius: radius.xxl,
        padding: 14,
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
        backgroundColor: "#151122",
        borderWidth: 1,
        borderColor: colors.borderAccent,
    },

    sectionBlockTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: fontWeights.black,
    },

    pinnedCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface3,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.xl,
        padding: 12,
        gap: 12,
    },

    pinnedCardPlaying: {
        borderColor: colors.borderAccent,
        backgroundColor: "#151022",
        ...shadows.glowPrimary,
    },

    pinnedCover: {
        width: 64,
        height: 64,
        borderRadius: 14,
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
        backgroundColor: colors.primaryDark,
    },

    pinnedPlayBtnActive: {
        backgroundColor: colors.primary,
    },

    waveWrap: {
        width: 18,
        height: 16,
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
    },

    waveBar: {
        width: 3,
        borderRadius: 999,
    },

    horizontalList: {
        paddingRight: 8,
    },

    musicCard: {
        width: 148,
        marginRight: 12,
        backgroundColor: colors.surface3,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.xl,
        padding: 12,
    },

    musicCardCompact: {
        width: 148,
    },

    musicCardCover: {
        width: "100%",
        height: 124,
        borderRadius: 14,
        backgroundColor: colors.surface4,
        marginBottom: 12,
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
        backgroundColor: colors.surface3,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.lg,
        padding: 14,
    },

    emptyText: {
        color: colors.textMuted,
        fontSize: 13,
        lineHeight: 18,
    },

    emptyCta: {
        color: colors.primary,
        fontWeight: fontWeights.extraBold,
        fontSize: typography.bodySm,
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
        backgroundColor: colors.surface2,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.lg,
        paddingVertical: 11,
        alignItems: "center",
    },

    tabBtnActive: {
        backgroundColor: colors.primaryDark,
        borderColor: colors.primaryDark,
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
        backgroundColor: colors.surface2,
        borderWidth: 1,
        borderColor: colors.borderSoft,
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