// apps/mobile/src/screens/CreatePostScreen.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { API_URL } from "../lib/config";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlayer } from "../context/PlayerContext";
import AppButton from "../components/ui/AppButton";
import AppScreen from "../components/ui/AppScreen";
import { colors, spacing, radius, typography, fontWeights } from "../theme";
import { getStoredToken } from "../lib/authStorage";

const CRITERIA_BY_TYPE: Record<
    "song" | "album" | "artist",
    { key: string; label: string }[]
> = {
    song: [
        { key: "prod", label: "Production" },
        { key: "lyrics", label: "Paroles" },
        { key: "emotion", label: "Émotion" },
    ],
    album: [
        { key: "cohesion", label: "Cohésion" },
        { key: "production", label: "Production" },
        { key: "originality", label: "Originalité" },
    ],
    artist: [
        { key: "identity", label: "Identité" },
        { key: "consistency", label: "Régularité" },
        { key: "impact", label: "Impact" },
    ],
};

/* -------------------- TYPES -------------------- */

type Props = {
    route: {
        params: {
            entityType: "song" | "album" | "artist";
            entityId: string | null;
            track: {
                title: string;
                artist: string;
                cover: string | null;
                previewUrl?: string | null;
            };
        };
    };
    navigation: any;
};

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function snapRating(value: number) {
    return clamp(Math.round(value * 2) / 2, 1, 5);
}

function formatRating(value: number) {
    return Number(value.toFixed(1)).toString();
}

const SCORE_MARKS = [1, 2, 3, 4, 5];

function RatingSlider({
                          label,
                          value,
                          onChange,
                          featured = false,
                      }: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    featured?: boolean;
}) {
    const percent = clamp((value - 1) / 4, 0, 1);

    return (
        <View style={[styles.ratingControl, featured && styles.ratingControlFeatured]}>
            <View style={styles.ratingControlHeader}>
                <Text style={styles.ratingControlLabel} numberOfLines={1}>
                    {label}
                </Text>

                <View style={styles.scorePill}>
                    <Text style={styles.scoreValue}>{formatRating(value)}</Text>
                    <Text style={styles.scoreOutOf}>/5</Text>
                </View>
            </View>

            <View style={styles.sliderVisualWrap}>
                <View style={styles.sliderTrackBackdrop}>
                    <View style={[styles.sliderTrackFill, { width: `${percent * 100}%` }]} />
                    <View style={styles.sliderTicks} pointerEvents="none">
                        {SCORE_MARKS.map((mark) => (
                            <View
                                key={mark}
                                style={[
                                    styles.sliderTick,
                                    mark <= value && styles.sliderTickActive,
                                ]}
                            />
                        ))}
                    </View>
                </View>

                <Slider
                    style={styles.ratingSlider}
                    minimumValue={1}
                    maximumValue={5}
                    step={0.5}
                    value={value}
                    onValueChange={(next) => onChange(snapRating(next))}
                    minimumTrackTintColor="transparent"
                    maximumTrackTintColor="transparent"
                    thumbTintColor={colors.primary}
                />
            </View>

            <View style={styles.ratingScaleRow}>
                <Text style={styles.ratingScaleText}>1</Text>
                <Text style={styles.ratingScaleHint}>glisse pour ajuster</Text>
                <Text style={styles.ratingScaleText}>5</Text>
            </View>
        </View>
    );
}

