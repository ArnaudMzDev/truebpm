import React, { useMemo, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePlayer } from "../../context/PlayerContext";

type Props = {
    previewUrl: string | null | undefined;
    title: string | undefined;
    artist: string | undefined;
    coverUrl: string | null | undefined;
};

export default function AudioPreview({ previewUrl, title, artist, coverUrl }: Props) {
    const player = usePlayer();

    const cleanPreviewUrl =
        typeof previewUrl === "string" ? previewUrl.trim() : "";

    const cleanTitle =
        typeof title === "string" && title.trim().length > 0
            ? title.trim()
            : "Titre inconnu";

    const cleanArtist =
        typeof artist === "string" && artist.trim().length > 0
            ? artist.trim()
            : "Artiste inconnu";

    const cleanCoverUrl =
        typeof coverUrl === "string" ? coverUrl.trim() : "";

    if (!cleanPreviewUrl) return null;

    const currentTrack = player?.currentTrack ?? null;
    const isPlaying = !!player?.isPlaying;

    const isCurrentTrack = useMemo(() => {
        return !!currentTrack && currentTrack.url === cleanPreviewUrl;
    }, [currentTrack, cleanPreviewUrl]);

    const togglePlay = useCallback(async () => {
        try {
            if (isCurrentTrack && isPlaying) {
                if (typeof (player as any)?.pause === "function") {
                    await (player as any).pause();
                } else if (typeof (player as any)?.togglePlay === "function") {
                    await (player as any).togglePlay();
                }
                return;
            }

            if (typeof (player as any)?.playPreview === "function") {
                await (player as any).playPreview({
                    title: cleanTitle,
                    artist: cleanArtist,
                    coverUrl: cleanCoverUrl,
                    cover: cleanCoverUrl,
                    url: cleanPreviewUrl,
                });
            }
        } catch (e) {
            console.log("AudioPreview togglePlay error:", e);
        }
    }, [player, isCurrentTrack, isPlaying, cleanTitle, cleanArtist, cleanCoverUrl, cleanPreviewUrl]);

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.button} onPress={togglePlay} activeOpacity={0.85}>
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
        marginTop: 8,
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