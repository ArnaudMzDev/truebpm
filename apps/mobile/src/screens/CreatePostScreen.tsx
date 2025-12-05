import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Alert
} from "react-native";
import Slider from "@react-native-community/slider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const localIP = Constants.expoConfig?.hostUri?.split(":")[0];
const API_URL = `http://${localIP}:3000`;

export default function CreatePostScreen({ navigation }: any) {
    const [mode, setMode] = useState<"general" | "multi">("general");

    const [generalNote, setGeneralNote] = useState(5);

    const [prod, setProd] = useState(5);
    const [lyrics, setLyrics] = useState(5);
    const [emotion, setEmotion] = useState(5);

    const [trackTitle, setTrackTitle] = useState("");
    const [artist, setArtist] = useState("");

    const handlePublish = async () => {
        if (!trackTitle.trim() || !artist.trim()) {
            return Alert.alert("Champs manquants", "Titre et artiste sont obligatoires.");
        }

        let rating = generalNote;

        if (mode === "multi") {
            rating = Number(((prod + lyrics + emotion) / 3).toFixed(1));
        }

        const token = await AsyncStorage.getItem("token");

        if (!token) {
            return Alert.alert("Erreur", "Tu dois être connecté.");
        }

        try {
            const res = await fetch(`${API_URL}/api/posts/create`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    trackTitle,
                    artist,
                    rating,
                    mode,
                    details: mode === "multi" ? { prod, lyrics, emotion } : null
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                console.log("Create post error:", data);
                return Alert.alert("Erreur", data.error || "Impossible de publier.");
            }

            Alert.alert("Publié 🎉", "Ton post a été ajouté !");
            navigation.goBack();

        } catch (err) {
            console.log(err);
            Alert.alert("Erreur", "Une erreur réseau est survenue.");
        }
    };

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.title}>Créer un post 🎧</Text>

            {/* ------------------------ INPUT TITRE ------------------------ */}
            <Text style={styles.label}>Titre du morceau *</Text>
            <TextInput
                style={styles.input}
                placeholder="Ex : Blinding Lights"
                placeholderTextColor="#666"
                value={trackTitle}
                onChangeText={setTrackTitle}
            />

            {/* ------------------------ INPUT ARTISTE ------------------------ */}
            <Text style={styles.label}>Artiste *</Text>
            <TextInput
                style={styles.input}
                placeholder="Ex : The Weeknd"
                placeholderTextColor="#666"
                value={artist}
                onChangeText={setArtist}
            />

            {/* ------------------------- MODE SELECTOR ------------------------- */}
            <View style={styles.modeSelector}>
                <TouchableOpacity
                    style={[styles.modeButton, mode === "general" && styles.modeActive]}
                    onPress={() => setMode("general")}
                >
                    <Text style={styles.modeText}>Note générale</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.modeButton, mode === "multi" && styles.modeActive]}
                    onPress={() => setMode("multi")}
                >
                    <Text style={styles.modeText}>Multi-critères</Text>
                </TouchableOpacity>
            </View>

            {/* ------------------------- NOTE GÉNÉRALE ------------------------- */}
            {mode === "general" && (
                <View style={styles.block}>
                    <Text style={styles.label}>Note globale</Text>
                    <Text style={styles.value}>{generalNote.toFixed(1)}/10</Text>

                    <Slider
                        style={{ width: "100%" }}
                        minimumValue={0}
                        maximumValue={10}
                        step={0.1}
                        minimumTrackTintColor="#9B5CFF"
                        maximumTrackTintColor="#444"
                        thumbTintColor="#9B5CFF"
                        value={generalNote}
                        onValueChange={setGeneralNote}
                    />
                </View>
            )}

            {/* ------------------------- MULTI-CRITÈRES ------------------------- */}
            {mode === "multi" && (
                <>
                    <View style={styles.block}>
                        <Text style={styles.label}>Production</Text>
                        <Text style={styles.value}>{prod.toFixed(1)}/10</Text>

                        <Slider
                            style={{ width: "100%" }}
                            minimumValue={0}
                            maximumValue={10}
                            step={0.1}
                            minimumTrackTintColor="#9B5CFF"
                            maximumTrackTintColor="#444"
                            thumbTintColor="#9B5CFF"
                            value={prod}
                            onValueChange={setProd}
                        />
                    </View>

                    <View style={styles.block}>
                        <Text style={styles.label}>Paroles</Text>
                        <Text style={styles.value}>{lyrics.toFixed(1)}/10</Text>

                        <Slider
                            style={{ width: "100%" }}
                            minimumValue={0}
                            maximumValue={10}
                            step={0.1}
                            minimumTrackTintColor="#9B5CFF"
                            maximumTrackTintColor="#444"
                            thumbTintColor="#9B5CFF"
                            value={lyrics}
                            onValueChange={setLyrics}
                        />
                    </View>

                    <View style={styles.block}>
                        <Text style={styles.label}>Émotions</Text>
                        <Text style={styles.value}>{emotion.toFixed(1)}/10</Text>

                        <Slider
                            style={{ width: "100%" }}
                            minimumValue={0}
                            maximumValue={10}
                            step={0.1}
                            minimumTrackTintColor="#9B5CFF"
                            maximumTrackTintColor="#444"
                            thumbTintColor="#9B5CFF"
                            value={emotion}
                            onValueChange={setEmotion}
                        />
                    </View>
                </>
            )}

            {/* ------------------------- BTN POSTER ------------------------- */}
            <TouchableOpacity
                style={styles.postButton}
                onPress={handlePublish}
            >
                <Text style={styles.postText}>Publier</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
        padding: 20,
    },
    title: {
        color: "#fff",
        fontSize: 24,
        fontWeight: "800",
        marginBottom: 20,
    },

    input: {
        backgroundColor: "#111",
        color: "#fff",
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#333",
        marginBottom: 16,
    },

    /* MODE SELECTOR */
    modeSelector: {
        flexDirection: "row",
        backgroundColor: "#111",
        padding: 6,
        borderRadius: 12,
        marginBottom: 20,
    },
    modeButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: "center",
    },
    modeActive: {
        backgroundColor: "#5E17EB",
    },
    modeText: {
        color: "#fff",
        fontWeight: "600",
    },

    block: {
        marginBottom: 25,
        backgroundColor: "#111",
        padding: 16,
        borderRadius: 14,
    },
    label: {
        color: "#ccc",
        fontSize: 16,
        fontWeight: "600",
    },
    value: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "800",
        marginBottom: 10,
        marginTop: 4,
    },

    postButton: {
        backgroundColor: "#9B5CFF",
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: "center",
        marginTop: 10,
    },
    postText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
    }
});