import React, { useCallback, useMemo, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Alert,
    Image,
    ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "../lib/config";
import { usePlayer } from "../context/PlayerContext";

const NOTE_TRACK_PICK_KEY = "create_note_pending_track_pick";

type NoteTrack = {
    entityId: string;
    entityType: "song" | "album" | "artist";
    title: string;
    artist: string;
    coverUrl: string;
    previewUrl: string;
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

export default function CreateNoteScreen({ navigation, route }: any) {
    const existingNote = route?.params?.existingNote ?? null;

    const [text, setText] = useState(existingNote?.text || "");
    const [track, setTrack] = useState<NoteTrack | null>(existingNote?.track || null);
    const [saving, setSaving] = useState(false);
    const maxLen = 60;

    const { playPreview, togglePlay, isPlaying, currentTrack } = usePlayer();

    useFocusEffect(
        useCallback(() => {
            let active = true;

            (async () => {
                try {
                    const raw = await AsyncStorage.getItem(NOTE_TRACK_PICK_KEY);
                    if (!raw || !active) return;

                    const parsed = JSON.parse(raw);
                    if (parsed) {
                        setTrack(parsed);
                    }

                    await AsyncStorage.removeItem(NOTE_TRACK_PICK_KEY);
                } catch (e) {
                    console.log("CreateNote pending track error:", e);
                }
            })();

            return () => {
                active = false;
            };
        }, [])
    );

    const canSave = useMemo(
        () => text.trim().length > 0 && text.trim().length <= maxLen,
        [text]
    );

    const isCurrentTrack =
        !!track &&
        !!currentTrack &&
        currentTrack.title === track.title &&
        currentTrack.artist === track.artist &&
        currentTrack.url === (track.previewUrl || "");

    const handleSave = useCallback(async () => {
        if (!canSave || saving) return;

        const token = await AsyncStorage.getItem("token");
        if (!token) {
            Alert.alert("Erreur", "Tu n'es pas connecté.");
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/notes`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    text: text.trim(),
                    track: track || undefined,
                }),
            });

            const json = await safeJson(res);
            if (!res.ok) {
                Alert.alert("Erreur", json?.error || "Impossible d’enregistrer la note.");
                return;
            }

            navigation.goBack();
        } catch (e) {
            console.log("Create note error:", e);
            Alert.alert("Erreur", "Impossible d’enregistrer la note.");
        } finally {
            setSaving(false);
        }
    }, [canSave, saving, text, track, navigation]);

    const handleDelete = useCallback(async () => {
        const token = await AsyncStorage.getItem("token");
        if (!token) {
            Alert.alert("Erreur", "Tu n'es pas connecté.");
            return;
        }

        Alert.alert("Supprimer la note", "Tu veux vraiment supprimer ta note ?", [
            { text: "Annuler", style: "cancel" },
            {
                text: "Supprimer",
                style: "destructive",
                onPress: async () => {
                    try {
                        const res = await fetch(`${API_URL}/api/notes/me`, {
                            method: "DELETE",
                            headers: {
                                Authorization: `Bearer ${token}`,
                            },
                        });

                        if (!res.ok) {
                            const json = await safeJson(res);
                            Alert.alert("Erreur", json?.error || "Impossible de supprimer la note.");
                            return;
                        }

                        navigation.goBack();
                    } catch (e) {
                        console.log("Delete note error:", e);
                        Alert.alert("Erreur", "Impossible de supprimer la note.");
                    }
                },
            },
        ]);
    }, [navigation]);

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.85}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>

                <Text style={styles.title}>
                    {existingNote ? "Modifier ma note" : "Créer une note"}
                </Text>

                <View style={{ width: 24 }} />
            </View>

            <View style={styles.card}>
                <Text style={styles.label}>Ta note</Text>
                <TextInput
                    value={text}
                    onChangeText={setText}
                    placeholder="Ex: Ce son me détruit"
                    placeholderTextColor="#666"
                    style={styles.input}
                    maxLength={maxLen}
                    multiline
                />
                <Text style={styles.counter}>{text.length}/{maxLen}</Text>
            </View>

            <View style={styles.card}>
                <View style={styles.rowBetween}>
                    <Text style={styles.label}>Son associé</Text>

                    <TouchableOpacity
                        onPress={() =>
                            navigation.navigate("MusicSearch", {
                                mode: "pickNoteTrack",
                                initialType: "song",
                            })
                        }
                        activeOpacity={0.85}
                    >
                        <Text style={styles.pickText}>{track ? "Changer" : "Ajouter"}</Text>
                    </TouchableOpacity>
                </View>

                {track ? (
                    <View style={styles.trackCard}>
                        {track.coverUrl ? (
                            <Image source={{ uri: track.coverUrl }} style={styles.cover} />
                        ) : (
                            <View style={[styles.cover, styles.coverPlaceholder]}>
                                <Ionicons name="musical-notes" size={18} color="#888" />
                            </View>
                        )}

                        <View style={{ flex: 1 }}>
                            <Text style={styles.trackTitle} numberOfLines={1}>
                                {track.title}
                            </Text>
                            <Text style={styles.trackArtist} numberOfLines={1}>
                                {track.artist}
                            </Text>
                        </View>

                        {track.entityType === "song" && track.previewUrl ? (
                            <TouchableOpacity
                                style={styles.playBtn}
                                activeOpacity={0.85}
                                onPress={async () => {
                                    if (isCurrentTrack) {
                                        await togglePlay();
                                    } else {
                                        await playPreview({
                                            title: track.title,
                                            artist: track.artist,
                                            url: track.previewUrl,
                                            coverUrl: track.coverUrl,
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

                        <TouchableOpacity
                            style={styles.removeBtn}
                            activeOpacity={0.85}
                            onPress={() => setTrack(null)}
                        >
                            <Ionicons name="close" size={16} color="#fff" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <Text style={styles.helper}>Optionnel, mais très stylé.</Text>
                )}
            </View>

            <TouchableOpacity
                style={[styles.saveBtn, (!canSave || saving) && { opacity: 0.6 }]}
                activeOpacity={0.85}
                disabled={!canSave || saving}
                onPress={handleSave}
            >
                {saving ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.saveText}>
                        {existingNote ? "Mettre à jour" : "Publier la note"}
                    </Text>
                )}
            </TouchableOpacity>

            {existingNote ? (
                <TouchableOpacity style={styles.deleteBtn} activeOpacity={0.85} onPress={handleDelete}>
                    <Text style={styles.deleteText}>Supprimer la note</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
        paddingHorizontal: 16,
        paddingTop: 54,
    },
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
    },
    title: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "800",
    },
    card: {
        backgroundColor: "#0f0f0f",
        borderWidth: 1,
        borderColor: "#1d1d1d",
        borderRadius: 16,
        padding: 14,
        marginBottom: 14,
    },
    label: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "800",
        marginBottom: 10,
    },
    input: {
        color: "#fff",
        fontSize: 15,
        minHeight: 90,
        textAlignVertical: "top",
    },
    counter: {
        color: "#777",
        fontSize: 12,
        textAlign: "right",
        marginTop: 8,
    },
    rowBetween: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    pickText: {
        color: "#9B5CFF",
        fontWeight: "800",
    },
    helper: {
        color: "#777",
        fontSize: 13,
    },
    trackCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginTop: 6,
    },
    cover: {
        width: 54,
        height: 54,
        borderRadius: 10,
        backgroundColor: "#1b1b1b",
    },
    coverPlaceholder: {
        alignItems: "center",
        justifyContent: "center",
    },
    trackTitle: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "800",
    },
    trackArtist: {
        color: "#aaa",
        fontSize: 12,
        marginTop: 4,
    },
    playBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#5E17EB",
    },
    removeBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#222",
    },
    saveBtn: {
        backgroundColor: "#5E17EB",
        borderRadius: 14,
        paddingVertical: 15,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 10,
    },
    saveText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "800",
    },
    deleteBtn: {
        marginTop: 16,
        alignItems: "center",
    },
    deleteText: {
        color: "#FF6B6B",
        fontWeight: "700",
    },
});