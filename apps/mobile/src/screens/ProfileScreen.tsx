import React, { useEffect, useState, useCallback, useRef } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PostCard from "../components/PostCard";
import { PostType } from "../components/PostCard/types";
import PlayerWave from "../components/PlayerWave";
import { DefaultAvatar, DefaultBanner } from "../components/ProfileFallbacks";
import AppScreenLoader from "../components/ui/AppScreenLoader";
import { usePlayer } from "../context/PlayerContext";
import { getStoredToken, clearStoredSession } from "../lib/authStorage";
import {
    colors,
    spacing,
    radius,
    typography,
    fontWeights,
    shadows,
} from "../theme";
import { useAppBottomSpacing } from "../hooks/useAppBottomSpacing";

type MusicRef = {
    entityId: string;
    entityType: "song" | "album" | "artist";
    title: string;
    artist: string;
    coverUrl: string;
    previewUrl: string;
};

type ProfileTab = "posts" | "reposts" | "likes";

type ArtistReleaseItem = {
    _id: string;
    artistId: string;
    artistName: string;
    itemId: string;
    itemType: "song" | "album";
    title: string;
    coverUrl: string;
    previewUrl: string;
    releaseDate: string;
    listenedAt: string | null;
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

function toBearer(rawToken: string | null) {
    if (!rawToken) return null;
    return rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;
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

function formatReleaseDate(value?: string) {
    if (!value) return "Sortie récente";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "Sortie récente";

    return date.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
    });
}

