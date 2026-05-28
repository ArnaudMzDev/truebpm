import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    Modal,
    Pressable,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
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

    useEffect(() => {
        fetchNotes();
    }, [fetchNotes]);

    const myNote = useMemo(
        () => notes.find((n) => String(n.userId?._id) === String(meId)) || null,
        [notes, meId]
    );

    const otherNotes = useMemo(
        () => notes.filter((n) => String(n.userId?._id) !== String(meId)),
        [notes, meId]
    );

    const openCreate = useCallback(() => {
        navigation.navigate("CreateNote", { existingNote: myNote });
    }, [navigation, myNote]);

    const renderBubble = (item: NoteItem, isMine = false) => (
        <TouchableOpacity
            key={item._id}
            style={styles.noteBubble}
            activeOpacity={0.85}
            onPress={() => (isMine ? openCreate() : setSelectedNote(item))}
        >
            <View style={styles.avatarWrap}>
                <Image
                    source={{ uri: item.userId?.avatarUrl || "https://picsum.photos/100" }}
                    style={styles.avatar}
                />
            </View>
            <Text style={styles.name} numberOfLines={1}>
                {isMine ? "Ta note" : item.userId?.pseudo || "Utilisateur"}
            </Text>
            <Text style={styles.preview} numberOfLines={2}>
                {item.text}
            </Text>
        </TouchableOpacity>
    );

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

    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                <TouchableOpacity style={styles.createBubble} activeOpacity={0.85} onPress={openCreate}>
                    <View style={styles.createAvatarWrap}>
                        <Ionicons name={myNote ? "create-outline" : "add"} size={22} color={colors.text} />
                    </View>
                    <Text style={styles.name}>Ta note</Text>
                    <Text style={styles.preview} numberOfLines={2}>
                        {myNote ? myNote.text : "Ajouter une note"}
                    </Text>
                </TouchableOpacity>

                {otherNotes.map((item) => renderBubble(item))}
            </ScrollView>

            <Modal visible={!!selectedNote} transparent animationType="fade" onRequestClose={() => setSelectedNote(null)}>
                <Pressable style={styles.modalBackdrop} onPress={() => setSelectedNote(null)}>
                    <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
                        {selectedNote ? (
                            <>
                                <View style={styles.modalHeader}>
                                    <Image
                                        source={{ uri: selectedNote.userId?.avatarUrl || "https://picsum.photos/100" }}
                                        style={styles.modalAvatar}
                                    />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.modalName}>{selectedNote.userId?.pseudo}</Text>
                                        <Text style={styles.modalSubtitle}>TrueBPM Note</Text>
                                    </View>
                                </View>

                                <Text style={styles.modalText}>{selectedNote.text}</Text>

                                {selectedTrack?.title ? (
                                    <View style={styles.trackCard}>
                                        {selectedTrack.coverUrl ? (
                                            <Image source={{ uri: selectedTrack.coverUrl }} style={styles.trackCover} />
                                        ) : (
                                            <View style={[styles.trackCover, styles.trackPlaceholder]}>
                                                <Ionicons name="musical-notes" size={16} color={colors.textMuted} />
                                            </View>
                                        )}

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
                                                    size={16}
                                                    color={colors.text}
                                                />
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                ) : null}
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
        marginBottom: spacing.md,
    },
    scrollContent: {
        paddingRight: spacing.lg,
        paddingLeft: 2,
    },
    createBubble: {
        width: 116,
        marginRight: spacing.md,
        backgroundColor: "#151122",
        borderWidth: 1,
        borderColor: colors.borderAccent,
        borderRadius: radius.xl,
        padding: spacing.md,
    },
    noteBubble: {
        width: 116,
        marginRight: spacing.md,
        backgroundColor: colors.surface2,
        borderWidth: 1,
        borderColor: colors.borderSoft,
        borderRadius: radius.xl,
        padding: spacing.md,
    },
    createAvatarWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primaryDark,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
    },
    avatarWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        padding: 2,
        backgroundColor: colors.primaryDark,
        marginBottom: 8,
    },
    avatar: {
        width: "100%",
        height: "100%",
        borderRadius: 20,
    },
    name: {
        color: colors.text,
        fontSize: typography.caption,
        fontWeight: fontWeights.black,
    },
    preview: {
        color: colors.textMuted,
        fontSize: typography.tiny,
        marginTop: 4,
        lineHeight: 15,
    },

    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.78)",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 20,
    },
    modalCard: {
        width: "100%",
        backgroundColor: colors.surface2,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.xl,
        padding: spacing.lg,
    },
    modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    modalAvatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
    },
    modalName: {
        color: colors.text,
        fontSize: 16,
        fontWeight: fontWeights.black,
    },
    modalSubtitle: {
        color: colors.primary,
        fontSize: typography.caption,
        fontWeight: fontWeights.bold,
        marginTop: 3,
    },
    modalText: {
        color: colors.text,
        fontSize: 18,
        fontWeight: fontWeights.extraBold,
        lineHeight: 25,
        marginBottom: 14,
    },
    trackCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        backgroundColor: colors.surface3,
        borderWidth: 1,
        borderColor: colors.borderSoft,
        borderRadius: radius.lg,
        padding: spacing.md,
    },
    trackCover: {
        width: 50,
        height: 50,
        borderRadius: radius.md,
        backgroundColor: colors.surface4,
    },
    trackPlaceholder: {
        alignItems: "center",
        justifyContent: "center",
    },
    trackTitle: {
        color: colors.text,
        fontWeight: fontWeights.black,
        fontSize: 14,
    },
    trackArtist: {
        color: colors.textMuted,
        fontSize: 12,
        marginTop: 4,
    },
    trackPlay: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primaryDark,
    },
});
