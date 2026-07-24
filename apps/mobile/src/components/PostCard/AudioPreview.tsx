import React, { useMemo, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePlayer } from "../../context/PlayerContext";
import { colors, spacing, radius, typography, fontWeights } from "../../theme";
import PlayerWave from "../PlayerWave";

type Props = {
    previewUrl: string | null;
    title: string;
    artist: string;
    coverUrl: string | null;
};

function AudioPreview({ previewUrl, title, artist, coverUrl }: Props) {
    const player = usePlayer();
    const scale = React.useRef(new Animated.Value(1)).current;

    const currentTrack = player?.currentTrack ?? null;
    const isPlaying = !!player?.isPlaying;

    const isCurrentTrack = useMemo(() => {
        return !!currentTrack && currentTrack.url === previewUrl;
    }, [currentTrack, previewUrl]);

    const isActive = isCurrentTrack && isPlaying;

    const animateTo = useCallback(
        (value: number) => {
            Animated.spring(scale, {
                toValue: value,
                useNativeDriver: true,
                speed: 24,
                bounciness: 2,
            }).start();
        },
        [scale]
    );

    const togglePlay = useCallback(async () => {
        if (!previewUrl) return;

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
            if (__DEV__) console.log("AudioPreview togglePlay error:", e);
        }
    }, [player, isCurrentTrack, isPlaying, title, artist, coverUrl, previewUrl]);

    if (!previewUrl) return null;

    return (
        <View style={styles.wrap}>
            <Pressable
                onPress={togglePlay}
                onPressIn={() => animateTo(0.97)}
                onPressOut={() => animateTo(1)}
                hitSlop={4}
            >
                <Animated.View
                    style={[
                        styles.button,
                        isActive && styles.buttonActive,
                        { transform: [{ scale }] },
                    ]}
                >
                    <View style={[styles.playDot, isActive && styles.playDotActive]}>
                        <Ionicons
                            name={isActive ? "pause" : "play"}
                            size={18}
                            color={colors.text}
                            style={!isActive && styles.playIconOffset}
                        />
                    </View>

                    <View style={styles.copy}>
                        <Text style={[styles.titleText, isActive && styles.titleTextActive]}>
                            {isActive ? "En lecture" : "Écouter l’extrait"}
                        </Text>
                        <Text style={styles.subtitleText} numberOfLines={1}>
                            {isActive ? "Preview 30 secondes" : "Preview 30 secondes"}
                        </Text>
                    </View>

                    <PlayerWave active={isActive} style={styles.wave} />
                </Animated.View>
            </Pressable>
        </View>
    );
}

export default React.memo(AudioPreview);

const styles = StyleSheet.create({
    wrap: {
        marginTop: spacing.md,
        width: "100%",
    },

    button: {
        minHeight: 54,
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "rgba(7, 9, 13, 0.5)",
        borderRadius: radius.pill,
        paddingLeft: 6,
        paddingRight: spacing.md,
        paddingVertical: 6,
    },

    buttonActive: {
        backgroundColor: colors.primaryFaint,
    },

    playDot: {
        width: 42,
        height: 42,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.controlActive,
        marginRight: spacing.sm,
    },

    playDotActive: {
        backgroundColor: colors.primary,
    },

    playIconOffset: {
        marginLeft: 2,
    },

    copy: {
        flex: 1,
        minWidth: 0,
    },

    titleText: {
        color: colors.text,
        fontSize: typography.body,
        fontWeight: fontWeights.extraBold,
    },

    titleTextActive: {
        color: colors.primary,
    },

    subtitleText: {
        marginTop: 2,
        color: colors.textFaint,
        fontSize: typography.tiny,
        fontWeight: fontWeights.medium,
    },

    wave: {
        marginLeft: spacing.sm,
    },
});
