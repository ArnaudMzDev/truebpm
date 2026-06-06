import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    Modal,
    Pressable,
    Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { API_URL } from "../lib/config";
import { usePlayer } from "../context/PlayerContext";
import { colors, radius, spacing, typography, fontWeights } from "../theme";
import { getStoredToken } from "../lib/authStorage";

type NoteUser = {
    _id: string;
    pseudo: string;
    avatarUrl?: string;
};

type NoteTrack = {
    entityId?: string;
    entityType?: "song" | "album" | "artist" | "";
    title?: string;
    artist?: string;
    coverUrl?: string;
    previewUrl?: string;
};

type NoteItem = {
    _id: string;
    userId: NoteUser;
    text: string;
    track?: NoteTrack;
    createdAt: string;
    expiresAt: string;
    likesCount?: number;
    likedByMe?: boolean;
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

export default function NotesStrip({ navigation }: any) {
    const [notes, setNotes] = useState<NoteItem[]>([]);
    const [meId, setMeId] = useState<string | null>(null);
    const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);
    const [likingNoteIds, setLikingNoteIds] = useState<Record<string, boolean>>({});
    const [notesRailScrollEnabled, setNotesRailScrollEnabled] = useState(true);
    const lastTapRef = useRef<Record<string, number>>({});
    const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const railTouchStartRef = useRef({ x: 0, y: 0 });
    const likePulse = useRef(new Animated.Value(0)).current;

    const { playPreview, togglePlay, isPlaying, currentTrack } = usePlayer();

    const fetchNotes = useCallback(async () => {
        const token = await getStoredToken();
        const rawUser = await AsyncStorage.getItem("user");

        if (rawUser) {
            try {
                const u = JSON.parse(rawUser);
                setMeId(u?._id ? String(u._id) : null);
            } catch {}
        }

        if (!token) {
            setNotes([]);
            return;
        }

        const res = await fetch(`${API_URL}/api/notes`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        const json = await safeJson(res);
        if (!res.ok) {
            console.log("fetchNotes error:", res.status, json);
            setNotes([]);
            return;
        }

        setNotes(Array.isArray(json?.notes) ? json.notes : []);
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchNotes().catch(() => {});
        }, [fetchNotes])
    );

    const myNote = useMemo(
        () => notes.find((n) => String(n.userId?._id) === String(meId)) || null,
        [notes, meId]
    );

    const visibleNotes = useMemo(
        () => notes.filter((n) => String(n.userId?._id) !== String(meId)),
        [notes, meId]
    );

    const myNoteHint = useMemo(() => {
        const title = myNote?.track?.title?.trim();
        return title || "ta note";
    }, [myNote?.track?.title]);

    const openCreate = useCallback(() => {
        setSelectedNote(null);
        navigation.navigate("CreateNote", { existingNote: myNote });
    }, [navigation, myNote]);

    const closeNote = useCallback(() => {
        setSelectedNote(null);
    }, []);

    const applyNoteLikeState = useCallback((noteId: string, likedByMe: boolean, likesCount: number) => {
        setNotes((prev) =>
            prev.map((note) =>
                note._id === noteId ? { ...note, likedByMe, likesCount } : note
            )
        );

        setSelectedNote((prev) =>
            prev && prev._id === noteId ? { ...prev, likedByMe, likesCount } : prev
        );
    }, []);

    const toggleNoteLike = useCallback(
        async (noteId: string) => {
            if (likingNoteIds[noteId]) return;

            const target = notes.find((note) => note._id === noteId) || selectedNote;
            if (!target) return;
            if (String(target.userId?._id) === String(meId)) return;

            const token = await getStoredToken();
            if (!token) return;

            const previousLiked = !!target.likedByMe;
            const previousCount = target.likesCount ?? 0;
            const nextLiked = !previousLiked;
            const nextCount = Math.max(0, previousCount + (nextLiked ? 1 : -1));

            setLikingNoteIds((prev) => ({ ...prev, [noteId]: true }));
            applyNoteLikeState(noteId, nextLiked, nextCount);

            if (nextLiked) {
                likePulse.setValue(0);
                Animated.sequence([
                    Animated.timing(likePulse, {
                        toValue: 1,
                        duration: 140,
                        useNativeDriver: true,
                    }),
                    Animated.timing(likePulse, {
                        toValue: 0,
                        duration: 260,
                        useNativeDriver: true,
                    }),
                ]).start();
            }

            try {
                const res = await fetch(`${API_URL}/api/notes/${noteId}/like`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                });

                const json = await safeJson(res);
                if (!res.ok) {
                    applyNoteLikeState(noteId, previousLiked, previousCount);
                    return;
                }

                applyNoteLikeState(
                    noteId,
                    typeof json?.likedByMe === "boolean" ? json.likedByMe : nextLiked,
                    typeof json?.likesCount === "number" ? json.likesCount : nextCount
                );
            } finally {
                setLikingNoteIds((prev) => ({ ...prev, [noteId]: false }));
            }
        },
        [applyNoteLikeState, likePulse, likingNoteIds, meId, notes, selectedNote]
    );

    const openNote = useCallback((note: NoteItem) => {
        setSelectedNote(note);
    }, []);

    const handleNotePress = useCallback(
        (note: NoteItem) => {
            const now = Date.now();
            const lastTap = lastTapRef.current[note._id] || 0;
            const isDoubleTap = now - lastTap < 310;

            lastTapRef.current[note._id] = now;

            if (isDoubleTap) {
                if (singleTapTimerRef.current) {
                    clearTimeout(singleTapTimerRef.current);
                    singleTapTimerRef.current = null;
                }
                toggleNoteLike(note._id).catch(() => {});
                return;
            }

            if (singleTapTimerRef.current) {
                clearTimeout(singleTapTimerRef.current);
            }

            singleTapTimerRef.current = setTimeout(() => {
                singleTapTimerRef.current = null;
                openNote(note);
            }, 320);
        },
        [openNote, toggleNoteLike]
    );

    const handleRailTouchStart = useCallback((event: any) => {
        railTouchStartRef.current = {
            x: event.nativeEvent.pageX,
            y: event.nativeEvent.pageY,
        };
        setNotesRailScrollEnabled(true);
    }, []);

    const handleRailTouchMove = useCallback((event: any) => {
        const dx = Math.abs(event.nativeEvent.pageX - railTouchStartRef.current.x);
        const dy = Math.abs(event.nativeEvent.pageY - railTouchStartRef.current.y);

        if (dy > 10 && dy > dx * 1.15) {
            setNotesRailScrollEnabled(false);
        } else if (dx > 10 && dx > dy) {
            setNotesRailScrollEnabled(true);
        }
    }, []);

    const handleRailTouchEnd = useCallback(() => {
        setNotesRailScrollEnabled(true);
    }, []);

    const renderBubble = (item: NoteItem) => {
        const isMine = String(item.userId?._id) === String(meId);
        const trackTitle = item.track?.title?.trim();
        const artist = item.track?.artist?.trim();
        const label = isMine ? "Ta note" : item.userId?.pseudo || "Note";
        const sublabel = trackTitle || artist || "À écouter";

        return (
            <TouchableOpacity
                key={item._id}
                style={styles.railItem}
                activeOpacity={0.88}
                onPress={() => handleNotePress(item)}
            >
                <View style={[styles.bubbleRing, isMine && styles.bubbleRingMine, item.likedByMe && !isMine && styles.bubbleRingLiked]}>
                    <Image
                        source={{ uri: item.userId?.avatarUrl || "https://picsum.photos/100" }}
                        style={styles.avatar}
                    />

                    {item.likedByMe && !isMine ? (
                        <View style={styles.likedDot}>
                            <Ionicons name="heart" size={10} color={colors.danger} />
                        </View>
                    ) : null}

                    {!isMine && (item.likesCount ?? 0) > 0 ? (
                        <View style={styles.likeBadge}>
                            <Text style={styles.likeBadgeText}>{item.likesCount}</Text>
                        </View>
                    ) : null}
                </View>

                <View style={styles.bubbleTextBlock}>
                    <Text style={styles.bubbleLabel} numberOfLines={1}>
                        {label}
                    </Text>
                    <Text style={styles.bubbleSublabel} numberOfLines={1}>
                        {sublabel}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    const selectedTrack = selectedNote?.track;
    const canPlay =
        selectedTrack?.entityType === "song" &&
        !!selectedTrack?.previewUrl;

    const isCurrentTrack =
        !!selectedTrack &&
        !!currentTrack &&
        currentTrack.title === selectedTrack.title &&
        currentTrack.artist === selectedTrack.artist &&
        currentTrack.url === (selectedTrack.previewUrl || "");

    const selectedIsMine = String(selectedNote?.userId?._id) === String(meId);
    const likePulseStyle = useMemo(
        () => ({
            opacity: likePulse,
            transform: [
                {
                    scale: likePulse.interpolate({
                        inputRange: [0, 0.45, 1],
                        outputRange: [0.68, 1.2, 1],
                    }),
                },
            ],
        }),
        [likePulse]
    );

    useEffect(() => {
        if (!selectedNote) return;
        if (!canPlay || !selectedTrack?.previewUrl) return;

        const shouldStart =
            !currentTrack ||
            currentTrack.title !== selectedTrack.title ||
            currentTrack.artist !== selectedTrack.artist ||
            currentTrack.url !== selectedTrack.previewUrl;

        if (!shouldStart) {
            if (!isPlaying) {
                togglePlay().catch(() => {});
            }
            return;
        }

        playPreview({
            title: selectedTrack.title || "",
            artist: selectedTrack.artist || "",
            url: selectedTrack.previewUrl || "",
            coverUrl: selectedTrack.coverUrl || "",
        }).catch(() => {});
    }, [
        canPlay,
        currentTrack,
        isPlaying,
        playPreview,
        selectedNote,
        selectedTrack?.artist,
        selectedTrack?.coverUrl,
        selectedTrack?.previewUrl,
        selectedTrack?.title,
        togglePlay,
    ]);

    useEffect(() => {
        return () => {
            if (singleTapTimerRef.current) {
                clearTimeout(singleTapTimerRef.current);
            }
        };
    }, []);

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.kicker}>Notes</Text>
                    <Text style={styles.title}>Ce que les gens écoutent</Text>
                </View>
            </View>

            <ScrollView
                horizontal
                scrollEnabled={notesRailScrollEnabled}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                directionalLockEnabled
                nestedScrollEnabled
                alwaysBounceVertical={false}
                bounces={false}
                scrollEventThrottle={16}
                onTouchStart={handleRailTouchStart}
                onTouchMove={handleRailTouchMove}
                onTouchEnd={handleRailTouchEnd}
                onTouchCancel={handleRailTouchEnd}
                contentContainerStyle={styles.scrollContent}
            >
                <TouchableOpacity style={styles.railItem} activeOpacity={0.85} onPress={openCreate}>
                    <View style={[styles.createAvatarWrap, myNote && styles.createAvatarWrapEdit]}>
                        {myNote?.userId?.avatarUrl ? (
                            <>
                                <Image source={{ uri: myNote.userId.avatarUrl }} style={styles.createAvatarImage} />
                                <View style={styles.editBubbleDot}>
                                    <Ionicons name="create-outline" size={10} color={colors.text} />
                                </View>
                            </>
                        ) : (
                            <Ionicons name={myNote ? "create-outline" : "add"} size={20} color={colors.text} />
                        )}
                    </View>
                    <View style={styles.bubbleTextBlock}>
                        <Text style={styles.bubbleLabel} numberOfLines={1}>
                            Ta note
                        </Text>
                        <Text style={styles.bubbleSublabel} numberOfLines={1}>
                            {myNote ? myNoteHint : "ajouter"}
                        </Text>
                    </View>
                </TouchableOpacity>

                {visibleNotes.map((item) => renderBubble(item))}
            </ScrollView>

            <Modal visible={!!selectedNote} transparent animationType="slide" onRequestClose={closeNote}>
                <Pressable style={styles.modalBackdrop} onPress={closeNote}>
                    <Pressable style={styles.bottomSheet} onPress={(e) => e.stopPropagation()}>
                        {selectedNote ? (
                            <>
                                <View style={styles.sheetHandle} />

                                <View style={styles.modalHeader}>
                                    <Image
                                        source={{ uri: selectedNote.userId?.avatarUrl || "https://picsum.photos/100" }}
                                        style={styles.modalAvatar}
                                    />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.modalName}>{selectedNote.userId?.pseudo}</Text>
                                        <Text style={styles.modalSubtitle}>
                                            {selectedIsMine ? "Ta note du moment" : "Note du moment"}
                                        </Text>
                                    </View>

                                    {selectedIsMine ? (
                                        <TouchableOpacity style={styles.editNoteButton} onPress={openCreate} activeOpacity={0.85}>
                                            <Ionicons name="create-outline" size={16} color={colors.text} />
                                        </TouchableOpacity>
                                    ) : null}
                                </View>

                                <View style={styles.quoteBlock}>
                                    <Text style={styles.modalText}>{selectedNote.text}</Text>
                                    <Animated.View style={[styles.likeBurst, likePulseStyle]} pointerEvents="none">
                                        <Ionicons name="heart" size={86} color="rgba(255, 78, 112, 0.92)" />
                                    </Animated.View>
                                </View>

                                {selectedTrack?.title ? (
                                    <View style={styles.trackCard}>
                                        <View style={styles.trackIcon}>
                                            <Ionicons name="musical-notes" size={18} color={colors.primary} />
                                        </View>

                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.trackTitle} numberOfLines={1}>
                                                {selectedTrack.title}
                                            </Text>
                                            <Text style={styles.trackArtist} numberOfLines={1}>
                                                {selectedTrack.artist || "Musique"}
                                            </Text>
                                        </View>

                                        {canPlay ? (
                                            <TouchableOpacity
                                                style={styles.trackPlay}
                                                activeOpacity={0.85}
                                                onPress={async () => {
                                                    if (isCurrentTrack) {
                                                        await togglePlay();
                                                    } else {
                                                        await playPreview({
                                                            title: selectedTrack.title || "",
                                                            artist: selectedTrack.artist || "",
                                                            url: selectedTrack.previewUrl || "",
                                                            coverUrl: selectedTrack.coverUrl || "",
                                                        });
                                                    }
                                                }}
                                            >
                                                <Ionicons
                                                    name={isCurrentTrack && isPlaying ? "pause" : "play"}
                                                    size={18}
                                                    color={colors.text}
                                                />
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                ) : null}

                                <TouchableOpacity
                                    style={[
                                        styles.modalLikeButton,
                                        selectedNote.likedByMe && !selectedIsMine && styles.modalLikeButtonActive,
                                        selectedIsMine && styles.modalLikeButtonMine,
                                    ]}
                                    activeOpacity={0.85}
                                    onPress={() => toggleNoteLike(selectedNote._id)}
                                    disabled={selectedIsMine || !!likingNoteIds[selectedNote._id]}
                                >
                                    <Ionicons
                                        name={(selectedIsMine ? "person" : selectedNote.likedByMe ? "heart" : "heart-outline") as any}
                                        size={19}
                                        color={selectedIsMine ? colors.primary : selectedNote.likedByMe ? colors.danger : colors.textMuted}
                                    />
                                    <Text
                                        style={[
                                            styles.modalLikeText,
                                            selectedNote.likedByMe && !selectedIsMine && styles.modalLikeTextActive,
                                        ]}
                                    >
                                        {selectedIsMine ? "Ta note" : selectedNote.likesCount ?? 0}
                                    </Text>
                                </TouchableOpacity>
                            </>
                        ) : null}
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.lg,
    },
    headerRow: {
        paddingHorizontal: spacing.xs,
        marginBottom: spacing.sm,
    },
    kicker: {
        color: colors.primary,
        fontSize: 12,
        fontWeight: fontWeights.black,
        letterSpacing: 3,
        textTransform: "uppercase",
    },
    title: {
        color: colors.text,
        fontSize: 17,
        fontWeight: fontWeights.black,
        marginTop: 3,
    },
    scrollContent: {
        paddingRight: spacing.lg,
        paddingLeft: 1,
        paddingTop: 2,
        paddingBottom: 4,
    },
    railItem: {
        width: 86,
        minHeight: 118,
        marginRight: spacing.md,
        alignItems: "center",
        justifyContent: "flex-start",
    },
    createAvatarWrap: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: "rgba(151, 89, 255, 0.16)",
        borderWidth: 2,
        borderColor: "rgba(151, 89, 255, 0.55)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
        overflow: "visible",
        position: "relative",
    },
    createAvatarWrapEdit: {
        borderColor: "rgba(151, 89, 255, 0.75)",
        backgroundColor: "rgba(151, 89, 255, 0.11)",
    },
    createAvatarImage: {
        width: "100%",
        height: "100%",
        borderRadius: 38,
        backgroundColor: colors.surface4,
    },
    editBubbleDot: {
        position: "absolute",
        right: -3,
        bottom: 2,
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primary,
    },
    bubbleRing: {
        width: 76,
        height: 76,
        borderRadius: 38,
        padding: 3,
        backgroundColor: "#0B0D12",
        borderWidth: 2,
        borderColor: "rgba(36, 42, 57, 0.95)",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        marginBottom: 8,
    },
    bubbleRingMine: {
        borderColor: "rgba(151, 89, 255, 0.62)",
        backgroundColor: "rgba(151, 89, 255, 0.12)",
    },
    bubbleRingLiked: {
        borderColor: "rgba(255, 85, 120, 0.62)",
    },
    avatar: {
        width: "100%",
        height: "100%",
        borderRadius: 35,
        backgroundColor: colors.surface4,
    },
    likedDot: {
        position: "absolute",
        right: -3,
        top: 1,
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#17101A",
    },
    likeBadge: {
        position: "absolute",
        right: -6,
        bottom: 4,
        minWidth: 24,
        height: 22,
        paddingHorizontal: 6,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(12, 14, 20, 0.98)",
        borderWidth: 1,
        borderColor: "rgba(255, 85, 120, 0.3)",
    },
    likeBadgeText: {
        color: colors.danger,
        fontSize: 11,
        fontWeight: fontWeights.black,
        fontVariant: ["tabular-nums"],
    },
    bubbleLabel: {
        color: colors.text,
        fontSize: 12,
        fontWeight: fontWeights.black,
        textAlign: "center",
        width: 86,
    },
    bubbleTextBlock: {
        width: 86,
        minHeight: 32,
        alignItems: "center",
        justifyContent: "flex-start",
    },
    bubbleSublabel: {
        color: colors.textMuted,
        fontSize: 10,
        fontWeight: fontWeights.bold,
        textAlign: "center",
        marginTop: 2,
        width: 86,
    },

    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.56)",
        justifyContent: "flex-end",
    },
    bottomSheet: {
        width: "100%",
        backgroundColor: "#07080B",
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: spacing.lg,
        paddingBottom: spacing.xl,
    },
    sheetHandle: {
        alignSelf: "center",
        width: 42,
        height: 5,
        borderRadius: radius.pill,
        backgroundColor: colors.surface4,
        marginBottom: spacing.lg,
    },
    modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    modalAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.surface4,
    },
    modalName: {
        color: colors.text,
        fontSize: 16,
        fontWeight: fontWeights.black,
    },
    modalSubtitle: {
        color: colors.textMuted,
        fontSize: typography.caption,
        fontWeight: fontWeights.bold,
        marginTop: 3,
    },
    editNoteButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface3,
    },
    quoteBlock: {
        position: "relative",
        minHeight: 112,
        borderRadius: 24,
        backgroundColor: "rgba(255,255,255,0.035)",
        padding: spacing.lg,
        justifyContent: "center",
        marginBottom: spacing.md,
        overflow: "hidden",
    },
    modalText: {
        color: colors.text,
        fontSize: 22,
        fontWeight: fontWeights.black,
        lineHeight: 29,
    },
    likeBurst: {
        position: "absolute",
        alignSelf: "center",
    },
    trackCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        backgroundColor: "transparent",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.08)",
        padding: spacing.md,
        paddingHorizontal: 0,
    },
    modalLikeButton: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        marginTop: spacing.lg,
        paddingHorizontal: spacing.md,
        paddingVertical: 11,
        borderRadius: radius.pill,
        backgroundColor: "rgba(20, 24, 33, 0.84)",
    },
    modalLikeButtonActive: {
        backgroundColor: "rgba(65, 22, 36, 0.62)",
    },
    modalLikeButtonMine: {
        backgroundColor: "rgba(151, 89, 255, 0.12)",
    },
    modalLikeText: {
        color: colors.textMuted,
        fontSize: typography.caption,
        fontWeight: fontWeights.black,
    },
    modalLikeTextActive: {
        color: colors.danger,
    },
    trackIcon: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(151, 89, 255, 0.12)",
    },
    trackTitle: {
        color: colors.text,
        fontWeight: fontWeights.black,
        fontSize: 15,
    },
    trackArtist: {
        color: colors.textMuted,
        fontSize: 12,
        marginTop: 4,
    },
    trackPlay: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primary,
    },
});
