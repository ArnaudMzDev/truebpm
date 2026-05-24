import React, { useMemo, useRef, useState } from "react";
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Animated,
    Easing,
    Pressable,
    PanResponder,
} from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlayer } from "../context/PlayerContext";
import { colors, typography, fontWeights, shadows } from "../theme";

function format(ms: number) {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function Cover({
                   uri,
                   size,
                   radiusValue,
               }: {
    uri?: string;
    size: number;
    radiusValue: number;
}) {
    if (!uri) {
        return (
            <View
                style={[
                    styles.coverFallback,
                    {
                        width: size,
                        height: size,
                        borderRadius: radiusValue,
                    },
                ]}
            >
                <Ionicons name="musical-notes" size={20} color={colors.textMuted} />
            </View>
        );
    }

    return (
        <Image
            source={{ uri }}
            style={{
                width: size,
                height: size,
                borderRadius: radiusValue,
                backgroundColor: colors.surface2,
            }}
        />
    );
}

function MiniWave({ active }: { active: boolean }) {
    return (
        <View style={styles.waveWrap}>
            {[0, 1, 2].map((i) => (
                <View
                    key={i}
                    style={[
                        styles.waveBar,
                        {
                            height: i === 1 ? 16 : i === 0 ? 11 : 8,
                            backgroundColor: active ? colors.primary : colors.textFaint,
                            opacity: active ? 0.95 : 0.42,
                        },
                    ]}
                />
            ))}
        </View>
    );
}

export default function PlayerBar() {
    const {
        currentTrack,
        isPlaying,
        togglePlay,
        seekTo,
        positionMs,
        durationMs,
        close,
    } = usePlayer();

    const insets = useSafeAreaInsets();
    const [modalVisible, setModalVisible] = useState(false);

    const overlayOpacity = useRef(new Animated.Value(0)).current;
    const sheetTranslateY = useRef(new Animated.Value(220)).current;
    const sheetOpacity = useRef(new Animated.Value(0)).current;
    const sheetScale = useRef(new Animated.Value(0.98)).current;

    const coverUri = currentTrack?.coverUrl || "";

    const progress = useMemo(() => {
        if (!durationMs) return 0;
        return Math.max(0, Math.min(1, positionMs / durationMs));
    }, [positionMs, durationMs]);

    const animateOpen = () => {
        overlayOpacity.setValue(0);
        sheetTranslateY.setValue(220);
        sheetOpacity.setValue(0);
        sheetScale.setValue(0.98);

        setModalVisible(true);

        requestAnimationFrame(() => {
            Animated.parallel([
                Animated.timing(overlayOpacity, {
                    toValue: 1,
                    duration: 220,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(sheetOpacity, {
                    toValue: 1,
                    duration: 220,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(sheetTranslateY, {
                    toValue: 0,
                    duration: 360,
                    easing: Easing.bezier(0.22, 1, 0.36, 1),
                    useNativeDriver: true,
                }),
                Animated.timing(sheetScale, {
                    toValue: 1,
                    duration: 360,
                    easing: Easing.bezier(0.22, 1, 0.36, 1),
                    useNativeDriver: true,
                }),
            ]).start();
        });
    };

    const animateClose = (callback?: () => void) => {
        Animated.parallel([
            Animated.timing(overlayOpacity, {
                toValue: 0,
                duration: 160,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
            }),
            Animated.timing(sheetOpacity, {
                toValue: 0,
                duration: 160,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
            }),
            Animated.timing(sheetTranslateY, {
                toValue: 180,
                duration: 240,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(sheetScale, {
                toValue: 0.985,
                duration: 240,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start(() => {
            setModalVisible(false);
            callback?.();
        });
    };

    const resetSheetPosition = () => {
        Animated.parallel([
            Animated.timing(sheetTranslateY, {
                toValue: 0,
                duration: 240,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(sheetScale, {
                toValue: 1,
                duration: 240,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(overlayOpacity, {
                toValue: 1,
                duration: 200,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }),
        ]).start();
    };

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gesture) => {
                return Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
            },
            onPanResponderMove: (_, gesture) => {
                const translate = Math.max(0, gesture.dy);
                const nextOverlay = Math.max(0.35, 1 - translate / 300);
                const nextScale = Math.max(0.96, 1 - translate / 2500);

                sheetTranslateY.setValue(translate);
                overlayOpacity.setValue(nextOverlay);
                sheetScale.setValue(nextScale);
            },
            onPanResponderRelease: (_, gesture) => {
                const shouldClose = gesture.dy > 120 || gesture.vy > 1.1;

                if (shouldClose) {
                    animateClose();
                } else {
                    resetSheetPosition();
                }
            },
            onPanResponderTerminate: () => {
                resetSheetPosition();
            },
        })
    ).current;

    if (!currentTrack) return null;

    const tabBarHeight = 62 + insets.bottom;

    return (
        <>
            <TouchableOpacity
                activeOpacity={0.94}
                onPress={animateOpen}
                style={[
                    styles.barWrap,
                    {
                        bottom: tabBarHeight,
                    },
                ]}
            >
                <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                </View>

                <View style={styles.bar}>
                    <View style={styles.barInner}>
                        <Cover uri={coverUri} size={48} radiusValue={12} />

                        <View style={styles.info}>
                            <Text numberOfLines={1} style={styles.title}>
                                {currentTrack.title}
                            </Text>
                            <Text numberOfLines={1} style={styles.artist}>
                                {currentTrack.artist}
                            </Text>
                        </View>

                        <MiniWave active={isPlaying} />

                        <TouchableOpacity
                            onPress={(e) => {
                                e.stopPropagation?.();
                                togglePlay();
                            }}
                            style={styles.iconBtn}
                        >
                            <Ionicons
                                name={isPlaying ? "pause" : "play"}
                                size={22}
                                color={colors.text}
                            />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={async (e) => {
                                e.stopPropagation?.();
                                await close();
                            }}
                            style={styles.iconBtn}
                        >
                            <Ionicons name="close" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>

            <Modal
                visible={modalVisible}
                transparent
                animationType="none"
                statusBarTranslucent
                onRequestClose={() => animateClose()}
            >
                <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => animateClose()} />

                    <Animated.View
                        style={[
                            styles.sheet,
                            {
                                paddingTop: insets.top + 10,
                                paddingBottom: insets.bottom + 18,
                                opacity: sheetOpacity,
                                transform: [
                                    { translateY: sheetTranslateY },
                                    { scale: sheetScale },
                                ],
                            },
                        ]}
                    >
                        <View {...panResponder.panHandlers} style={styles.dragZone}>
                            <View style={styles.dragHandleWrap}>
                                <View style={styles.dragHandle} />
                            </View>

                            <View style={styles.fullTopBar}>
                                <TouchableOpacity onPress={() => animateClose()} style={styles.topBtn}>
                                    <Ionicons name="chevron-down" size={26} color={colors.text} />
                                </TouchableOpacity>

                                <View style={styles.fullTopCenter}>
                                    <Text style={styles.fullTopEyebrow}>LECTURE EN COURS</Text>
                                </View>

                                <TouchableOpacity
                                    onPress={async () => {
                                        animateClose(async () => {
                                            await close();
                                        });
                                    }}
                                    style={styles.topBtn}
                                >
                                    <Ionicons name="close" size={23} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.fullContent}>
                                <Cover uri={coverUri} size={300} radiusValue={28} />

                                <Text style={styles.fullTitle} numberOfLines={2}>
                                    {currentTrack.title}
                                </Text>
                                <Text style={styles.fullArtist} numberOfLines={1}>
                                    {currentTrack.artist}
                                </Text>
                            </View>

                            <View style={styles.bottomArea}>
                                <Slider
                                    style={{ width: "100%" }}
                                    minimumValue={0}
                                    maximumValue={durationMs || 1}
                                    value={Math.min(positionMs, durationMs || 1)}
                                    onSlidingComplete={seekTo}
                                    minimumTrackTintColor={colors.primary}
                                    maximumTrackTintColor="#2A2A31"
                                    thumbTintColor={colors.primary}
                                />

                                <View style={styles.timeRow}>
                                    <Text style={styles.time}>{format(positionMs)}</Text>
                                    <Text style={styles.time}>{format(durationMs)}</Text>
                                </View>

                                <View style={styles.controls}>
                                    <TouchableOpacity onPress={togglePlay} style={styles.playCircle}>
                                        <Ionicons
                                            name={isPlaying ? "pause" : "play"}
                                            size={30}
                                            color={colors.text}
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Animated.View>
                </Animated.View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    barWrap: {
        position: "absolute",
        left: 0,
        right: 0,
        zIndex: 999,
    },

    progressTrack: {
        height: 3,
        backgroundColor: "#1E1E24",
        overflow: "hidden",
    },

    progressFill: {
        height: "100%",
        backgroundColor: colors.primary,
    },

    bar: {
        backgroundColor: "#0F0F13",
        borderTopWidth: 1,
        borderTopColor: "#23232A",
        paddingTop: 10,
        paddingBottom: 10,
        paddingHorizontal: 12,
    },

    barInner: {
        flexDirection: "row",
        alignItems: "center",
        minHeight: 58,
    },

    coverFallback: {
        backgroundColor: colors.surface3,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },

    info: {
        flex: 1,
        marginLeft: 12,
        marginRight: 10,
        minWidth: 0,
    },

    title: {
        color: colors.text,
        fontSize: typography.body,
        fontWeight: fontWeights.black,
    },

    artist: {
        color: colors.textMuted,
        fontSize: typography.caption,
        marginTop: 2,
    },

    waveWrap: {
        width: 18,
        height: 16,
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        marginRight: 10,
    },

    waveBar: {
        width: 3,
        borderRadius: 999,
    },

    iconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },

    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.55)",
        justifyContent: "flex-end",
    },

    sheet: {
        flex: 1,
        backgroundColor: colors.bg,
        paddingHorizontal: 24,
    },

    dragZone: {
        flex: 1,
    },

    dragHandleWrap: {
        alignItems: "center",
        paddingBottom: 10,
    },

    dragHandle: {
        width: 44,
        height: 5,
        borderRadius: 999,
        backgroundColor: "#3A3A44",
    },

    fullTopBar: {
        width: "100%",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingBottom: 8,
    },

    fullTopCenter: {
        flex: 1,
        alignItems: "center",
    },

    fullTopEyebrow: {
        color: colors.textMuted,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        letterSpacing: 1,
    },

    topBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface3,
        borderWidth: 1,
        borderColor: colors.border,
    },

    fullContent: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 8,
    },

    fullTitle: {
        color: colors.text,
        fontSize: 24,
        fontWeight: fontWeights.black,
        marginTop: 22,
        textAlign: "center",
        lineHeight: 30,
    },

    fullArtist: {
        color: colors.textMuted,
        fontSize: 16,
        marginTop: 8,
        textAlign: "center",
    },

    bottomArea: {
        width: "100%",
        paddingTop: 12,
    },

    timeRow: {
        width: "100%",
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 8,
    },

    time: {
        color: colors.textMuted,
        fontSize: typography.caption,
        fontWeight: fontWeights.medium,
    },

    controls: {
        alignItems: "center",
        marginTop: 24,
    },

    playCircle: {
        width: 74,
        height: 74,
        borderRadius: 37,
        backgroundColor: colors.primaryDark,
        alignItems: "center",
        justifyContent: "center",
        ...shadows.glowPrimary,
    },
});