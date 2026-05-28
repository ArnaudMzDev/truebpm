import React, { useMemo, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePlayer } from "../../context/PlayerContext";
import { colors, spacing, radius, typography, fontWeights } from "../../theme";

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
        <View style={[styles.wrap, isActive && styles.wrapActive]}>
            <Pressable
                onPress={togglePlay}
                onPressIn={() => animateTo(0.98)}
                onPressOut={() => animateTo(1)}
            >
                <Animated.View style={[styles.button, { transform: [{ scale }] }]}>
                    <View style={[styles.playDot, isActive && styles.playDotActive]}>
                        <Ionicons
                            name={isActive ? "pause" : "play"}
                            size={17}
                            color={colors.text}
                            style={!isActive && styles.playIconOffset}
                        />
                    </View>

                    <View style={styles.copy}>
                        <Text style={[styles.titleText, isActive && styles.titleTextActive]}>
                            {isActive ? "Lecture en cours" : "Extrait audio"}
                        </Text>
                        <Text style={styles.subtitleText} numberOfLines={1}>
                            {isActive ? "Extrait en cours dans le feed" : "Touche pour écouter l’extrait"}
                        </Text>
                    </View>

                    <MiniWave active={isActive} />
                </Animated.View>
            </Pressable>
        </View>
    );
}

export default React.memo(AudioPreview);

const styles = StyleSheet.create({
    wrap: {
        marginTop: spacing.sm,
        width: "100%",
        borderRadius: radius.xl,
    },

    wrapActive: {
        backgroundColor: colors.primaryFaint,
    },

    button: {
        minHeight: 58,
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "rgba(14, 17, 24, 0.72)",
        borderWidth: 1,
        borderColor: colors.borderAccent,
        borderRadius: radius.xl,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },

    playDot: {
        width: 38,
        height: 38,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surfacePressed,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        marginRight: spacing.sm,
    },

    playDotActive: {
        backgroundColor: colors.primaryDark,
        borderColor: colors.primaryGlow,
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
        fontSize: typography.bodySm,
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