function ReleaseCard({
                         item,
                         listened = false,
                         loading = false,
                         active = false,
                         playing = false,
                         onOpen,
                         onPlay,
                         onToggleListened,
                     }: {
    item: ArtistReleaseItem;
    listened?: boolean;
    loading?: boolean;
    active?: boolean;
    playing?: boolean;
    onOpen: () => void;
    onPlay: () => void;
    onToggleListened: () => void;
}) {
    const canPlay = item.itemType === "song" && !!item.previewUrl;

    return (
        <TouchableOpacity
            style={styles.releaseCard}
            onPress={onOpen}
            activeOpacity={0.88}
        >
            {item.coverUrl ? (
                <Image source={{ uri: item.coverUrl }} style={styles.releaseCover} />
            ) : (
                <View style={[styles.releaseCover, styles.musicPlaceholder]}>
                    <Ionicons
                        name={item.itemType === "album" ? "disc" : "musical-notes"}
                        size={20}
                        color={colors.textMuted}
                    />
                </View>
            )}

            <View style={styles.releaseBody}>
                <View style={styles.releaseMetaRow}>
                    <Text style={styles.releaseKind}>
                        {item.itemType === "album" ? "Album" : "Son"} · {formatReleaseDate(item.releaseDate)}
                    </Text>
                </View>
                <Text style={styles.releaseTitle} numberOfLines={1}>
                    {item.title}
                </Text>
                <Text style={styles.releaseArtist} numberOfLines={1}>
                    {item.artistName}
                </Text>
            </View>

            <View style={styles.releaseActions}>
                {canPlay ? (
                    <TouchableOpacity
                        style={[styles.releaseIconButton, active && styles.releaseIconButtonActive]}
                        onPress={onPlay}
                        activeOpacity={0.85}
                    >
                        <Ionicons
                            name={active && playing ? "pause" : "play"}
                            size={14}
                            color={colors.text}
                        />
                        <PlayerWave active={active && playing} size="sm" />
                    </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                    style={[
                        styles.releaseListenButton,
                        listened && styles.releaseListenButtonDone,
                        loading && styles.releaseListenButtonLoading,
                    ]}
                    onPress={onToggleListened}
                    disabled={loading}
                    activeOpacity={0.85}
                >
                    <Ionicons
                        name={listened ? "return-up-back-outline" : "checkmark"}
                        size={14}
                        color={listened ? colors.textMuted : colors.bg}
                    />
                    <Text style={[styles.releaseListenText, listened && styles.releaseListenTextDone]}>
                        {listened ? "Remettre" : "Écouté"}
                    </Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
}

export default function ProfileScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const bottomSpacing = useAppBottomSpacing({ extra: 28 });
    const [user, setUser] = useState<any>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [activeTab, setActiveTab] = useState<ProfileTab>("posts");

    const [posts, setPosts] = useState<PostType[]>([]);
    const [initialLoadingPosts, setInitialLoadingPosts] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [releasesToListen, setReleasesToListen] = useState<ArtistReleaseItem[]>([]);
    const [releasesListened, setReleasesListened] = useState<ArtistReleaseItem[]>([]);
    const [releaseUpdatingId, setReleaseUpdatingId] = useState<string | null>(null);
    const releaseSyncStartedRef = useRef(false);

    const LIMIT = 15;

    const { playPreview, togglePlay, isPlaying, currentTrack } = usePlayer();

    const fetchArtistReleases = useCallback(async () => {
        const bearer = toBearer(await getStoredToken());
        if (!bearer) return;

        const res = await fetch(`${API_URL}/api/artist-releases/me`, {
            headers: { Authorization: bearer },
        });
        const json = await safeJson(res);
        if (!res.ok) return;

        setReleasesToListen(Array.isArray(json?.toListen) ? json.toListen : []);
        setReleasesListened(Array.isArray(json?.listened) ? json.listened : []);
    }, []);

    const syncArtistReleases = useCallback(async () => {
        const bearer = toBearer(await getStoredToken());
        if (!bearer) return;

        await fetch(`${API_URL}/api/artist-releases/sync`, {
            method: "POST",
            headers: { Authorization: bearer },
        }).catch(() => null);

        await fetchArtistReleases();
    }, [fetchArtistReleases]);

    const ensureArtistReleasesSynced = useCallback(() => {
        if (releaseSyncStartedRef.current) {
            fetchArtistReleases().catch(() => {});
            return;
        }

        releaseSyncStartedRef.current = true;
        syncArtistReleases().catch(() => {});
    }, [fetchArtistReleases, syncArtistReleases]);

    const handleLogout = useCallback(async () => {
        const stored = await getStoredToken();
        const bearer = toBearer(stored);

        if (bearer) {
            await fetch(`${API_URL}/api/auth/logout`, {
                method: "POST",
                headers: { Authorization: bearer },
            }).catch(() => {});
        }

        await clearStoredSession();
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    }, [navigation]);

    const fetchMe = useCallback(async () => {
        const stored = await getStoredToken();
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

            const bearer = toBearer(await getStoredToken());
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

            const bearer = toBearer(await getStoredToken());
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
        if (me?._id) {
            await Promise.all([
                fetchTabPosts(me._id, activeTab),
                syncArtistReleases(),
            ]);
        }
        setRefreshing(false);
    }, [fetchMe, fetchTabPosts, activeTab, syncArtistReleases]);

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

            if (me?._id) {
                ensureArtistReleasesSynced();
                await fetchTabPosts(me._id, activeTab);
            }
            else setInitialLoadingPosts(false);
        })();
    }, [fetchMe, fetchTabPosts, activeTab, ensureArtistReleasesSynced]);

    useFocusEffect(
        useCallback(() => {
            (async () => {
                const me = await fetchMe();
                if (me?._id) {
                    ensureArtistReleasesSynced();
                    await fetchTabPosts(me._id, activeTab);
                }
            })();
        }, [fetchMe, fetchTabPosts, activeTab, ensureArtistReleasesSynced])
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

    const openReleasePost = useCallback(
        (item: ArtistReleaseItem) => {
            navigation.navigate("CreatePost", {
                entityType: item.itemType,
                entityId: item.itemId,
                track: {
                    title: item.title,
                    artist: item.artistName,
                    cover: item.coverUrl || null,
                    previewUrl: item.previewUrl || null,
                },
            });
        },
        [navigation]
    );

    const toggleReleaseListened = useCallback(
        async (item: ArtistReleaseItem, listened: boolean) => {
            if (releaseUpdatingId) return;
            setReleaseUpdatingId(item._id);

            try {
                const bearer = toBearer(await getStoredToken());
                if (!bearer) return;

                const res = await fetch(`${API_URL}/api/artist-releases/me`, {
                    method: "PATCH",
                    headers: {
                        Authorization: bearer,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ releaseId: item._id, listened }),
                });
                if (!res.ok) return;

                await fetchArtistReleases();
            } finally {
                setReleaseUpdatingId(null);
            }
        },
        [fetchArtistReleases, releaseUpdatingId]
    );

    const playRelease = useCallback(
        async (item: ArtistReleaseItem) => {
            if (!item.previewUrl) return;

            if (currentTrack?.url === item.previewUrl) {
                await togglePlay();
                return;
            }

            await playPreview({
                title: item.title,
                artist: item.artistName,
                url: item.previewUrl,
                coverUrl: item.coverUrl || "",
            });
        },
        [currentTrack?.url, playPreview, togglePlay]
    );

    if (loadingUser || !user || (initialLoadingPosts && posts.length === 0)) {
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

    const HeaderBlock = () => (
        <View style={{ width: "100%" }}>
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

                <View style={[styles.topActions, { top: insets.top + 10 }]}>
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
                <View style={styles.identityTopRow}>
                    <View style={styles.avatarWrap}>
                        {user.avatarUrl ? (
                            <Image
                                source={{ uri: user.avatarUrl }}
                                style={[styles.avatar, styles.avatarGlow]}
                                resizeMode="cover"
                            />
                        ) : (
                            <DefaultAvatar label={user.pseudo} seed={user._id} size={112} style={[styles.avatar, styles.avatarGlow]} />
                        )}
                    </View>

                    <TouchableOpacity
                        style={styles.profileEditButton}
                        onPress={() => navigation.navigate("EditProfile")}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="create-outline" size={15} color={colors.text} />
                        <Text style={styles.profileEditText}>Modifier</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.pseudo}>{user.pseudo}</Text>
                <Text style={styles.bio}>
                    {user.bio || "Aucune bio."}
                </Text>
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

                        {canPlayPinned ? (
                            <PlayerWave active={!!(isPinnedCurrent && isPlaying)} size="sm" />
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
                    <EmptyMusicState
                        text="Ajoute jusqu’à 3 artistes favoris."
                        cta="Compléter"
                        onPress={() => navigation.navigate("EditProfile")}
                    />
                )}
            </SectionBlock>

            <SectionBlock title="À écouter" icon="radio-outline">
                {releasesToListen.length > 0 ? (
                    <View style={styles.releaseList}>
                        {releasesToListen.slice(0, 6).map((item) => {
                            const active = currentTrack?.url === item.previewUrl;
                            return (
                                <ReleaseCard
                                    key={`release:${item._id}`}
                                    item={item}
                                    active={active}
                                    playing={isPlaying}
                                    loading={releaseUpdatingId === item._id}
                                    onOpen={() => openReleasePost(item)}
                                    onPlay={() => playRelease(item)}
                                    onToggleListened={() => toggleReleaseListened(item, true)}
                                />
                            );
                        })}
                        <TouchableOpacity
                            style={styles.sectionMoreButton}
                            onPress={() => navigation.navigate("ArtistReleases", { initialTab: "toListen" })}
                            activeOpacity={0.86}
                        >
                            <Text style={styles.sectionMoreText}>
                                Voir les {Math.min(releasesToListen.length, 100)} sorties à écouter
                            </Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <EmptyMusicState
                        text="Les sorties de tes artistes favoris apparaîtront ici."
                        cta="Actualiser"
                        onPress={() => syncArtistReleases()}
                    />
                )}
            </SectionBlock>

            <SectionBlock title="Déjà écoutés" icon="checkmark-circle-outline">
                {releasesListened.length > 0 ? (
                    <View style={styles.releaseList}>
                        {releasesListened.slice(0, 5).map((item) => {
                            const active = currentTrack?.url === item.previewUrl;
                            return (
                                <ReleaseCard
                                    key={`listened:${item._id}`}
                                    item={item}
                                    listened
                                    active={active}
                                    playing={isPlaying}
                                    loading={releaseUpdatingId === item._id}
                                    onOpen={() => openReleasePost(item)}
                                    onPlay={() => playRelease(item)}
                                    onToggleListened={() => toggleReleaseListened(item, false)}
                                />
                            );
                        })}
                        <TouchableOpacity
                            style={styles.sectionMoreButton}
                            onPress={() => navigation.navigate("ArtistReleases", { initialTab: "listened" })}
                            activeOpacity={0.86}
                        >
                            <Text style={styles.sectionMoreText}>
                                Voir les {Math.min(releasesListened.length, 100)} sons déjà écoutés
                            </Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <EmptyMusicState text="Marque une sortie comme écoutée pour la garder ici." />
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
            contentContainerStyle={[styles.listContent, { paddingBottom: bottomSpacing }]}
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

    topActions: {
        position: "absolute",
        top: 12,
        right: 12,
        flexDirection: "row",
        gap: spacing.sm,
        zIndex: 3,
    },

    settingsButton: {
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
        marginTop: spacing.sm,
        lineHeight: 32,
    },

    bio: {
        color: colors.textSoft,
        fontSize: typography.body,
        lineHeight: 21,
        marginTop: 8,
    },

    profileEditButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        backgroundColor: colors.controlActive,
        paddingHorizontal: spacing.md,
        paddingVertical: 10,
        borderRadius: radius.pill,
        marginBottom: spacing.sm,
    },

    profileEditText: {
        color: colors.text,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.black,
    },

    stats: {
        flexDirection: "row",
        marginTop: spacing.lg,
        marginHorizontal: 20,
        paddingVertical: spacing.md,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: colors.borderSoft,
    },

    statBtn: {
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

    emptyCta: {
        color: colors.primary,
        fontWeight: fontWeights.extraBold,
        fontSize: typography.bodySm,
    },

    releaseList: {
        gap: spacing.sm,
    },

    releaseCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        backgroundColor: colors.surfaceRaised,
        borderRadius: radius.xl,
        padding: spacing.sm,
    },

    releaseCover: {
        width: 58,
        height: 58,
        borderRadius: radius.lg,
        backgroundColor: colors.surface4,
    },

    releaseBody: {
        flex: 1,
        minWidth: 0,
    },

    releaseMetaRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 3,
    },

    releaseKind: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        textTransform: "uppercase",
        letterSpacing: 0.7,
    },

    releaseTitle: {
        color: colors.text,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.black,
        lineHeight: 18,
    },

    releaseArtist: {
        color: colors.textMuted,
        fontSize: typography.caption,
        fontWeight: fontWeights.bold,
        marginTop: 3,
    },

    releaseActions: {
        alignItems: "flex-end",
        gap: 8,
    },

    releaseIconButton: {
        minWidth: 54,
        height: 34,
        borderRadius: 17,
        paddingHorizontal: 10,
        backgroundColor: colors.control,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
    },

    releaseIconButtonActive: {
        backgroundColor: colors.controlActive,
    },

    releaseListenButton: {
        minWidth: 82,
        height: 32,
        borderRadius: 16,
        paddingHorizontal: 10,
        backgroundColor: colors.primary,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
    },

    releaseListenButtonDone: {
        backgroundColor: colors.control,
    },

    releaseListenButtonLoading: {
        opacity: 0.55,
    },

    releaseListenText: {
        color: colors.bg,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
    },

    releaseListenTextDone: {
        color: colors.textMuted,
    },

    sectionMoreButton: {
        minHeight: 42,
        borderRadius: radius.lg,
        backgroundColor: colors.surfaceRaised,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.md,
        marginTop: 2,
    },

    sectionMoreText: {
        color: colors.primary,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.black,
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
