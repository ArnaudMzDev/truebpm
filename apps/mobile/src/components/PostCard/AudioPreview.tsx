import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePlayer } from "../../context/PlayerContext";

type Props = {
    previewUrl: string | null;
    title: string;
    artist: string;
    coverUrl: string | null;
};

export default function AudioPreview({ previewUrl, title, artist, coverUrl }: Props) {
    const { currentTrack, isPlaying, playPreview, pause } = usePlayer();

    if (!previewUrl) return null;

    // Détecter si CE post utilise la même preview que le player global
    const isCurrentTrack = useMemo(() => {
        return (
            currentTrack &&
            currentTrack.url === previewUrl &&
            currentTrack.title === title &&
            currentTrack.artist === artist
        );
    }, [currentTrack, previewUrl, title, artist]);

    const togglePlay = () => {
        if (isCurrentTrack && isPlaying) {
            pause();
        } else {
            playPreview({
                title,
                artist,
                cover: coverUrl || "",
                url: previewUrl,
            });
        }
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.button} onPress={togglePlay}>
                <Ionicons
                    name={isCurrentTrack && isPlaying ? "pause" : "play"}
                    size={18}
                    color="#fff"
                />
            </TouchableOpacity>

            <Text style={styles.label}>
                {isCurrentTrack && isPlaying ? "Lecture en cours" : "Écouter l'extrait"}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 6,
    },
    button: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#9B5CFF",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 10,

        shadowColor: "#9B5CFF",
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
    },
    label: {
        color: "#ccc",
        fontSize: 14,
    },
});