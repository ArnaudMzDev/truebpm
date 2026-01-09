// apps/mobile/src/components/PostCard/AudioPreview.tsx
import React, { useMemo, useCallback } from "react";
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
    const player = usePlayer();

    // ✅ si pas de preview => rien
    if (!previewUrl) return null;

    const currentTrack = player?.currentTrack ?? null;
    const isPlaying = !!player?.isPlaying;

    // ✅ IMPORTANT : match uniquement par URL
    const isCurrentTrack = useMemo(() => {
        return !!currentTrack && currentTrack.url === previewUrl;
    }, [currentTrack, previewUrl]);

    const togglePlay = useCallback(async () => {
        try {
            // Si c'est déjà ce track et qu'on joue => pause
            if (isCurrentTrack && isPlaying) {
                // pause() si dispo, sinon togglePlay() si tu l’as dans ton context
                if (typeof (player as any)?.pause === "function") {
                    await (player as any).pause();
                } else if (typeof (player as any)?.togglePlay === "function") {
                    await (player as any).togglePlay();
                }
                return;
            }

            // Sinon => playPreview
            if (typeof (player as any)?.playPreview === "function") {
                await (player as any).playPreview({
                    title,
                    artist,
                    cover: coverUrl || "",
                    url: previewUrl,
                });
            }
        } catch (e) {
            console.log("AudioPreview togglePlay error:", e);
        }
    }, [player, isCurrentTrack, isPlaying, title, artist, coverUrl, previewUrl]);

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