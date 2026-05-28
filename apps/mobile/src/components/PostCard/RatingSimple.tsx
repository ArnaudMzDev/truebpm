import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, radius, typography, fontWeights } from "../../theme";

type Props = {
    rating: number | null;
};

function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
}

function buildBarsFromRating(rating: number) {
    const normalized = clamp(rating, 1, 5) / 5;

    const rawHeights = [
        0.34 + normalized * 0.38,
        0.5 + normalized * 0.28,
        0.26 + normalized * 0.56,
        0.44 + normalized * 0.32,
        0.3 + normalized * 0.46,
    ];

    return rawHeights.map((v) => clamp(v, 0.18, 1));
}

function RatingSimple({ rating }: Props) {
    const safeRating = typeof rating === "number" ? rating : null;

    const bars = useMemo(() => {
        if (safeRating === null) return [];
        return buildBarsFromRating(safeRating);
    }, [safeRating]);

    if (safeRating === null) return null;

    return (
        <View style={styles.summary}>
            <View style={styles.summaryLeft}>
                <Text style={styles.eyebrow}>Note générale</Text>
                <View style={styles.scoreLine}>
                    <Text style={styles.avgScore}>{Number(safeRating.toFixed(1)).toString()}</Text>
                    <Text style={styles.avgOutOf}>/5</Text>
                </View>
            </View>

            <View style={styles.summaryRight}>
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

                <Text style={styles.summaryHint}>Score public</Text>
            </View>
        </View>
    );
}

export default React.memo(RatingSimple);

const styles = StyleSheet.create({
    summary: {
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
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
        gap: spacing.lg,
    },

    summaryLeft: {
        flex: 1,
        minWidth: 0,
    },

    eyebrow: {
        color: colors.primary,
        fontSize: typography.caption,
        fontWeight: fontWeights.extraBold,
        marginBottom: 2,
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
        gap: spacing.md,
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
