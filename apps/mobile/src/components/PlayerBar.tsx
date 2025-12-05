// src/components/PlayerBar.tsx
import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { usePlayer } from "../context/PlayerContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PlayerBar() {
    const { currentTrack, isPlaying, togglePlay } = usePlayer();
    const insets = useSafeAreaInsets();

    // Si aucun son → ne rien afficher
    if (!currentTrack) return null;

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom + 8 }]}>
            {/* Cover */}
            <Image source={{ uri: currentTrack.artwork }} style={styles.cover} />

            {/* Infos */}
            <View style={styles.info}>
                <Text numberOfLines={1} style={styles.title}>
                    {currentTrack.title}
                </Text>
                <Text numberOfLines={1} style={styles.artist}>
                    {currentTrack.artist}
                </Text>
            </View>

            {/* Play / Pause */}
            <TouchableOpacity onPress={togglePlay} style={styles.playBtn}>
                <Text style={styles.playText}>
                    {isPlaying ? "⏸️" : "▶️"}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#111",
        borderTopWidth: 1,
        borderTopColor: "#222",
        paddingHorizontal: 12,
        paddingTop: 10,
        zIndex: 999,
    },

    cover: {
        width: 48,
        height: 48,
        borderRadius: 6,
    },

    info: {
        flex: 1,
        marginLeft: 12,
    },

    title: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "700",
    },

    artist: {
        color: "#aaa",
        fontSize: 12,
        marginTop: 2,
    },

    playBtn: {
        marginLeft: 10,
        padding: 10,
    },

    playText: {
        fontSize: 24,
        color: "#fff",
    },
});