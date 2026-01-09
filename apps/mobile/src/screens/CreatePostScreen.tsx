// apps/mobile/src/screens/CreatePostScreen.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Alert,
} from "react-native";
import Slider from "@react-native-community/slider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { usePlayer } from "../context/PlayerContext";

const localIP = Constants.expoConfig?.hostUri?.split(":")[0];
const API_URL = `http://${localIP}:3000`;

/* -------------------- CRITERIA CONFIG -------------------- */

const CRITERIA_BY_TYPE: Record<
    "song" | "album" | "artist",
    { key: string; label: string }[]
> = {
    song: [
        { key: "prod", label: "Production" },
        { key: "lyrics", label: "Paroles" },
        { key: "emotion", label: "Émotion" },
    ],
    album: [
        { key: "cohesion", label: "Cohésion" },
        { key: "production", label: "Production" },
        { key: "originality", label: "Originalité" },
    ],
    artist: [
        { key: "identity", label: "Identité" },
        { key: "consistency", label: "Régularité" },
        { key: "impact", label: "Impact" },
    ],
};

/* -------------------- TYPES -------------------- */

type Props = {
    route: {
        params: {
            entityType: "song" | "album" | "artist";
            entityId: string | null;
            track: {
                title: string;
                artist: string;
                cover: string | null;
                previewUrl?: string | null;
            };
        };
    };
    navigation: any;
};

