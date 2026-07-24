import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_URL } from "../lib/config";
import { usePlayer } from "../context/PlayerContext";
import PlayerWave from "../components/PlayerWave";
import AppScreen from "../components/ui/AppScreen";
import { colors, fontWeights, radius, spacing, typography } from "../theme";

type Artist = {
    id: string;
    name: string;
    cover: string | null;
    genres: string[];
    bio: string;
    url: string;
};

type Album = {
    id: string;
    title: string;
    artist: string;
    cover: string | null;
    releaseDate: string | null;
    trackCount: number | null;
    albumType?: string;
};

type Song = {
    id: string;
    title: string;
    artist: string;
    cover: string | null;
    previewUrl: string | null;
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

function formatYear(date?: string | null) {
    if (!date) return "";
    return date.slice(0, 4);
}

function Cover({
                   uri,
                   icon = "musical-notes",
                   size = 86,
                   radiusValue = 24,
               }: {
    uri?: string | null;
    icon?: keyof typeof Ionicons.glyphMap;
    size?: number;
    radiusValue?: number;
}) {
    const frameStyle = { width: size, height: size, borderRadius: radiusValue };

    if (uri) return <Image source={{ uri }} style={[styles.cover, frameStyle]} />;

    return (
        <View style={[styles.cover, frameStyle, styles.coverFallback]}>
            <Ionicons name={icon} size={22} color={colors.textMuted} />
        </View>
    );
}

export default function ArtistDetailScreen({ route, navigation }: any) {
    const insets = useSafeAreaInsets();
    const artistId = String(route?.params?.artistId || "");
    const initialName = String(route?.params?.name || "");
    const initialCover = route?.params?.cover || null;

    const [artist, setArtist] = useState<Artist | null>(null);
    const [albums, setAlbums] = useState<Album[]>([]);
    const [singles, setSingles] = useState<Album[]>([]);
    const [topSongs, setTopSongs] = useState<Song[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const { playPreview, togglePlay, currentTrack, isPlaying } = usePlayer();

    const displayArtist = artist
        ? {
            ...artist,
            name: artist.name || initialName || "Artiste",
            cover: artist.cover || initialCover,
        }
        : {
            id: artistId,
            name: initialName || "Artiste",
            cover: initialCover,
            genres: [],
            bio: "",
            url: "",
        };

    const loadArtist = useCallback(async () => {
        if (!artistId) {
            setLoading(false);
            setError("Artiste introuvable.");
            return;
        }

        setLoading(true);
        setError("");

        const params = new URLSearchParams();
        if (initialName) params.set("name", initialName);

        try {
            const res = await fetch(
                `${API_URL}/api/music/artist/${encodeURIComponent(artistId)}?${params.toString()}`
            );
            const json = await safeJson(res);

            if (!res.ok) {
                setError(json?.error || "Impossible de charger cet artiste.");
                return;
            }

            setArtist(json?.artist || null);
            setAlbums(Array.isArray(json?.albums) ? json.albums : []);
            setSingles(Array.isArray(json?.singles) ? json.singles : []);
            setTopSongs(Array.isArray(json?.topSongs) ? json.topSongs : []);
        } catch (e) {
            console.log("artist detail error:", e);
            setError("Impossible de charger cet artiste.");
        } finally {
            setLoading(false);
        }
    }, [artistId, initialName]);

    useEffect(() => {
        loadArtist().catch(() => {});
    }, [loadArtist]);

    const genreLabel = useMemo(() => {
        const genres = displayArtist.genres || [];
        return genres.slice(0, 3).join(" · ");
    }, [displayArtist.genres]);

    const openCreatePost = useCallback(() => {
        navigation.navigate("CreatePost", {
            entityType: "artist",
            entityId: displayArtist.id,
            track: {
                title: displayArtist.name,
                artist: displayArtist.name,
                cover: displayArtist.cover,
                previewUrl: null,
            },
        });
    }, [displayArtist.cover, displayArtist.id, displayArtist.name, navigation]);

    const openSongPost = useCallback(
        (song: Song) => {
            navigation.navigate("CreatePost", {
                entityType: "song",
                entityId: song.id,
                track: {
                    title: song.title,
                    artist: song.artist,
                    cover: song.cover,
                    previewUrl: song.previewUrl,
                },
            });
        },
        [navigation]
    );

    const openAlbumPost = useCallback(
        (album: Album) => {
            navigation.navigate("CreatePost", {
                entityType: "album",
                entityId: album.id,
                track: {
                    title: album.title,
                    artist: album.artist || displayArtist.name,
                    cover: album.cover,
                    previewUrl: null,
                },
            });
        },
        [displayArtist.name, navigation]
    );

    const playSong = useCallback(
        async (song: Song) => {
            if (!song.previewUrl) return;
            if (currentTrack?.url === song.previewUrl) {
                await togglePlay();
                return;
            }

            await playPreview({
                title: song.title,
                artist: song.artist,
                url: song.previewUrl,
                coverUrl: song.cover || "",
            });
        },
        [currentTrack?.url, playPreview, togglePlay]
    );

    return (
        <AppScreen padded={false}>
            <ScrollView
                contentContainerStyle={[
                    styles.content,
                    { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 16) + 120 },
                ]}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.topBar}>
                    <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()} activeOpacity={0.86}>
                        <Ionicons name="arrow-back" size={20} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rateButton} onPress={openCreatePost} activeOpacity={0.86}>
                        <Ionicons name="star-outline" size={15} color={colors.text} />
                        <Text style={styles.rateButtonText}>Noter</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.hero}>
                    <Cover uri={displayArtist.cover} icon="person" size={112} radiusValue={30} />

                    <View style={styles.heroCopy}>
                        <Text style={styles.eyebrow}>Artiste</Text>
                        <Text style={styles.name} numberOfLines={2}>
                            {displayArtist.name}
                        </Text>
                        {genreLabel ? <Text style={styles.genres} numberOfLines={1}>{genreLabel}</Text> : null}
                    </View>
                </View>

                {loading ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator color={colors.primary} />
                        <Text style={styles.loadingText}>Chargement de l’artiste...</Text>
                    </View>
                ) : error ? (
                    <TouchableOpacity style={styles.errorBox} onPress={loadArtist} activeOpacity={0.86}>
                        <Text style={styles.errorTitle}>{error}</Text>
                        <Text style={styles.errorText}>Touche pour réessayer.</Text>
                    </TouchableOpacity>
                ) : (
                    <>
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Bio</Text>
                            <Text style={styles.bio}>
                                {displayArtist.bio || "Bio indisponible pour cet artiste pour le moment."}
                            </Text>
                        </View>

                        {topSongs.length ? (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Titres populaires</Text>
                                {topSongs.map((song) => {
                                    const active = !!song.previewUrl && currentTrack?.url === song.previewUrl;
                                    return (
                                        <TouchableOpacity
                                            key={`song:${song.id}`}
                                            style={styles.songRow}
                                            activeOpacity={0.88}
                                            onPress={() => openSongPost(song)}
                                        >
                                            <Cover uri={song.cover} />
                                            <View style={styles.rowCopy}>
                                                <Text style={styles.rowTitle} numberOfLines={1}>{song.title}</Text>
                                                <Text style={styles.rowSubtitle} numberOfLines={1}>{song.artist}</Text>
                                            </View>
                                            {song.previewUrl ? (
                                                <TouchableOpacity
                                                    style={[styles.playButton, active && styles.playButtonActive]}
                                                    activeOpacity={0.82}
                                                    onPress={(event) => {
                                                        event.stopPropagation();
                                                        playSong(song).catch(() => {});
                                                    }}
                                                >
                                                    {active && isPlaying ? (
                                                        <PlayerWave active size="sm" color={colors.text} inactiveColor={colors.text} />
                                                    ) : (
                                                        <Ionicons name="play" size={13} color={colors.text} />
                                                    )}
                                                </TouchableOpacity>
                                            ) : null}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ) : null}

                        <ReleaseSection title="Albums" items={albums} empty="Aucun album trouvé." onPressItem={openAlbumPost} />
                        <ReleaseSection title="Singles & EP" items={singles} empty="Aucun single trouvé." onPressItem={openAlbumPost} />
                    </>
                )}
            </ScrollView>
        </AppScreen>
    );
}

function ReleaseSection({
                            title,
                            items,
                            empty,
                            onPressItem,
                        }: {
    title: string;
    items: Album[];
    empty: string;
    onPressItem: (item: Album) => void;
}) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {items.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.releaseRail}>
                    {items.map((item) => (
                        <TouchableOpacity
                            key={`${title}:${item.id}`}
                            style={styles.releaseCard}
                            activeOpacity={0.88}
                            onPress={() => onPressItem(item)}
                        >
                            <Cover uri={item.cover} icon="disc" size={142} radiusValue={22} />
                            <Text style={styles.releaseTitle} numberOfLines={2}>{item.title}</Text>
                            <Text style={styles.releaseMeta} numberOfLines={1}>
                                {[formatYear(item.releaseDate), item.trackCount ? `${item.trackCount} titres` : ""]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            ) : (
                <Text style={styles.emptyText}>{empty}</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    content: {
        paddingHorizontal: spacing.lg,
    },
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.lg,
    },
    iconButton: {
        width: 42,
        height: 42,
        borderRadius: radius.lg,
        backgroundColor: colors.control,
        alignItems: "center",
        justifyContent: "center",
    },
    rateButton: {
        minHeight: 40,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        backgroundColor: colors.controlActive,
    },
    rateButtonText: {
        color: colors.text,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.black,
    },
    hero: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.lg,
        marginBottom: spacing.xl,
    },
    heroCopy: {
        flex: 1,
        minWidth: 0,
    },
    eyebrow: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        letterSpacing: 3,
        textTransform: "uppercase",
        marginBottom: 6,
    },
    name: {
        color: colors.text,
        fontSize: 34,
        lineHeight: 38,
        fontWeight: fontWeights.black,
    },
    genres: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.bold,
        marginTop: spacing.sm,
    },
    cover: {
        width: 86,
        height: 86,
        borderRadius: 24,
        backgroundColor: colors.surface3,
    },
    coverFallback: {
        alignItems: "center",
        justifyContent: "center",
    },
    loadingBox: {
        minHeight: 180,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
    },
    loadingText: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.bold,
    },
    errorBox: {
        padding: spacing.lg,
        borderRadius: radius.xxl,
        backgroundColor: colors.surfaceFeed,
    },
    errorTitle: {
        color: colors.text,
        fontSize: typography.body,
        fontWeight: fontWeights.black,
    },
    errorText: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        marginTop: 4,
    },
    section: {
        marginTop: spacing.xl,
    },
    sectionTitle: {
        color: colors.text,
        fontSize: 21,
        fontWeight: fontWeights.black,
        marginBottom: spacing.md,
    },
    bio: {
        color: colors.textSoft,
        fontSize: typography.body,
        lineHeight: 23,
        fontWeight: fontWeights.medium,
    },
    songRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.separator,
    },
    rowCopy: {
        flex: 1,
        minWidth: 0,
    },
    rowTitle: {
        color: colors.text,
        fontSize: typography.body,
        fontWeight: fontWeights.black,
    },
    rowSubtitle: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.medium,
        marginTop: 3,
    },
    playButton: {
        width: 38,
        height: 38,
        borderRadius: radius.pill,
        backgroundColor: colors.control,
        alignItems: "center",
        justifyContent: "center",
    },
    playButtonActive: {
        backgroundColor: colors.controlActive,
    },
    releaseRail: {
        gap: spacing.md,
        paddingRight: spacing.lg,
    },
    releaseCard: {
        width: 142,
    },
    releaseTitle: {
        color: colors.text,
        fontSize: typography.bodySm,
        lineHeight: 18,
        fontWeight: fontWeights.black,
        marginTop: spacing.sm,
    },
    releaseMeta: {
        color: colors.textMuted,
        fontSize: typography.caption,
        fontWeight: fontWeights.medium,
        marginTop: 4,
    },
    emptyText: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.medium,
    },
});
