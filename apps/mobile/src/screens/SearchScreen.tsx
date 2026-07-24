import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    TextInput,
    Text,
    FlatList,
    Image,
    TouchableOpacity,
    StyleSheet,
    Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "../lib/config";
import AppScreen from "../components/ui/AppScreen";
import AppHeader from "../components/ui/AppHeader";
import AppSectionLoader from "../components/ui/AppSectionLoader";
import PlayerWave from "../components/PlayerWave";
import { colors, spacing, radius, typography, fontWeights } from "../theme";
import {
    isShazamKitAvailable,
    recognizeWithShazamKit,
    ShazamKitTrack,
} from "../lib/shazamKit";
import { usePlayer } from "../context/PlayerContext";

const PROFILE_MUSIC_PICK_KEY = "edit_profile_pending_music_pick";
const NOTE_TRACK_PICK_KEY = "create_note_pending_track_pick";

type SearchType = "song" | "album" | "artist";

type SongItem = {
    id: string;
    type: "song";
    title: string;
    artist: string;
    cover: string | null;
    previewUrl: string | null;
};

type AlbumItem = {
    id: string;
    type: "album";
    title: string;
    artist: string;
    cover: string | null;
};

type ArtistItem = {
    id: string;
    type: "artist";
    name: string;
    cover: string | null;
};

type AnyItem = SongItem | AlbumItem | ArtistItem;

type RecognizedTrack = ShazamKitTrack;

type ReleaseSection = {
    id: "france" | "international" | string;
    title: string;
    subtitle: string;
    items: AnyItem[];
};

type PickProfileKind =
    | "pinnedTrack"
    | "favoriteArtists"
    | "favoriteAlbums"
    | "favoriteTracks"
    | "listenLater"
    | "alreadyListened";

type CreatePostNavPayload = {
    entityType: "song" | "album" | "artist";
    entityId: string | null;
    track: {
        title: string;
        artist: string;
        cover: string | null;
        previewUrl?: string | null;
    };
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

function useDebouncedValue<T>(value: T, delayMs: number) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(t);
    }, [value, delayMs]);
    return debounced;
}

function normalizeToProfileMusic(item: AnyItem) {
    if (item.type === "song") {
        return {
            entityId: item.id,
            entityType: "song" as const,
            title: item.title,
            artist: item.artist,
            coverUrl: item.cover || "",
            previewUrl: item.previewUrl || "",
        };
    }

    if (item.type === "album") {
        return {
            entityId: item.id,
            entityType: "album" as const,
            title: item.title,
            artist: item.artist,
            coverUrl: item.cover || "",
            previewUrl: "",
        };
    }

    return {
        entityId: item.id,
        entityType: "artist" as const,
        title: item.name,
        artist: item.name,
        coverUrl: item.cover || "",
        previewUrl: "",
    };
}

function recognizedToSongItem(track: RecognizedTrack): SongItem {
    return {
        id: track.entityId || `recognized:${track.title}:${track.artist}`,
        type: "song",
        title: track.title,
        artist: track.artist,
        cover: track.cover || null,
        previewUrl: track.previewUrl || null,
    };
}

