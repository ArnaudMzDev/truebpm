import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { EntityType } from "./types";
import { colors, spacing, radius, typography, fontWeights } from "../../theme";

type Props = {
    entityType?: EntityType;
    average: number | null;
    ratings?: Record<string, number> | null;
    prod?: number | null;
    lyrics?: number | null;
    emotion?: number | null;
};

function getLabel(entityType: EntityType | undefined, key: string) {
    const type = entityType ?? "song";

    const map: Record<string, Record<string, string>> = {
        song: {
            prod: "Production",
            lyrics: "Paroles",
            emotion: "Émotion",
        },
        album: {
            cohesion: "Cover",
            production: "Production",
            originality: "Originalité",
        },
        artist: {
            identity: "Identité",
            consistency: "Régularité",
            impact: "Impact",
        },
    };

    return map[type]?.[key] ?? key;
}

function format(v: number) {
    return Number(v.toFixed(1)).toString();
}

function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
}

function buildBarsFromRating(rating: number) {
    const normalized = clamp(rating, 1, 5) / 5;

    const rawHeights = [
        0.32 + normalized * 0.42,
        0.48 + normalized * 0.26,
        0.24 + normalized * 0.58,
        0.42 + normalized * 0.3,
        0.28 + normalized * 0.5,
    ];

    return rawHeights.map((v) => clamp(v, 0.18, 1));
}

function MiniEqualizer({ value }: { value: number }) {
    const bars = buildBarsFromRating(value);

    return (
        <View style={styles.miniEq}>
            {bars.map((h, index) => (
                <View key={index} style={styles.miniEqTrack}>
                    <View
                        style={[
                            styles.miniEqFill,
                            {
                                height: `${h * 100}%`,
                                opacity: 0.8 + index * 0.04,
                            },
                        ]}
                    />
                </View>
            ))}
        </View>
    );
}

function RatingMulti({
                         entityType,
                         average,
                         ratings,
                         prod,
                         lyrics,
                         emotion,
                     }: Props) {
    const [open, setOpen] = useState(false);

    const computedRatings = useMemo(() => {
        if (ratings && typeof ratings === "object" && Object.keys(ratings).length > 0) {
            return ratings;
        }

        const legacy: Record<string, number> = {};
        if (typeof prod === "number") legacy.prod = prod;
        if (typeof lyrics === "number") legacy.lyrics = lyrics;
        if (typeof emotion === "number") legacy.emotion = emotion;

        return Object.keys(legacy).length ? legacy : null;
    }, [ratings, prod, lyrics, emotion]);

    const computedAverage = useMemo(() => {
        if (typeof average === "number") return average;
        if (!computedRatings) return null;

        const values = Object.values(computedRatings);
        if (!values.length) return null;

        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        return Number(avg.toFixed(1));
    }, [average, computedRatings]);

    if (!computedRatings && computedAverage === null) return null;

    return (
        <View style={styles.wrap}>
            <TouchableOpacity
                style={[styles.summary, open && styles.summaryOpen]}
                onPress={() => setOpen((v) => !v)}
                activeOpacity={0.85}
            >
                <View style={styles.summaryLeft}>
                    <Text style={styles.eyebrow}>Multi-critères</Text>
                    {computedAverage !== null ? (
                        <View style={styles.scoreLine}>
                            <Text style={styles.avgScore}>{format(computedAverage)}</Text>
                            <Text style={styles.avgOutOf}>/5</Text>
                        </View>
                    ) : null}
                </View>

                <View style={styles.summaryRight}>
                    {computedAverage !== null ? (
                        <MiniEqualizer value={computedAverage} />
                    ) : null}

                    <Text style={styles.summaryHint}>{open ? "Masquer" : "Détail"}</Text>
                    <Ionicons
                        name={open ? "chevron-up" : "chevron-down"}
                        size={17}
                        color={colors.textMuted}
                    />
                </View>
            </TouchableOpacity>

            {open && computedRatings ? (
                <View style={styles.details}>
                    {Object.entries(computedRatings).map(([k, v]) => (
                        <View key={k} style={styles.detailRow}>
                            <View style={styles.detailLeft}>
                                <Text style={styles.detailLabel}>{getLabel(entityType, k)}</Text>
                            </View>

                            <View style={styles.detailRight}>
                                <MiniEqualizer value={Number(v)} />
                                <Text style={styles.detailValue}>{format(Number(v))} / 5</Text>
                            </View>
                        </View>
                    ))}
                </View>
            ) : null}
        </View>
    );
}

export default React.memo(RatingMulti);

const styles = StyleSheet.create({
    wrap: {
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
        width: "100%",
    },

    summary: {
        width: "100%",
        minHeight: 72,
        backgroundColor: colors.surfaceInset,
        borderWidth: 1,
        borderColor: colors.borderSoft,
        borderRadius: radius.xl,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
    },

    summaryOpen: {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderColor: colors.borderStrong,
    },

    eyebrow: {
        color: colors.primary,
        fontSize: typography.caption,
        fontWeight: fontWeights.extraBold,
        marginBottom: 2,
    },

    summaryLeft: {
        flex: 1,
        minWidth: 0,
    },

    scoreLine: {
        flexDirection: "row",
        alignItems: "baseline",
    },

    summaryHint: {
        color: colors.textFaint,
        fontSize: typography.tiny,
        fontWeight: fontWeights.bold,
    },

    summaryRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },

    avgScore: {
        color: colors.text,
        fontSize: 28,
        lineHeight: 31,
        fontWeight: fontWeights.black,
        fontVariant: ["tabular-nums"],
    },

    avgOutOf: {
        color: colors.primary,
        fontSize: 13,
        lineHeight: 15,
        fontWeight: fontWeights.extraBold,
        marginLeft: 3,
    },

    details: {
        marginTop: 0,
        width: "100%",
        backgroundColor: colors.surfaceInset,
        borderWidth: 1,
        borderTopWidth: 0,
        borderColor: colors.borderStrong,
        borderBottomLeftRadius: radius.xl,
        borderBottomRightRadius: radius.xl,
        padding: spacing.md,
    },

    detailRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 8,
    },

    detailLeft: {
        flex: 1,
        paddingRight: spacing.sm,
    },

    detailLabel: {
        color: colors.textSoft,
        fontWeight: fontWeights.bold,
        fontSize: typography.bodySm,
    },

    detailRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },

    detailValue: {
        color: colors.text,
        fontWeight: fontWeights.black,
        fontSize: typography.bodySm,
        minWidth: 56,
        textAlign: "right",
    },

    miniEq: {
        width: 54,
        height: 24,
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
    },

    miniEqTrack: {
        width: 7,
        height: "100%",
        backgroundColor: colors.surfacePressed,
        borderRadius: 999,
        justifyContent: "flex-end",
        overflow: "hidden",
    },

    miniEqFill: {
        width: "100%",
        backgroundColor: colors.primary,
        borderRadius: 999,
    },
});
