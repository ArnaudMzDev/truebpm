import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import PlayerWave from "../PlayerWave";
import { colors, fontWeights, radius, spacing, typography } from "../../theme";

type Props = {
    url: string;
    roundKey: string;
    active: boolean;
    onError?: (message: string) => void;
};

function BlindTestAudioPlayer({ url, roundKey, active, onError }: Props) {
    const soundRef = useRef<Audio.Sound | null>(null);
    const mountedRef = useRef(true);
    const [loaded, setLoaded] = useState(false);
    const [playing, setPlaying] = useState(false);

    const unload = useCallback(async () => {
        const sound = soundRef.current;
        soundRef.current = null;
        if (!sound) return;
        sound.setOnPlaybackStatusUpdate(null);
        await sound.stopAsync().catch(() => {});
        await sound.unloadAsync().catch(() => {});
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        setLoaded(false);
        setPlaying(false);

        void (async () => {
            await unload();
            try {
                const { sound } = await Audio.Sound.createAsync(
                    { uri: url },
                    { shouldPlay: false, progressUpdateIntervalMillis: 300 }
                );
                if (!mountedRef.current) {
                    await sound.unloadAsync().catch(() => {});
                    return;
                }
                soundRef.current = sound;
                sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
                    if (!mountedRef.current) return;
                    if (!status.isLoaded) {
                        setLoaded(false);
                        setPlaying(false);
                        if (status.error) onError?.("L’extrait ne peut pas être lu.");
                        return;
                    }
                    setLoaded(true);
                    setPlaying(status.isPlaying);
                });
                const status = await sound.getStatusAsync();
                if (status.isLoaded) setLoaded(true);
            } catch {
                onError?.("L’extrait ne peut pas être chargé.");
            }
        })();

        return () => {
            mountedRef.current = false;
            void unload();
        };
    }, [onError, roundKey, unload, url]);

    useEffect(() => {
        const sound = soundRef.current;
        if (!sound || !loaded) return;
        if (active) {
            void sound.playAsync().catch(() => onError?.("Lecture impossible."));
        } else {
            void sound.pauseAsync().catch(() => {});
        }
    }, [active, loaded, onError]);

    useEffect(() => {
        const subscription = AppState.addEventListener("change", (state) => {
            const sound = soundRef.current;
            if (!sound) return;
            if (state !== "active") {
                void sound.pauseAsync().catch(() => {});
            } else if (active) {
                void sound.playAsync().catch(() => {});
            }
        });
        return () => subscription.remove();
    }, [active]);

    const toggle = useCallback(async () => {
        const sound = soundRef.current;
        if (!sound || !loaded || !active) return;
        const status = await sound.getStatusAsync();
        if (!status.isLoaded) return;
        if (status.isPlaying) {
            await sound.pauseAsync();
        } else {
            if (status.didJustFinish) await sound.setPositionAsync(0);
            await sound.playAsync();
        }
    }, [active, loaded]);

    return (
        <View style={styles.wrap}>
            <View pointerEvents="none" style={styles.coverTexture}>
                <View style={styles.textureTileOne} />
                <View style={styles.textureTileTwo} />
                <Text style={styles.coverMonogram}>TBPM</Text>
            </View>
            <View style={styles.topRow}>
                <View style={styles.maskedPill}>
                    <Ionicons name="eye-off-outline" size={14} color={colors.accentMuted} />
                    <Text style={styles.maskedText}>Cover mystère</Text>
                </View>
                <View style={styles.audioStateRow}>
                    <View style={[styles.statusDot, loaded && styles.statusDotReady]} />
                    <Text style={styles.audioState}>{loaded ? "Prêt" : "Chargement"}</Text>
                </View>
            </View>

            <View style={styles.centerStage}>
                <Text style={styles.mysteryGlyph}>?</Text>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={playing ? "Mettre l’extrait en pause" : "Lire l’extrait"}
                    disabled={!loaded || !active}
                    onPress={toggle}
                    style={({ pressed }) => [styles.playButton, pressed && styles.pressed, (!loaded || !active) && styles.disabled]}
                >
                    {playing ? (
                        <PlayerWave active size="md" color={colors.text} inactiveColor={colors.textMuted} />
                    ) : (
                        <Ionicons name="play" size={28} color={colors.text} style={styles.playIcon} />
                    )}
                </Pressable>
            </View>

            <View style={styles.bottomCopy}>
                <Text style={styles.kicker}>Extrait audio</Text>
                <Text style={styles.title}>{playing ? "Tu l’as reconnu ?" : "Appuie pour écouter"}</Text>
                <Text style={styles.subtitle}>
                    {playing ? "La cover se dévoile après ta réponse." : "Tu peux relancer l’extrait tant que le chrono tourne."}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        width: "100%",
        aspectRatio: 1,
        justifyContent: "space-between",
        padding: spacing.lg,
        borderRadius: radius.xxl,
        overflow: "hidden",
        backgroundColor: colors.surfaceEditorial,
    },
    coverTexture: {
        ...StyleSheet.absoluteFillObject,
        overflow: "hidden",
    },
    textureTileOne: {
        position: "absolute",
        width: "82%",
        height: "82%",
        top: -72,
        right: -104,
        borderRadius: 68,
        backgroundColor: colors.primaryFaint,
        transform: [{ rotate: "18deg" }],
    },
    textureTileTwo: {
        position: "absolute",
        width: "74%",
        height: "52%",
        left: -92,
        bottom: -78,
        borderRadius: 72,
        backgroundColor: colors.control,
        transform: [{ rotate: "-14deg" }],
    },
    coverMonogram: {
        position: "absolute",
        right: -18,
        bottom: 54,
        color: colors.primaryFaint,
        fontSize: 64,
        fontWeight: fontWeights.black,
    },
    topRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    maskedPill: {
        minHeight: 34,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        backgroundColor: "rgba(7,8,12,0.72)",
    },
    maskedText: {
        color: colors.textSoft,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        textTransform: "uppercase",
    },
    audioState: {
        color: colors.textMuted,
        fontSize: typography.tiny,
        fontWeight: fontWeights.bold,
    },
    audioStateRow: {
        minHeight: 34,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        backgroundColor: "rgba(7,8,12,0.72)",
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: radius.pill,
        backgroundColor: colors.textFaint,
    },
    statusDotReady: {
        backgroundColor: colors.success,
    },
    centerStage: {
        alignSelf: "center",
        width: 132,
        height: 132,
        alignItems: "center",
        justifyContent: "center",
    },
    mysteryGlyph: {
        position: "absolute",
        color: colors.primarySoft,
        fontSize: 128,
        lineHeight: 132,
        fontWeight: fontWeights.black,
    },
    playButton: {
        width: 82,
        height: 82,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primaryDark,
        shadowColor: colors.primary,
        shadowOpacity: 0.34,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    },
    playIcon: {
        marginLeft: 3,
    },
    pressed: {
        opacity: 0.78,
        transform: [{ scale: 0.97 }],
    },
    disabled: {
        opacity: 0.45,
    },
    bottomCopy: {
        gap: 4,
    },
    kicker: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        textTransform: "uppercase",
    },
    title: {
        color: colors.text,
        fontSize: typography.subtitle,
        fontWeight: fontWeights.black,
    },
    subtitle: {
        color: colors.textMuted,
        fontSize: typography.caption,
        lineHeight: 17,
        fontWeight: fontWeights.medium,
    },
});

export default memo(BlindTestAudioPlayer);