export default function SearchScreen({ navigation, route }: any) {
    const mode: "pickTrack" | "pickProfileMusic" | "pickNoteTrack" =
        route?.params?.mode || "pickTrack";

    const kind: PickProfileKind | undefined = route?.params?.kind;

    const initialType: SearchType =
        route?.params?.initialType ||
        (kind === "favoriteArtists"
            ? "artist"
            : kind === "favoriteAlbums"
                ? "album"
                : "song");

    const [query, setQuery] = useState("");
    const debouncedQuery = useDebouncedValue(query, 260);
    const [type, setType] = useState<SearchType>(initialType);
    const [results, setResults] = useState<AnyItem[]>([]);
    const [discoverItems, setDiscoverItems] = useState<AnyItem[]>([]);
    const [releaseSections, setReleaseSections] = useState<ReleaseSection[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingDiscover, setLoadingDiscover] = useState(false);
    const [loadingReleases, setLoadingReleases] = useState(false);
    const [recognizing, setRecognizing] = useState(false);
    const [recognitionResult, setRecognitionResult] = useState<RecognizedTrack | null>(null);
    const [recognitionError, setRecognitionError] = useState("");
    const lastRequestKey = useRef("");
    const { playPreview, togglePlay, isPlaying, currentTrack } = usePlayer();

    const typeCopy = useMemo(() => {
        if (type === "artist") return "Artistes populaires";
        if (type === "album") return "Albums populaires";
        return "Sons populaires";
    }, [type]);

    const fetchAppleItems = useCallback(async (q: string, effective: SearchType) => {
        const params = new URLSearchParams();
        params.set("type", effective);
        if (q.trim()) params.set("q", q.trim());

        const res = await fetch(`${API_URL}/api/search/apple?${params.toString()}`);
        const json = await safeJson(res);
        if (!res.ok || !Array.isArray(json?.items)) {
            console.log("Apple search error:", res.status, json);
            return [];
        }
        return json.items as AnyItem[];
    }, []);

    const loadReleaseSections = useCallback(async () => {
        try {
            setLoadingReleases(true);
            const res = await fetch(`${API_URL}/api/search/apple?mode=releases`);
            const json = await safeJson(res);
            if (!res.ok || !Array.isArray(json?.sections)) {
                console.log("Apple releases error:", res.status, json);
                setReleaseSections([]);
                return;
            }
            setReleaseSections(json.sections as ReleaseSection[]);
        } catch (err) {
            console.log("Apple releases fetch error:", err);
            setReleaseSections([]);
        } finally {
            setLoadingReleases(false);
        }
    }, []);

    const loadDiscover = useCallback(async (effective: SearchType = type) => {
        const key = `discover:${effective}`;
        lastRequestKey.current = key;

        try {
            setLoadingDiscover(true);
            const items = await fetchAppleItems("", effective);
            if (lastRequestKey.current === key) setDiscoverItems(items);
        } catch (err) {
            console.log("Discover fetch error:", err);
            if (lastRequestKey.current === key) setDiscoverItems([]);
        } finally {
            if (lastRequestKey.current === key) setLoadingDiscover(false);
        }
    }, [fetchAppleItems, type]);

    const search = useCallback(async (forcedType?: SearchType, forcedQuery?: string) => {
        const effective = forcedType ?? type;
        const q = (forcedQuery ?? query).trim().replace(/\s+/g, " ");
        if (q.length < 2) {
            setResults([]);
            return;
        }

        const key = `search:${effective}:${q}`;
        lastRequestKey.current = key;

        try {
            setLoading(true);
            const items = await fetchAppleItems(q, effective);
            if (lastRequestKey.current === key) setResults(items);
        } catch (err) {
            console.log("Search fetch error:", err);
            if (lastRequestKey.current === key) setResults([]);
        } finally {
            if (lastRequestKey.current === key) setLoading(false);
        }
    }, [fetchAppleItems, query, type]);

    useEffect(() => {
        const q = debouncedQuery.trim();
        if (q.length >= 2) {
            search(type, q).catch(() => {});
        } else {
            setResults([]);
            loadDiscover(type).catch(() => {});
        }
    }, [debouncedQuery, loadDiscover, search, type]);

    useEffect(() => {
        loadReleaseSections().catch(() => {});
    }, [loadReleaseSections]);

    const goToCreatePost = (payload: CreatePostNavPayload) => {
        navigation.navigate("CreatePost", payload);
    };

    const selectForProfileMusic = async (item: AnyItem) => {
        if (!kind) return;

        const normalized = normalizeToProfileMusic(item);

        if (kind === "pinnedTrack" && normalized.entityType !== "song") return;
        if (kind === "favoriteArtists" && normalized.entityType !== "artist") return;
        if (kind === "favoriteAlbums" && normalized.entityType !== "album") return;
        if (kind === "favoriteTracks" && normalized.entityType !== "song") return;
        if (
            (kind === "listenLater" || kind === "alreadyListened") &&
            normalized.entityType !== "song" &&
            normalized.entityType !== "album"
        ) {
            return;
        }

        try {
            await AsyncStorage.setItem(
                PROFILE_MUSIC_PICK_KEY,
                JSON.stringify({
                    kind,
                    item: normalized,
                })
            );
        } catch (e) {
            console.log("save picked profile music error:", e);
        }

        navigation.goBack();
    };

    const selectForNoteTrack = async (item: AnyItem) => {
        const normalized = normalizeToProfileMusic(item);

        try {
            await AsyncStorage.setItem(
                NOTE_TRACK_PICK_KEY,
                JSON.stringify(normalized)
            );
        } catch (e) {
            console.log("save picked note track error:", e);
        }

        navigation.goBack();
    };

    const recognizeCurrentSong = async () => {
        if (recognizing) return;

        try {
            setRecognitionResult(null);
            setRecognitionError("");

            if (!isShazamKitAvailable()) {
                Alert.alert(
                    "Dev build requise",
                    "Le vrai ShazamKit nécessite une Expo dev build iOS. Rebuild l’app, puis relance ce bouton."
                );
                return;
            }

            setRecognizing(true);
            const result = await recognizeWithShazamKit();

            if (!result?.matched || !result.track) {
                setRecognitionResult(null);
                setRecognitionError(result?.error || "Aucun morceau reconnu. Essaie un extrait plus clair.");
                return;
            }

            const track = result.track;
            const item = recognizedToSongItem(track);
            setRecognitionResult(track);
            setRecognitionError("");
            setType("song");
            setQuery(`${track.title} ${track.artist}`);
            setResults([item]);
        } catch (e: any) {
            console.log("Recognition error:", e);
            setRecognitionError(e?.message || "Impossible d’identifier ce morceau.");
        } finally {
            setRecognizing(false);
        }
    };

    const handlePress = (item: AnyItem) => {
        if (mode === "pickProfileMusic") {
            selectForProfileMusic(item);
            return;
        }

        if (mode === "pickNoteTrack") {
            selectForNoteTrack(item);
            return;
        }

        if (item.type === "song") {
            goToCreatePost({
                entityType: "song",
                entityId: item.id,
                track: {
                    title: item.title,
                    artist: item.artist,
                    cover: item.cover,
                    previewUrl: item.previewUrl,
                },
            });
            return;
        }

        if (item.type === "album") {
            goToCreatePost({
                entityType: "album",
                entityId: item.id,
                track: {
                    title: item.title,
                    artist: item.artist,
                    cover: item.cover,
                    previewUrl: null,
                },
            });
            return;
        }

        navigation.navigate("ArtistDetail", {
            artistId: item.id,
            name: item.name,
            cover: item.cover,
        });
    };

    const isCurrentPreview = useCallback(
        (item: SongItem) => {
            return !!item.previewUrl && currentTrack?.url === item.previewUrl;
        },
        [currentTrack]
    );

    const playSongPreview = useCallback(
        async (item: SongItem) => {
            if (!item.previewUrl) return;

            if (isCurrentPreview(item)) {
                await togglePlay();
                return;
            }

            await playPreview({
                title: item.title,
                artist: item.artist,
                url: item.previewUrl,
                coverUrl: item.cover || "",
            });
        },
        [isCurrentPreview, playPreview, togglePlay]
    );

    const visibleItems = query.trim().length >= 2 ? results : discoverItems;
    const isSearching = query.trim().length >= 2;

    const renderItem = ({ item }: { item: AnyItem }) => {
        if (item.type === "song") {
            const isPreviewActive = isCurrentPreview(item);

            return (
                <TouchableOpacity style={styles.item} onPress={() => handlePress(item)}>
                    {item.cover ? (
                        <Image source={{ uri: item.cover }} style={styles.cover} />
                    ) : (
                        <View style={styles.placeholder}>
                            <Ionicons name="musical-notes" size={18} color={colors.textMuted} />
                        </View>
                    )}

                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text numberOfLines={1} style={styles.title}>
                            {item.title}
                        </Text>
                        <Text numberOfLines={1} style={styles.artist}>
                            {item.artist}
                        </Text>
                    </View>

                    {item.previewUrl ? (
                        <TouchableOpacity
                            style={[
                                styles.playPill,
                                isPreviewActive && styles.playPillActive,
                            ]}
                            activeOpacity={0.82}
                            onPress={(event) => {
                                event.stopPropagation();
                                playSongPreview(item).catch(() => {});
                            }}
                        >
                            {isPreviewActive && isPlaying ? (
                                <PlayerWave active size="sm" color={colors.text} inactiveColor={colors.text} />
                            ) : (
                                <Ionicons name="play" size={14} color={colors.text} />
                            )}
                        </TouchableOpacity>
                    ) : null}
                </TouchableOpacity>
            );
        }

        if (item.type === "album") {
            return (
                <TouchableOpacity style={styles.item} onPress={() => handlePress(item)}>
                    {item.cover ? (
                        <Image source={{ uri: item.cover }} style={styles.cover} />
                    ) : (
                        <View style={styles.placeholder}>
                            <Ionicons name="disc" size={18} color={colors.textMuted} />
                        </View>
                    )}

                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text numberOfLines={1} style={styles.title}>
                            {item.title}
                        </Text>
                        <Text numberOfLines={1} style={styles.artist}>
                            {item.artist}
                        </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                </TouchableOpacity>
            );
        }

        return (
            <TouchableOpacity style={styles.item} onPress={() => handlePress(item)}>
                {item.cover ? (
                    <Image source={{ uri: item.cover }} style={styles.cover} />
                ) : (
                    <View style={styles.placeholder}>
                        <Ionicons name="person" size={18} color={colors.textMuted} />
                    </View>
                )}

                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text numberOfLines={1} style={styles.title}>
                        {item.name}
                    </Text>
                    <Text numberOfLines={1} style={styles.artist}>
                        Artiste
                    </Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </TouchableOpacity>
        );
    };

    const renderReleaseItem = useCallback(
        ({ item }: { item: AnyItem }) => {
            const title = item.type === "artist" ? item.name : item.title;
            const artist = item.type === "artist" ? "Artiste" : item.artist;
            const cover = item.cover;
            const isSong = item.type === "song";
            const isPreviewActive = isSong ? isCurrentPreview(item) : false;

            return (
                <TouchableOpacity
                    style={styles.releaseCard}
                    activeOpacity={0.88}
                    onPress={() => handlePress(item)}
                >
                    {cover ? (
                        <Image source={{ uri: cover }} style={styles.releaseCover} />
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
                        <Text numberOfLines={2} style={styles.releaseTitle}>
                            {title}
                        </Text>
                        <Text numberOfLines={1} style={styles.releaseArtist}>
                            {artist}
                        </Text>
                    </View>
                    {isSong && item.previewUrl ? (
                        <TouchableOpacity
                            style={[styles.releasePlay, isPreviewActive && styles.releasePlayActive]}
                            activeOpacity={0.84}
                            onPress={(event) => {
                                event.stopPropagation();
                                playSongPreview(item).catch(() => {});
                            }}
                        >
                            {isPreviewActive && isPlaying ? (
                                <PlayerWave active size="sm" color={colors.text} inactiveColor={colors.text} />
                            ) : (
                                <Ionicons name="play" size={13} color={colors.text} />
                            )}
                        </TouchableOpacity>
                    ) : null}
                </TouchableOpacity>
            );
        },
        [handlePress, isCurrentPreview, isPlaying, playSongPreview]
    );

    const releasesBlock = useMemo(() => {
        if (isSearching) return null;
        if (loadingReleases) {
            return (
                <View style={styles.releasesWrap}>
                    <Text style={styles.sectionEyebrow}>Sorties</Text>
                    <Text style={styles.sectionTitle}>Dernières sorties</Text>
                    <AppSectionLoader />
                </View>
            );
        }
        if (!releaseSections.some((section) => section.items.length > 0)) return null;

        return (
            <View style={styles.releasesWrap}>
                <View style={styles.releasesHeader}>
                    <Text style={styles.sectionEyebrow}>Sorties</Text>
                    <Text style={styles.sectionTitle}>Dernières sorties</Text>
                </View>
                {releaseSections.map((section) =>
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
                                renderItem={renderReleaseItem}
                                showsHorizontalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                nestedScrollEnabled
                                contentContainerStyle={styles.releaseList}
                            />
                        </View>
                    ) : null
                )}
            </View>
        );
    }, [isSearching, loadingReleases, releaseSections, renderReleaseItem]);

    const screenTitle =
        mode === "pickProfileMusic"
            ? kind === "pinnedTrack"
                ? "Choisir un son épinglé"
                : kind === "favoriteArtists"
                    ? "Choisir des artistes favoris"
                    : kind === "favoriteAlbums"
                        ? "Choisir des albums favoris"
                        : kind === "listenLater"
                            ? "Ajouter à écouter"
                            : kind === "alreadyListened"
                                ? "Ajouter à déjà écoutés"
                                : "Choisir des morceaux favoris"
            : mode === "pickNoteTrack"
                ? "Choisir un son pour la note"
                : "Rechercher";

    const canGoBack = typeof navigation?.canGoBack === "function" && navigation.canGoBack();

    return (
        <AppScreen>
            <AppHeader
                title={screenTitle}
                compact
                left={
                    canGoBack ? (
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.headerBackButton}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="arrow-back" size={20} color={colors.text} />
                        </TouchableOpacity>
                    ) : undefined
                }
            />

            <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                    style={styles.input}
                    placeholder="Titre, artiste, album..."
                    placeholderTextColor={colors.textFaint}
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={() => search()}
                    returnKeyType="search"
                    autoCorrect={false}
                    autoCapitalize="none"
                />
                {query.length > 0 ? (
                    <TouchableOpacity onPress={() => setQuery("")} style={styles.clearBtn}>
                        <Ionicons name="close" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                ) : null}
            </View>

            <View style={styles.filters}>
                {(["song", "album", "artist"] as SearchType[]).map((t) => {
                    const active = type === t;
                    return (
                        <TouchableOpacity
                            key={t}
                            style={[styles.filter, active && styles.filterActive]}
                            onPress={() => {
                                setType(t);
                                if (query.trim().length >= 2) search(t, query);
                            }}
                            activeOpacity={0.85}
                        >
                            <Ionicons
                                name={t === "song" ? "musical-notes-outline" : t === "album" ? "disc-outline" : "person-outline"}
                                size={15}
                                color={active ? colors.text : colors.textFaint}
                            />
                            <Text style={[styles.filterText, active && styles.filterTextActive]}>
                                {t === "song" ? "Sons" : t === "album" ? "Albums" : "Artistes"}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={styles.recognitionCard}>
                <View style={styles.recognitionHeader}>
                    <View style={[styles.recognitionIcon, recognizing && styles.recognitionIconActive]}>
                        <Ionicons
                            name={recognizing ? "radio" : "sparkles"}
                            size={20}
                            color={recognizing ? colors.bg : colors.primary}
                        />
                    </View>
                    <View style={styles.recognitionCopy}>
                        <Text style={styles.recognitionTitle}>Identifier un son</Text>
                        <Text style={styles.recognitionText}>
                            {recognizing
                                ? "ShazamKit écoute autour de toi..."
                                : "Reconnaissance native Apple ShazamKit."}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.recognitionButton, recognizing && styles.recognitionButtonDisabled]}
                        onPress={recognizeCurrentSong}
                        disabled={recognizing}
                        activeOpacity={0.86}
                    >
                        <Text style={styles.recognitionButtonText}>
                            {recognizing ? "Écoute" : "Lancer"}
                        </Text>
                    </TouchableOpacity>
                </View>

                {recognizing ? (
                    <View style={styles.listeningBar}>
                        <View style={styles.listeningDot} />
                        <View style={styles.listeningDotTall} />
                        <View style={styles.listeningDot} />
                        <Text style={styles.listeningText}>Garde le téléphone proche de la musique.</Text>
                    </View>
                ) : null}

                {recognitionResult ? (
                    <TouchableOpacity
                        style={styles.recognizedResult}
                        onPress={() => handlePress(recognizedToSongItem(recognitionResult))}
                        activeOpacity={0.88}
                    >
                        {recognitionResult.cover ? (
                            <Image source={{ uri: recognitionResult.cover }} style={styles.recognizedCover} />
                        ) : (
                            <View style={styles.recognizedCoverFallback}>
                                <Ionicons name="musical-notes" size={18} color={colors.textMuted} />
                            </View>
                        )}
                        <View style={{ flex: 1 }}>
                            <Text style={styles.recognizedTitle} numberOfLines={1}>
                                {recognitionResult.title}
                            </Text>
                            <Text style={styles.recognizedArtist} numberOfLines={1}>
                                {recognitionResult.artist}
                                {recognitionResult.album ? ` • ${recognitionResult.album}` : ""}
                            </Text>
                        </View>
                        <Ionicons name="add-circle" size={24} color={colors.primary} />
                    </TouchableOpacity>
                ) : null}

                {recognitionError ? (
                    <Text style={styles.recognitionError}>{recognitionError}</Text>
                ) : null}
            </View>

            {loading || loadingDiscover ? (
                <AppSectionLoader />
            ) : (
                <FlatList
                    data={visibleItems}
                    keyExtractor={(item, index) => `${item.type}:${item.id}:${index}`}
                    renderItem={renderItem}
                    ListHeaderComponent={
                        <>
                            {releasesBlock}
                            <View style={styles.sectionHead}>
                                <Text style={styles.sectionEyebrow}>{isSearching ? "Résultats" : "Découverte"}</Text>
                                <Text style={styles.sectionTitle}>{isSearching ? `Recherche “${query.trim()}”` : typeCopy}</Text>
                            </View>
                        </>
                    }
                    contentContainerStyle={styles.resultsContent}
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <View style={styles.emptyIconWrap}>
                                <Ionicons name="search-outline" size={18} color={colors.primary} />
                            </View>
                            <Text style={styles.emptyTitle}>
                                {isSearching ? "Aucun résultat" : "Suggestions indisponibles"}
                            </Text>
                            <Text style={styles.emptyText}>
                                {isSearching
                                    ? "Essaie moins de mots, un artiste, ou une orthographe approximative."
                                    : "Apple Music n’a rien renvoyé pour cette catégorie."}
                            </Text>
                        </View>
                    }
                />
            )}
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    headerBackButton: {
        width: 38,
        height: 38,
        borderRadius: radius.lg,
        backgroundColor: colors.surface3,
        alignItems: "center",
        justifyContent: "center",
    },

    searchBox: {
        minHeight: 52,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        backgroundColor: "rgba(15, 18, 24, 0.78)",
        borderRadius: radius.xxl,
        paddingHorizontal: spacing.md,
    },
    input: {
        flex: 1,
        color: colors.text,
        fontSize: 15,
        fontWeight: fontWeights.medium,
        minHeight: 50,
    },
    clearBtn: {
        width: 28,
        height: 28,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface3,
    },
    filters: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        marginTop: spacing.md,
        marginBottom: spacing.lg,
        backgroundColor: colors.surfaceInset,
        padding: 4,
        borderRadius: radius.pill,
    },
    filter: {
        flex: 1,
        minHeight: 38,
        flexDirection: "row",
        gap: 6,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.pill,
    },
    filterActive: {
        backgroundColor: colors.control,
    },
    filterText: {
        color: colors.textMuted,
        fontWeight: fontWeights.extraBold,
        fontSize: typography.caption,
    },
    filterTextActive: {
        color: colors.text,
        fontWeight: fontWeights.black,
    },
    recognitionCard: {
        backgroundColor: colors.surfaceFeed,
        borderRadius: radius.xxl,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    recognitionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    recognitionIcon: {
        width: 42,
        height: 42,
        borderRadius: radius.lg,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primaryFaint,
    },
    recognitionIconActive: {
        backgroundColor: colors.primary,
    },
    recognitionCopy: {
        flex: 1,
        minWidth: 0,
    },
    recognitionTitle: {
        color: colors.text,
        fontSize: typography.body,
        fontWeight: fontWeights.black,
    },
    recognitionText: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        marginTop: 3,
        lineHeight: 18,
    },
    recognitionButton: {
        minHeight: 36,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.controlActive,
    },
    recognitionButtonDisabled: {
        opacity: 0.68,
    },
    recognitionButtonText: {
        color: colors.text,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.black,
    },
    listeningBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.borderSoft,
    },
    listeningDot: {
        width: 5,
        height: 15,
        borderRadius: radius.pill,
        backgroundColor: colors.primary,
        opacity: 0.72,
    },
    listeningDotTall: {
        width: 5,
        height: 26,
        borderRadius: radius.pill,
        backgroundColor: colors.primary,
    },
    listeningText: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.medium,
        marginLeft: spacing.xs,
        flex: 1,
    },
    recognizedResult: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.borderSoft,
    },
    recognizedCover: {
        width: 46,
        height: 46,
        borderRadius: radius.md,
        backgroundColor: colors.surface3,
    },
    recognizedCoverFallback: {
        width: 46,
        height: 46,
        borderRadius: radius.md,
        backgroundColor: colors.surface3,
        alignItems: "center",
        justifyContent: "center",
    },
    recognizedTitle: {
        color: colors.text,
        fontSize: typography.body,
        fontWeight: fontWeights.black,
    },
    recognizedArtist: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        marginTop: 3,
        fontWeight: fontWeights.medium,
    },
    recognitionError: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        lineHeight: 18,
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.borderSoft,
    },
    sectionHead: {
        marginBottom: spacing.md,
        paddingHorizontal: spacing.xs,
    },
    sectionEyebrow: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        letterSpacing: 3,
        textTransform: "uppercase",
        marginBottom: 4,
    },
    sectionTitle: {
        color: colors.text,
        fontSize: 21,
        fontWeight: fontWeights.black,
    },
    resultsContent: {
        paddingBottom: 200,
    },
    releasesWrap: {
        marginBottom: spacing.xl,
    },
    releasesHeader: {
        paddingHorizontal: spacing.xs,
        marginBottom: spacing.sm,
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
        fontSize: typography.bodySm,
        fontWeight: fontWeights.medium,
        marginTop: 3,
    },
    releaseList: {
        gap: spacing.sm,
        paddingRight: spacing.md,
    },
    releaseCard: {
        width: 156,
        minHeight: 222,
        borderRadius: radius.xxl,
        backgroundColor: colors.surfaceRaised,
        padding: spacing.sm,
    },
    releaseCover: {
        width: "100%",
        aspectRatio: 1,
        borderRadius: 20,
        backgroundColor: colors.surface3,
    },
    releaseCoverFallback: {
        width: "100%",
        aspectRatio: 1,
        borderRadius: 20,
        backgroundColor: colors.surface3,
        alignItems: "center",
        justifyContent: "center",
    },
    releaseBody: {
        paddingTop: spacing.sm,
        paddingRight: 34,
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
    item: {
        flexDirection: "row",
        padding: 12,
        backgroundColor: colors.surfaceFeed,
        borderRadius: 24,
        marginBottom: spacing.sm,
        alignItems: "center",
    },
    cover: {
        width: 62,
        height: 62,
        borderRadius: radius.lg,
        backgroundColor: colors.surface3,
    },
    placeholder: {
        width: 62,
        height: 62,
        borderRadius: radius.lg,
        backgroundColor: colors.surface3,
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        color: colors.text,
        fontSize: 15,
        fontWeight: fontWeights.black,
    },
    artist: {
        color: colors.textMuted,
        marginTop: 4,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.medium,
    },
    playPill: {
        width: 38,
        height: 38,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.control,
    },
    playPillActive: {
        backgroundColor: colors.controlActive,
    },
    emptyBox: {
        marginTop: spacing.xl,
        backgroundColor: colors.surfaceFeed,
        borderRadius: radius.xxl,
        padding: spacing.lg,
        alignItems: "center",
    },
    emptyIconWrap: {
        width: 42,
        height: 42,
        borderRadius: radius.lg,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primaryFaint,
        marginBottom: spacing.md,
    },
    emptyTitle: {
        color: colors.text,
        fontSize: typography.body,
        fontWeight: fontWeights.black,
        marginBottom: spacing.xs,
    },
    emptyText: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        lineHeight: 19,
        textAlign: "center",
    },
});
