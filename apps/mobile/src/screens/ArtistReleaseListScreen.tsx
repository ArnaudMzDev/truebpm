import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_URL } from "../lib/config";
import AppHeader from "../components/ui/AppHeader";
import AppScreen from "../components/ui/AppScreen";
import PlayerWave from "../components/PlayerWave";
import { usePlayer } from "../context/PlayerContext";
import { getStoredToken } from "../lib/authStorage";
import { colors, fontWeights, radius, spacing, typography } from "../theme";

type ReleaseTab = "toListen" | "listened";

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

function toBearer(token: string | null) {
    if (!token) return null;
    return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
}

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

function formatReleaseDate(value?: string) {
    if (!value) return "Sortie récente";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "Sortie récente";
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export default function ArtistReleaseListScreen({ navigation, route }: any) {
    const insets = useSafeAreaInsets();
    const initialTab = route?.params?.initialTab === "listened" ? "listened" : "toListen";
    const [activeTab, setActiveTab] = useState<ReleaseTab>(initialTab);
    const [toListen, setToListen] = useState<ArtistReleaseItem[]>([]);
    const [listened, setListened] = useState<ArtistReleaseItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const { playPreview, togglePlay, isPlaying, currentTrack } = usePlayer();

    const fetchReleases = useCallback(async () => {
        const bearer = toBearer(await getStoredToken());
        if (!bearer) return;

        const res = await fetch(`${API_URL}/api/artist-releases/me?limit=100`, {
            headers: { Authorization: bearer },
        });
        const json = await safeJson(res);
        if (!res.ok) return;

        setToListen(Array.isArray(json?.toListen) ? json.toListen : []);
        setListened(Array.isArray(json?.listened) ? json.listened : []);
    }, []);

    const syncReleases = useCallback(async () => {
        const bearer = toBearer(await getStoredToken());
        if (!bearer) return;

        setSyncing(true);
        try {
            await fetch(`${API_URL}/api/artist-releases/sync`, {
                method: "POST",
                headers: { Authorization: bearer },
            }).catch(() => null);
            await fetchReleases();
        } finally {
            setSyncing(false);
        }
    }, [fetchReleases]);

    useEffect(() => {
        (async () => {
            setLoading(true);
            await fetchReleases();
            setLoading(false);
            syncReleases().catch(() => {});
        })();
    }, [fetchReleases, syncReleases]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await syncReleases();
        setRefreshing(false);
    }, [syncReleases]);

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

    const toggleListened = useCallback(
        async (item: ArtistReleaseItem, listenedValue: boolean) => {
            if (updatingId) return;
            setUpdatingId(item._id);

            try {
                const bearer = toBearer(await getStoredToken());
                if (!bearer) return;

                const res = await fetch(`${API_URL}/api/artist-releases/me`, {
                    method: "PATCH",
                    headers: {
                        Authorization: bearer,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ releaseId: item._id, listened: listenedValue }),
                });
                if (!res.ok) return;
                await fetchReleases();
            } finally {
                setUpdatingId(null);
            }
        },
        [fetchReleases, updatingId]
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

    const data = activeTab === "toListen" ? toListen : listened;
    const countLabel = useMemo(
        () => `${toListen.length} à écouter · ${listened.length} écoutés`,
        [listened.length, toListen.length]
    );

    const renderItem = useCallback(
        ({ item }: { item: ArtistReleaseItem }) => {
            const active = !!item.previewUrl && currentTrack?.url === item.previewUrl;
            const isDone = activeTab === "listened";

            return (
                <TouchableOpacity
                    style={styles.item}
                    activeOpacity={0.88}
                    onPress={() => openReleasePost(item)}
                >
                    {item.coverUrl ? (
                        <Image source={{ uri: item.coverUrl }} style={styles.cover} />
                    ) : (
                        <View style={[styles.cover, styles.coverFallback]}>
                            <Ionicons
                                name={item.itemType === "album" ? "disc" : "musical-notes"}
                                size={20}
                                color={colors.textMuted}
                            />
                        </View>
                    )}

                    <View style={styles.itemBody}>
                        <Text style={styles.kind}>
                            {item.itemType === "album" ? "Album" : "Son"} · {formatReleaseDate(item.releaseDate)}
                        </Text>
                        <Text style={styles.itemTitle} numberOfLines={1}>
                            {item.title}
                        </Text>
                        <Text style={styles.itemArtist} numberOfLines={1}>
                            {item.artistName}
                        </Text>
                    </View>

                    <View style={styles.actions}>
                        {item.previewUrl ? (
                            <TouchableOpacity
                                style={[styles.playButton, active && styles.playButtonActive]}
                                onPress={(event) => {
                                    event.stopPropagation();
                                    playRelease(item).catch(() => {});
                                }}
                                activeOpacity={0.84}
                            >
                                {active && isPlaying ? (
                                    <PlayerWave active size="sm" color={colors.text} inactiveColor={colors.text} />
                                ) : (
                                    <Ionicons name="play" size={14} color={colors.text} />
                                )}
                            </TouchableOpacity>
                        ) : null}

                        <TouchableOpacity
                            style={[styles.doneButton, isDone && styles.doneButtonMuted]}
                            disabled={updatingId === item._id}
                            onPress={(event) => {
                                event.stopPropagation();
                                toggleListened(item, !isDone).catch(() => {});
                            }}
                            activeOpacity={0.84}
                        >
                            <Ionicons
                                name={isDone ? "return-up-back-outline" : "checkmark"}
                                size={14}
                                color={isDone ? colors.textMuted : colors.bg}
                            />
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            );
        },
        [activeTab, currentTrack?.url, isPlaying, openReleasePost, playRelease, toggleListened, updatingId]
    );

    return (
        <AppScreen>
            <AppHeader
                title="Sorties à suivre"
                subtitle={countLabel}
                compact
                left={
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={20} color={colors.text} />
                    </TouchableOpacity>
                }
                right={
                    <TouchableOpacity style={styles.syncButton} onPress={syncReleases} disabled={syncing}>
                        {syncing ? (
                            <ActivityIndicator color={colors.text} size="small" />
                        ) : (
                            <Ionicons name="refresh" size={18} color={colors.text} />
                        )}
                    </TouchableOpacity>
                }
            />

            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === "toListen" && styles.tabActive]}
                    onPress={() => setActiveTab("toListen")}
                    activeOpacity={0.85}
                >
                    <Text style={[styles.tabText, activeTab === "toListen" && styles.tabTextActive]}>
                        À écouter
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, activeTab === "listened" && styles.tabActive]}
                    onPress={() => setActiveTab("listened")}
                    activeOpacity={0.85}
                >
                    <Text style={[styles.tabText, activeTab === "listened" && styles.tabTextActive]}>
                        Déjà écoutés
                    </Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loader}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={data}
                    keyExtractor={(item) => item._id}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                        />
                    }
                    contentContainerStyle={[
                        styles.list,
                        { paddingBottom: Math.max(insets.bottom, 12) + 110 },
                    ]}
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <Ionicons name="radio-outline" size={22} color={colors.primary} />
                            <Text style={styles.emptyTitle}>
                                {activeTab === "toListen"
                                    ? "Aucune sortie à écouter."
                                    : "Rien dans les sons déjà écoutés."}
                            </Text>
                            <Text style={styles.emptyText}>
                                Ajoute des artistes favoris puis actualise cette page.
                            </Text>
                        </View>
                    }
                />
            )}
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    backButton: {
        width: 38,
        height: 38,
        borderRadius: radius.lg,
        backgroundColor: colors.surface3,
        alignItems: "center",
        justifyContent: "center",
    },
    syncButton: {
        width: 38,
        height: 38,
        borderRadius: radius.lg,
        backgroundColor: colors.control,
        alignItems: "center",
        justifyContent: "center",
    },
    tabs: {
        flexDirection: "row",
        backgroundColor: colors.surfaceInset,
        borderRadius: radius.pill,
        padding: 4,
        marginBottom: spacing.md,
    },
    tab: {
        flex: 1,
        minHeight: 40,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.pill,
    },
    tabActive: {
        backgroundColor: colors.control,
    },
    tabText: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.black,
    },
    tabTextActive: {
        color: colors.text,
    },
    loader: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    list: {
        gap: spacing.sm,
    },
    item: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSoft,
    },
    cover: {
        width: 62,
        height: 62,
        borderRadius: radius.lg,
        backgroundColor: colors.surface4,
    },
    coverFallback: {
        alignItems: "center",
        justifyContent: "center",
    },
    itemBody: {
        flex: 1,
        minWidth: 0,
    },
    kind: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        textTransform: "uppercase",
        letterSpacing: 0.8,
        marginBottom: 3,
    },
    itemTitle: {
        color: colors.text,
        fontSize: typography.body,
        fontWeight: fontWeights.black,
    },
    itemArtist: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.bold,
        marginTop: 3,
    },
    actions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    playButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.control,
        alignItems: "center",
        justifyContent: "center",
    },
    playButtonActive: {
        backgroundColor: colors.controlActive,
    },
    doneButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    doneButtonMuted: {
        backgroundColor: colors.surface3,
    },
    emptyBox: {
        marginTop: spacing.xxl,
        alignItems: "center",
        gap: spacing.sm,
        padding: spacing.xl,
        backgroundColor: colors.surfaceFeed,
        borderRadius: radius.xxl,
    },
    emptyTitle: {
        color: colors.text,
        fontSize: typography.body,
        fontWeight: fontWeights.black,
        textAlign: "center",
    },
    emptyText: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        textAlign: "center",
        lineHeight: 19,
    },
});