export default function CreatePostScreen({ route, navigation }: Props) {
    const insets = useSafeAreaInsets();
    const { entityType, entityId, track } = route.params;

    const [mode, setMode] = useState<"general" | "multi">("general");
    const [rating, setRating] = useState(3);
    const [ratings, setRatings] = useState<Record<string, number>>({});
    const [comment, setComment] = useState("");
    const [publishing, setPublishing] = useState(false);

    const { playPreview, togglePlay, isPlaying, currentTrack } = usePlayer();

    const criteria = CRITERIA_BY_TYPE[entityType];

    /* -------------------- ENSURE DEFAULT MULTI RATINGS -------------------- */
    useEffect(() => {
        if (mode !== "multi") return;

        setRatings((prev) => {
            const next = { ...prev };
            for (const c of criteria) {
                if (typeof next[c.key] !== "number") next[c.key] = 3;
            }
            return next;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, entityType]);

    const average = useMemo(() => {
        if (mode !== "multi") return null;

        const values = criteria
            .map((c) => ratings[c.key])
            .filter((v) => typeof v === "number") as number[];

        if (values.length !== criteria.length) return null;

        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        return Number(avg.toFixed(1));
    }, [ratings, mode, criteria]);

    const isCurrentTrack =
        !!currentTrack &&
        currentTrack.title === track.title &&
        currentTrack.artist === track.artist &&
        currentTrack.url === (track.previewUrl || "");

    const handlePublish = async () => {
        if (publishing) return;

        const token = await getStoredToken();
        if (!token) {
            Alert.alert("Erreur", "Tu n'es pas connecté.");
            return;
        }

        setPublishing(true);

        try {
            const payload: any = {
                entityType,
                entityId,

                trackTitle: track.title,
                artist: track.artist,

                coverUrl: track.cover || null,

                previewUrl: track.previewUrl || null,

                mode,
                comment: comment.trim(),
            };

            if (mode === "general") {
                payload.rating = rating;
            } else {
                const finalRatings: Record<string, number> = {};
                for (const c of criteria) {
                    finalRatings[c.key] =
                        typeof ratings[c.key] === "number" ? ratings[c.key] : 3;
                }
                payload.ratings = finalRatings;
            }

            const res = await fetch(`${API_URL}/api/posts/create`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const txt = await res.text().catch(() => "");
                console.log("Create post error:", res.status, txt);
                Alert.alert("Erreur", "Impossible de publier le post.");
                return;
            }

            navigation.replace("Main");
        } catch (e) {
            console.log("Publish error:", e);
            Alert.alert("Erreur", "Impossible de publier le post.");
        } finally {
            setPublishing(false);
        }
    };

    return (
        <AppScreen>
            <KeyboardAvoidingView
                style={styles.keyboardWrap}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                    contentContainerStyle={[
                        styles.content,
                        {
                            paddingTop: insets.top + 10,
                            paddingBottom: Math.max(insets.bottom, 12) + 96,
                        },
                    ]}
                >
                    <View style={styles.topBar}>
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="arrow-back" size={22} color={colors.text} />
                    </TouchableOpacity>

                    <View style={styles.topTitleWrap}>
                        <Text style={styles.eyebrow}>Création</Text>
                        <Text style={styles.title}>Nouveau post</Text>
                    </View>

                    <View style={styles.iconButtonGhost} />
                </View>

                <View style={styles.trackCard}>
                    {track.cover ? (
                        <Image source={{ uri: track.cover }} style={styles.cover} />
                    ) : (
                        <View style={[styles.cover, styles.coverFallback]}>
                            <Ionicons name="musical-notes" size={22} color={colors.textMuted} />
                        </View>
                    )}

                    <View style={styles.trackMeta}>
                        <View style={styles.typePill}>
                            <Ionicons
                                name={
                                    entityType === "album"
                                        ? "disc-outline"
                                        : entityType === "artist"
                                            ? "person-outline"
                                            : "musical-notes-outline"
                                }
                                size={12}
                                color={colors.primary}
                            />
                            <Text style={styles.typePillText}>
                                {entityType === "album" ? "Album" : entityType === "artist" ? "Artiste" : "Son"}
                            </Text>
                        </View>

                        <Text style={styles.trackTitle} numberOfLines={2}>
                            {track.title}
                        </Text>
                        <Text style={styles.trackArtist} numberOfLines={1}>
                            {track.artist}
                        </Text>

                        {entityType === "song" && track.previewUrl ? (
                            <TouchableOpacity
                                style={styles.previewRow}
                                onPress={() => {
                                    if (isCurrentTrack) {
                                        togglePlay();
                                    } else {
                                        playPreview({
                                            title: track.title,
                                            artist: track.artist,
                                            cover: track.cover || "",
                                            coverUrl: track.cover || "",
                                            url: track.previewUrl!,
                                        });
                                    }
                                }}
                                activeOpacity={0.85}
                            >
                                <Ionicons
                                    name={isCurrentTrack && isPlaying ? "pause-circle" : "play-circle"}
                                    size={21}
                                    color={isCurrentTrack && isPlaying ? colors.primary : colors.text}
                                />
                                <Text style={styles.previewText}>
                                    {isCurrentTrack && isPlaying ? "Lecture en cours" : "Écouter l'extrait"}
                                </Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>

                <View style={styles.modeCard}>
                    <TouchableOpacity
                        style={[styles.modeButton, mode === "general" && styles.modeButtonActive]}
                        onPress={() => setMode("general")}
                        activeOpacity={0.86}
                    >
                        <Ionicons
                            name="star-outline"
                            size={16}
                            color={mode === "general" ? colors.bg : colors.textMuted}
                        />
                        <Text style={[styles.modeText, mode === "general" && styles.modeTextActive]}>
                            Simple
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.modeButton, mode === "multi" && styles.modeButtonActive]}
                        onPress={() => setMode("multi")}
                        activeOpacity={0.86}
                    >
                        <Ionicons
                            name="stats-chart-outline"
                            size={16}
                            color={mode === "multi" ? colors.bg : colors.textMuted}
                        />
                        <Text style={[styles.modeText, mode === "multi" && styles.modeTextActive]}>
                            Multi-critères
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.ratingCard}>
                    <View style={styles.ratingHeader}>
                        <View>
                            <Text style={styles.eyebrow}>Notation</Text>
                            <Text style={styles.sectionTitle}>
                                {mode === "general" ? "Note générale" : "Note détaillée"}
                            </Text>
                        </View>

                        <View style={styles.averagePill}>
                            <Text style={styles.averageValue}>
                                {formatRating(mode === "general" ? rating : average ?? 3)}
                            </Text>
                            <Text style={styles.averageOutOf}>/5</Text>
                        </View>
                    </View>

                    {mode === "general" ? (
                        <View style={styles.singleRatingWrap}>
                            <RatingSlider
                                label="Note"
                                value={rating}
                                onChange={setRating}
                                featured
                            />
                        </View>
                    ) : (
                        <View style={styles.multiRatingList}>
                            {criteria.map((c) => (
                                <RatingSlider
                                    key={c.key}
                                    label={c.label}
                                    value={ratings[c.key] ?? 3}
                                    onChange={(v) => setRatings((r) => ({ ...r, [c.key]: v }))}
                                />
                            ))}
                        </View>
                    )}
                </View>

                <View style={styles.commentCard}>
                    <View style={styles.commentHeader}>
                        <View>
                            <Text style={styles.eyebrow}>Avis</Text>
                            <Text style={styles.optionalHint}>Optionnel</Text>
                        </View>
                        <Text style={styles.commentCount}>{comment.trim().length}/280</Text>
                    </View>

                    <TextInput
                        style={styles.input}
                        placeholder="Ajoute un avis si tu veux..."
                        placeholderTextColor={colors.textFaint}
                        multiline
                        maxLength={280}
                        value={comment}
                        onChangeText={setComment}
                        textAlignVertical="top"
                    />
                </View>

                    <AppButton
                        label={publishing ? "Publication..." : "Publier"}
                        onPress={handlePublish}
                        disabled={publishing}
                        style={styles.publishBtn}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    keyboardWrap: {
        flex: 1,
    },

    content: {
        paddingBottom: 120,
    },

    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.lg,
    },

    iconButton: {
        width: 42,
        height: 42,
        borderRadius: radius.lg,
        backgroundColor: colors.surface3,
        alignItems: "center",
        justifyContent: "center",
    },

    iconButtonGhost: {
        width: 42,
        height: 42,
    },

    topTitleWrap: {
        alignItems: "center",
    },

    eyebrow: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        letterSpacing: 1,
        textTransform: "uppercase",
    },

    title: {
        color: colors.text,
        fontSize: 22,
        lineHeight: 27,
        fontWeight: fontWeights.black,
        marginTop: 2,
    },

    trackCard: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(15, 18, 24, 0.72)",
        padding: spacing.md,
        borderRadius: radius.xxl,
        marginBottom: spacing.md,
    },

    cover: {
        width: 84,
        height: 84,
        borderRadius: radius.lg,
        marginRight: spacing.md,
        backgroundColor: colors.surface4,
    },

    coverFallback: {
        alignItems: "center",
        justifyContent: "center",
    },

    trackMeta: {
        flex: 1,
        minWidth: 0,
    },

    typePill: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: radius.pill,
        backgroundColor: colors.primaryFaint,
        marginBottom: 8,
    },

    typePillText: {
        color: colors.primary,
        fontSize: 11,
        fontWeight: fontWeights.black,
        letterSpacing: 0.8,
        textTransform: "uppercase",
    },

    trackTitle: {
        color: colors.text,
        fontSize: 19,
        lineHeight: 23,
        fontWeight: fontWeights.black,
    },

    trackArtist: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.medium,
        marginTop: 4,
    },

    previewRow: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        marginTop: spacing.sm,
        gap: spacing.xs,
        backgroundColor: colors.surface3,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: 7,
    },

    previewText: {
        color: colors.textSoft,
        fontSize: typography.caption,
        fontWeight: fontWeights.extraBold,
    },

    modeCard: {
        width: "100%",
        flexDirection: "row",
        backgroundColor: "rgba(15, 18, 24, 0.72)",
        borderRadius: radius.xxl,
        marginBottom: spacing.md,
        padding: 4,
        gap: 4,
    },

    modeButton: {
        flex: 1,
        minHeight: 42,
        borderRadius: radius.lg,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
    },

    modeButtonActive: {
        backgroundColor: colors.primary,
    },

    modeText: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.extraBold,
    },

    modeTextActive: {
        color: colors.bg,
        fontWeight: fontWeights.black,
    },

    ratingCard: {
        width: "100%",
        backgroundColor: "rgba(15, 18, 24, 0.72)",
        borderRadius: radius.xxl,
        padding: spacing.md,
        marginBottom: spacing.md,
    },

    ratingHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
        marginBottom: spacing.lg,
    },

    sectionTitle: {
        color: colors.text,
        fontSize: 18,
        lineHeight: 22,
        fontWeight: fontWeights.black,
        marginTop: 3,
    },

    averagePill: {
        flexDirection: "row",
        alignItems: "baseline",
        backgroundColor: colors.surfacePressed,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
    },

    averageValue: {
        color: colors.text,
        fontSize: 18,
        lineHeight: 20,
        fontWeight: fontWeights.black,
    },

    averageOutOf: {
        color: colors.primary,
        fontSize: typography.caption,
        fontWeight: fontWeights.extraBold,
        marginLeft: 2,
    },

    singleRatingWrap: {
        paddingVertical: spacing.xs,
    },

    multiRatingList: {
        gap: spacing.md,
    },

    ratingControl: {
        width: "100%",
        backgroundColor: "rgba(20, 24, 33, 0.72)",
        borderRadius: radius.xl,
        padding: spacing.md,
    },

    ratingControlFeatured: {
        backgroundColor: "rgba(20, 24, 33, 0.86)",
    },

    ratingControlHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
        marginBottom: spacing.md,
    },

    ratingControlLabel: {
        flex: 1,
        color: colors.text,
        fontSize: typography.body,
        fontWeight: fontWeights.black,
    },

    scorePill: {
        flexDirection: "row",
        alignItems: "baseline",
        backgroundColor: colors.surfacePressed,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
    },

    scoreValue: {
        color: colors.text,
        fontSize: 16,
        lineHeight: 18,
        fontWeight: fontWeights.black,
    },

    scoreOutOf: {
        color: colors.primary,
        fontSize: 11,
        fontWeight: fontWeights.extraBold,
        marginLeft: 2,
    },

    sliderVisualWrap: {
        position: "relative",
        height: 44,
        justifyContent: "center",
        marginHorizontal: -8,
    },

    sliderTrackBackdrop: {
        position: "absolute",
        left: 16,
        right: 16,
        height: 12,
        borderRadius: radius.pill,
        backgroundColor: colors.surface4,
        overflow: "hidden",
    },

    sliderTrackFill: {
        height: "100%",
        backgroundColor: colors.primary,
        borderRadius: radius.pill,
    },

    sliderTicks: {
        ...StyleSheet.absoluteFillObject,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 4,
    },

    sliderTick: {
        width: 2,
        height: 6,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.16)",
    },

    sliderTickActive: {
        backgroundColor: "rgba(255,255,255,0.58)",
    },

    ratingSlider: {
        width: "100%",
        height: 44,
    },

    ratingScaleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 8,
        marginTop: spacing.xs,
    },

    ratingScaleText: {
        color: colors.textFaint,
        fontSize: 11,
        fontWeight: fontWeights.extraBold,
    },

    ratingScaleHint: {
        color: colors.textFaint,
        fontSize: typography.caption,
        fontWeight: fontWeights.bold,
    },

    commentCard: {
        width: "100%",
        backgroundColor: "rgba(15, 18, 24, 0.72)",
        borderRadius: radius.xxl,
        padding: spacing.md,
        marginBottom: spacing.md,
    },

    commentHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: spacing.sm,
    },

    optionalHint: {
        color: colors.textFaint,
        fontSize: typography.caption,
        fontWeight: fontWeights.bold,
        marginTop: 3,
    },

    commentCount: {
        color: colors.textMuted,
        fontSize: typography.caption,
        fontWeight: fontWeights.bold,
    },

    input: {
        minHeight: 118,
        color: colors.text,
        backgroundColor: "rgba(8, 10, 14, 0.7)",
        borderRadius: radius.xl,
        padding: spacing.md,
        fontSize: typography.body,
        lineHeight: 21,
        fontWeight: fontWeights.medium,
    },

    publishBtn: {
        marginTop: spacing.xs,
    },
});
