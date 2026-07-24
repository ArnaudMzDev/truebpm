import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    PanResponder,
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from "react-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fontWeights, radius, spacing, typography } from "../theme";

type CropMode = "avatar" | "banner";

type CropSource = {
    uri: string;
    width?: number | null;
    height?: number | null;
};

type Props = {
    visible: boolean;
    mode: CropMode;
    source: CropSource | null;
    onCancel: () => void;
    onCropped: (uri: string) => void;
};

const OUTPUT_SIZE = {
    avatar: { width: 900, height: 900 },
    banner: { width: 1600, height: 900 },
};

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function distance(touches: any[]) {
    if (touches.length < 2) return 0;
    const [a, b] = touches;
    const dx = a.pageX - b.pageX;
    const dy = a.pageY - b.pageY;
    return Math.sqrt(dx * dx + dy * dy);
}

export default function ProfileImageCropper({
                                                visible,
                                                mode,
                                                source,
                                                onCancel,
                                                onCropped,
                                            }: Props) {
    const insets = useSafeAreaInsets();
    const { width: screenWidth } = useWindowDimensions();
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const [scale, setScale] = useState(1);
    const [translate, setTranslate] = useState({ x: 0, y: 0 });
    const [saving, setSaving] = useState(false);

    const startTranslateRef = useRef({ x: 0, y: 0 });
    const startScaleRef = useRef(1);
    const startDistanceRef = useRef(0);
    const scaleRef = useRef(1);
    const translateRef = useRef({ x: 0, y: 0 });
    const metricsRef = useRef({
        baseScale: 1,
        frameWidth: 1,
        frameHeight: 1,
        imageWidth: 0,
        imageHeight: 0,
    });

    const frameWidth = Math.min(screenWidth - spacing.lg * 2, mode === "avatar" ? 330 : 380);
    const frameHeight = mode === "avatar" ? frameWidth : frameWidth * (9 / 16);
    const output = OUTPUT_SIZE[mode];

    const baseScale = useMemo(() => {
        if (!imageSize.width || !imageSize.height) return 1;
        return Math.max(frameWidth / imageSize.width, frameHeight / imageSize.height);
    }, [frameHeight, frameWidth, imageSize.height, imageSize.width]);

    const displayScale = baseScale * scale;
    const displayedWidth = imageSize.width * displayScale;
    const displayedHeight = imageSize.height * displayScale;

    metricsRef.current = {
        baseScale,
        frameWidth,
        frameHeight,
        imageWidth: imageSize.width,
        imageHeight: imageSize.height,
    };
    scaleRef.current = scale;
    translateRef.current = translate;

    const clampTranslate = (nextTranslate: { x: number; y: number }, nextScale = scaleRef.current) => {
        const metrics = metricsRef.current;
        const nextDisplayScale = metrics.baseScale * nextScale;
        const nextWidth = metrics.imageWidth * nextDisplayScale;
        const nextHeight = metrics.imageHeight * nextDisplayScale;
        const maxX = Math.max(0, (nextWidth - metrics.frameWidth) / 2);
        const maxY = Math.max(0, (nextHeight - metrics.frameHeight) / 2);

        return {
            x: clamp(nextTranslate.x, -maxX, maxX),
            y: clamp(nextTranslate.y, -maxY, maxY),
        };
    };

    const applyTransform = (nextScale: number, nextTranslate: { x: number; y: number }) => {
        const stableScale = clamp(nextScale, 1, 4);
        const stableTranslate = clampTranslate(nextTranslate, stableScale);
        scaleRef.current = stableScale;
        translateRef.current = stableTranslate;
        setScale(stableScale);
        setTranslate(stableTranslate);
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderTerminationRequest: () => false,
            onShouldBlockNativeResponder: () => true,
            onPanResponderGrant: (event) => {
                startTranslateRef.current = translateRef.current;
                startScaleRef.current = scaleRef.current;
                startDistanceRef.current = distance(event.nativeEvent.touches as any[]);
            },
            onPanResponderMove: (event, gestureState) => {
                const touches = event.nativeEvent.touches as any[];

                if (touches.length >= 2) {
                    const nextDistance = distance(touches);
                    if (!startDistanceRef.current) {
                        startDistanceRef.current = nextDistance || 1;
                        startScaleRef.current = scaleRef.current;
                    }
                    const startDistance = startDistanceRef.current || nextDistance || 1;
                    const nextScale = startScaleRef.current * (nextDistance / startDistance);
                    applyTransform(nextScale, translateRef.current);
                    return;
                }

                const nextTranslate = {
                    x: startTranslateRef.current.x + gestureState.dx,
                    y: startTranslateRef.current.y + gestureState.dy,
                };
                applyTransform(scaleRef.current, nextTranslate);
            },
            onPanResponderRelease: () => {
                applyTransform(scaleRef.current, translateRef.current);
            },
            onPanResponderTerminate: () => {
                applyTransform(scaleRef.current, translateRef.current);
            },
        })
    ).current;

    useEffect(() => {
        if (!visible || !source?.uri) return;

        setScale(1);
        setTranslate({ x: 0, y: 0 });
        setSaving(false);

        if (source.width && source.height) {
            setImageSize({ width: source.width, height: source.height });
            return;
        }

        Image.getSize(
            source.uri,
            (width, height) => setImageSize({ width, height }),
            () => setImageSize({ width: output.width, height: output.height })
        );
    }, [output.height, output.width, source, visible]);

    const saveCrop = async () => {
        if (!source?.uri || !imageSize.width || !imageSize.height || saving) return;

        const imageLeft = (frameWidth - displayedWidth) / 2 + translate.x;
        const imageTop = (frameHeight - displayedHeight) / 2 + translate.y;
        const cropWidth = Math.min(imageSize.width, frameWidth / displayScale);
        const cropHeight = Math.min(imageSize.height, frameHeight / displayScale);

        const originX = clamp(-imageLeft / displayScale, 0, Math.max(0, imageSize.width - cropWidth));
        const originY = clamp(-imageTop / displayScale, 0, Math.max(0, imageSize.height - cropHeight));

        try {
            setSaving(true);
            const result = await manipulateAsync(
                source.uri,
                [
                    {
                        crop: {
                            originX: Math.round(originX),
                            originY: Math.round(originY),
                            width: Math.round(cropWidth),
                            height: Math.round(cropHeight),
                        },
                    },
                    { resize: output },
                ],
                {
                    compress: mode === "avatar" ? 0.86 : 0.9,
                    format: SaveFormat.JPEG,
                }
            );

            onCropped(result.uri);
        } catch (e) {
            console.log("profile image crop error:", e);
            Alert.alert("Erreur", "Impossible de recadrer cette image.");
        } finally {
            setSaving(false);
        }
    };

    const label = mode === "avatar" ? "Photo de profil" : "Bannière";

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onCancel}>
            <View style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 12) }]}>
                <View style={styles.topBar}>
                    <Pressable style={styles.headerButton} onPress={onCancel}>
                        <Text style={styles.headerButtonText}>Annuler</Text>
                    </Pressable>
                    <View style={styles.titleWrap}>
                        <Text style={styles.eyebrow}>Recadrage</Text>
                        <Text style={styles.title}>{label}</Text>
                    </View>
                    <Pressable
                        style={[styles.headerButton, styles.doneButton, saving && styles.buttonDisabled]}
                        onPress={saveCrop}
                        disabled={saving}
                    >
                        <Text style={[styles.headerButtonText, styles.doneButtonText]}>
                            {saving ? "..." : "OK"}
                        </Text>
                    </Pressable>
                </View>

                <View style={styles.stage}>
                    <View
                        style={[
                            styles.cropFrame,
                            {
                                width: frameWidth,
                                height: frameHeight,
                                borderRadius: mode === "avatar" ? frameWidth / 2 : radius.xl,
                            },
                        ]}
                        {...panResponder.panHandlers}
                    >
                        {source?.uri && imageSize.width > 0 ? (
                            <Image
                                source={{ uri: source.uri }}
                                style={[
                                    styles.image,
                                    {
                                        width: displayedWidth,
                                        height: displayedHeight,
                                        transform: [
                                            { translateX: translate.x },
                                            { translateY: translate.y },
                                        ],
                                    },
                                ]}
                                resizeMode="stretch"
                            />
                        ) : (
                            <ActivityIndicator color={colors.primary} />
                        )}
                    </View>
                </View>

                <View style={styles.helpBox}>
                    <Text style={styles.helpTitle}>Ajuste ton image</Text>
                    <Text style={styles.helpText}>
                        Glisse pour déplacer. Pince avec deux doigts pour zoomer.
                    </Text>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.bg,
        paddingHorizontal: spacing.lg,
    },
    topBar: {
        minHeight: 58,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.sm,
    },
    headerButton: {
        minWidth: 72,
        minHeight: 42,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.md,
        backgroundColor: colors.control,
    },
    headerButtonText: {
        color: colors.text,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.black,
    },
    doneButton: {
        backgroundColor: colors.primary,
    },
    doneButtonText: {
        color: colors.bg,
    },
    buttonDisabled: {
        opacity: 0.55,
    },
    titleWrap: {
        flex: 1,
        alignItems: "center",
    },
    eyebrow: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        letterSpacing: 2,
        textTransform: "uppercase",
    },
    title: {
        color: colors.text,
        fontSize: typography.body,
        fontWeight: fontWeights.black,
        marginTop: 2,
    },
    stage: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    cropFrame: {
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderAccent,
    },
    image: {
        position: "absolute",
    },
    helpBox: {
        borderTopWidth: 1,
        borderTopColor: colors.separator,
        paddingTop: spacing.md,
        gap: 4,
    },
    helpTitle: {
        color: colors.text,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.black,
        textAlign: "center",
    },
    helpText: {
        color: colors.textMuted,
        fontSize: typography.caption,
        fontWeight: fontWeights.medium,
        textAlign: "center",
    },
});