export default function CreatePostScreen({ route, navigation }: Props) {
    const { entityType, entityId, track } = route.params;

    const [mode, setMode] = useState<"general" | "multi">("general");
    const [rating, setRating] = useState(3);
    const [ratings, setRatings] = useState<Record<string, number>>({});
    const [comment, setComment] = useState("");
    const [publishing, setPublishing] = useState(false);

    const { playPreview, togglePlay, isPlaying, currentTrack } = usePlayer();

    const criteria = CRITERIA_BY_TYPE[entityType];

    /* -------------------- ENSURE DEFAULT MULTI RATINGS -------------------- */
    useEffect(() => {
        if (mode !== "multi") return;

        setRatings((prev) => {
            const next = { ...prev };
            for (const c of criteria) {
                if (typeof next[c.key] !== "number") next[c.key] = 3;
            }
            return next;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, entityType]);

    const average = useMemo(() => {
        if (mode !== "multi") return null;

        const values = criteria
            .map((c) => ratings[c.key])
            .filter((v) => typeof v === "number") as number[];

        if (values.length !== criteria.length) return null;

        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        return Number(avg.toFixed(1));
    }, [ratings, mode, criteria]);

    const isCurrentTrack =
        !!currentTrack &&
        currentTrack.title === track.title &&
        currentTrack.artist === track.artist &&
        currentTrack.url === (track.previewUrl || "");

    const handlePublish = async () => {
        if (publishing) return;

        const token = await AsyncStorage.getItem("token");
        if (!token) {
            Alert.alert("Erreur", "Tu n'es pas connecté.");
            return;
        }

        setPublishing(true);

        try {
            const payload: any = {
                entityType,
                entityId,

                trackTitle: track.title,
                artist: track.artist,

                coverUrl: track.cover || null,

                // ✅ IMPORTANT : sinon la preview n’existera jamais sur les posts
                previewUrl: track.previewUrl || null,

                mode,
                comment: comment.trim(),
            };

            if (mode === "general") {
                payload.rating = rating;
            } else {
                const finalRatings: Record<string, number> = {};
                for (const c of criteria) {
                    finalRatings[c.key] =
                        typeof ratings[c.key] === "number" ? ratings[c.key] : 3;
                }
                payload.ratings = finalRatings;
            }

            // ✅ IMPORTANT : adapte l'URL si ta route est vraiment /api/posts/create
            const res = await fetch(`${API_URL}/api/posts/create`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const txt = await res.text().catch(() => "");
                console.log("Create post error:", res.status, txt);
                Alert.alert("Erreur", "Impossible de publier le post.");
                return;
            }

            // Optionnel: reset player si tu veux éviter un bug de preview restée ouverte
            // await close();

            navigation.replace("Main");
        } catch (e) {
            console.log("Publish error:", e);
            Alert.alert("Erreur", "Impossible de publier le post.");
        } finally {
            setPublishing(false);
        }
    };

    return (
        <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
            <TouchableOpacity onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={26} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.title}>Créer un post</Text>

            <View style={styles.card}>
                {track.cover ? (
                    <Image source={{ uri: track.cover }} style={styles.cover} />
                ) : null}

                <View style={{ flex: 1 }}>
                    <Text style={styles.trackTitle}>{track.title}</Text>
                    <Text style={styles.trackArtist}>{track.artist}</Text>

                    {entityType === "song" && track.previewUrl ? (
                        <TouchableOpacity
                            style={styles.previewRow}
                            onPress={() => {
                                if (isCurrentTrack) {
                                    togglePlay();
                                } else {
                                    playPreview({
                                        title: track.title,
                                        artist: track.artist,
                                        cover: track.cover || "",
                                        url: track.previewUrl!,
                                    });
                                }
                            }}
                            activeOpacity={0.85}
                        >
                            <Ionicons
                                name={isCurrentTrack && isPlaying ? "pause" : "play"}
                                size={16}
                                color="#fff"
                            />
                            <Text style={styles.previewText}>
                                {isCurrentTrack && isPlaying ? "Pause" : "Écouter l'extrait"}
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>

            <View style={styles.switch}>
                <TouchableOpacity
                    style={[styles.switchBtn, mode === "general" && styles.switchActive]}
                    onPress={() => setMode("general")}
                >
                    <Text style={styles.switchText}>Note simple</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.switchBtn, mode === "multi" && styles.switchActive]}
                    onPress={() => setMode("multi")}
                >
                    <Text style={styles.switchText}>Multi-critères</Text>
                </TouchableOpacity>
            </View>

            {mode === "general" ? (
                <>
                    <Text style={styles.sectionTitle}>Note : {rating.toFixed(1)} / 5</Text>
                    <Slider
                        minimumValue={1}
                        maximumValue={5}
                        step={0.5}
                        value={rating}
                        onValueChange={setRating}
                        minimumTrackTintColor="#9B5CFF"
                        maximumTrackTintColor="#333"
                    />
                </>
            ) : (
                <>
                    {criteria.map((c) => (
                        <View key={c.key} style={styles.sliderBlock}>
                            <Text style={styles.sliderLabel}>
                                {c.label} : {(ratings[c.key] ?? 3).toFixed(1)}
                            </Text>
                            <Slider
                                minimumValue={1}
                                maximumValue={5}
                                step={0.5}
                                value={ratings[c.key] ?? 3}
                                onValueChange={(v) => setRatings((r) => ({ ...r, [c.key]: v }))}
                                minimumTrackTintColor="#9B5CFF"
                                maximumTrackTintColor="#333"
                            />
                        </View>
                    ))}

                    {average !== null ? (
                        <Text style={styles.average}>Moyenne : {average} / 5</Text>
                    ) : null}
                </>
            )}

            <TextInput
                style={styles.input}
                placeholder="Ton avis..."
                placeholderTextColor="#666"
                multiline
                value={comment}
                onChangeText={setComment}
            />

            <TouchableOpacity
                style={[styles.publishBtn, publishing && { opacity: 0.6 }]}
                onPress={handlePublish}
                disabled={publishing}
                activeOpacity={0.85}
            >
                <Text style={styles.publishText}>
                    {publishing ? "Publication..." : "Publier"}
                </Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
        padding: 20,
        paddingTop: 50,
    },
    title: {
        color: "#fff",
        fontSize: 24,
        fontWeight: "800",
        marginVertical: 20,
    },
    card: {
        flexDirection: "row",
        backgroundColor: "#111",
        padding: 14,
        borderRadius: 14,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: "#222",
    },
    cover: {
        width: 70,
        height: 70,
        borderRadius: 10,
        marginRight: 14,
    },
    trackTitle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
    },
    trackArtist: {
        color: "#aaa",
        marginTop: 4,
    },
    previewRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 8,
        gap: 6,
    },
    previewText: {
        color: "#ccc",
        fontSize: 13,
    },
    switch: {
        flexDirection: "row",
        backgroundColor: "#111",
        borderRadius: 10,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: "#222",
    },
    switchBtn: {
        flex: 1,
        paddingVertical: 12,
        alignItems: "center",
    },
    switchActive: {
        backgroundColor: "#5E17EB",
        borderRadius: 10,
    },
    switchText: {
        color: "#fff",
        fontWeight: "600",
    },
    sectionTitle: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
        marginBottom: 10,
    },
    sliderBlock: {
        marginBottom: 16,
    },
    sliderLabel: {
        color: "#fff",
        marginBottom: 6,
    },
    average: {
        color: "#9B5CFF",
        fontWeight: "700",
        marginTop: 10,
        fontSize: 16,
    },
    input: {
        backgroundColor: "#111",
        color: "#fff",
        borderRadius: 12,
        padding: 14,
        minHeight: 100,
        marginTop: 20,
        borderWidth: 1,
        borderColor: "#222",
    },
    publishBtn: {
        backgroundColor: "#9B5CFF",
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: "center",
        marginTop: 20,
        marginBottom: 100,
    },
    publishText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
});