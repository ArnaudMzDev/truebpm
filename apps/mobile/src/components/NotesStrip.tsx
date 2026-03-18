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
        console.log("Non-JSON response:", text.slice(0, 200));
        return null;
    }
}

export default function NotesStrip({ navigation }: any) {
    const [notes, setNotes] = useState<NoteItem[]>([]);
    const [meId, setMeId] = useState<string | null>(null);
    const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);

    const { playPreview, togglePlay, isPlaying, currentTrack } = usePlayer();

    const fetchNotes = useCallback(async () => {
        const token = await AsyncStorage.getItem("token");
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
                        <Ionicons name={myNote ? "create-outline" : "add"} size={22} color="#fff" />
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
                                                <Ionicons name="musical-notes" size={16} color="#999" />
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
                                                    color="#fff"
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
        marginBottom: 12,
    },
    scrollContent: {
        paddingRight: 16,
        paddingLeft: 2,
    },
    createBubble: {
        width: 110,
        marginRight: 12,
        backgroundColor: "#111",
        borderWidth: 1,
        borderColor: "#242424",
        borderRadius: 16,
        padding: 10,
    },
    noteBubble: {
        width: 110,
        marginRight: 12,
        backgroundColor: "#0f0f0f",
        borderWidth: 1,
        borderColor: "#1d1d1d",
        borderRadius: 16,
        padding: 10,
    },
    createAvatarWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#5E17EB",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
    },
    avatarWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        padding: 2,
        backgroundColor: "#5E17EB",
        marginBottom: 8,
    },
    avatar: {
        width: "100%",
        height: "100%",
        borderRadius: 20,
    },
    name: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "800",
    },
    preview: {
        color: "#aaa",
        fontSize: 11,
        marginTop: 4,
        lineHeight: 15,
    },

    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.72)",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 20,
    },
    modalCard: {
        width: "100%",
        backgroundColor: "#0d0d0d",
        borderWidth: 1,
        borderColor: "#1f1f1f",
        borderRadius: 22,
        padding: 16,
    },
    modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: 14,
    },
    modalAvatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
    },
    modalName: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "800",
    },
    modalSubtitle: {
        color: "#888",
        fontSize: 12,
        marginTop: 3,
    },
    modalText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
        lineHeight: 25,
        marginBottom: 14,
    },
    trackCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: "#131313",
        borderWidth: 1,
        borderColor: "#232323",
        borderRadius: 14,
        padding: 10,
    },
    trackCover: {
        width: 50,
        height: 50,
        borderRadius: 10,
        backgroundColor: "#1b1b1b",
    },
    trackPlaceholder: {
        alignItems: "center",
        justifyContent: "center",
    },
    trackTitle: {
        color: "#fff",
        fontWeight: "800",
        fontSize: 14,
    },
    trackArtist: {
        color: "#999",
        fontSize: 12,
        marginTop: 4,
    },
    trackPlay: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#5E17EB",
    },
});