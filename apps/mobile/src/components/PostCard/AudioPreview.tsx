import React, { useMemo, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePlayer } from "../../context/PlayerContext";
import { colors, spacing, typography, fontWeights } from "../../theme";

type Props = {
    previewUrl: string | null;
    title: string;
    artist: string;
    coverUrl: string | null;
};

function MiniWave({ active }: { active: boolean }) {
    return (
        <View style={styles.waveWrap}>
            {[0, 1, 2].map((i) => (
                <View
                    key={i}
                    style={[
                        styles.waveBar,
                        active ? styles.waveBarActive : styles.waveBarInactive,
                        {
                            height: i === 1 ? 12 : i === 0 ? 9 : 7,
                        },
                    ]}
                />
            ))}
        </View>
    );
}

export default function AudioPreview({ previewUrl, title, artist, coverUrl }: Props) {
    const player = usePlayer();

    if (!previewUrl) return null;

    const currentTrack = player?.currentTrack ?? null;
    const isPlaying = !!player?.isPlaying;

    const isCurrentTrack = useMemo(() => {
        return !!currentTrack && currentTrack.url === previewUrl;
    }, [currentTrack, previewUrl]);

    const isActive = isCurrentTrack && isPlaying;

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
                    title,
                    artist,
                    coverUrl: coverUrl || "",
                    cover: coverUrl || "",
                    url: previewUrl,
                });
            }
        } catch (e) {
            console.log("AudioPreview togglePlay error:", e);
        }
    }, [player, isCurrentTrack, isPlaying, title, artist, coverUrl, previewUrl]);

    return (
        <View style={styles.wrap}>
            <TouchableOpacity
                style={styles.button}
                onPress={togglePlay}
                activeOpacity={0.82}
            >
                <View style={styles.left}>
                    <Ionicons
                        name={isActive ? "pause-circle" : "play-circle"}
                        size={30}
                        color={isActive ? colors.primary : colors.text}
                    />

                    <Text style={[styles.titleText, isActive && styles.titleTextActive]}>
                        {isActive ? "Lecture en cours" : "Écouter l'extrait"}
                    </Text>
                </View>

                <MiniWave active={isActive} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        marginTop: 10,
    },

    button: {
        minHeight: 34,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    left: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        minWidth: 0,
    },

    titleText: {
        marginLeft: 10,
        color: colors.text,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.extraBold,
    },

    titleTextActive: {
        color: colors.primary,
    },

    waveWrap: {
        width: 18,
        height: 14,
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        marginLeft: spacing.sm,
    },

    waveBar: {
        width: 3,
        borderRadius: 999,
    },

    waveBarInactive: {
        backgroundColor: colors.textFaint,
        opacity: 0.4,
    },

    waveBarActive: {
        backgroundColor: colors.primary,
        opacity: 0.95,
    },
});