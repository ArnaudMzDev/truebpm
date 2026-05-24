import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography, fontWeights } from "../../theme";

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

export default function RatingSimple({ rating }: Props) {
    const safeRating = typeof rating === "number" ? rating : null;

    const bars = useMemo(() => {
        if (safeRating === null) return [];
        return buildBarsFromRating(safeRating);
    }, [safeRating]);

    if (safeRating === null) return null;

    return (
        <View style={styles.wrap}>
            <View style={styles.left}>
                <Text style={styles.eyebrow}>NOTE</Text>

                <View style={styles.scoreRow}>
                    <Text style={styles.score}>{safeRating.toFixed(1)}</Text>
                    <Text style={styles.outOf}>/5</Text>
                </View>
            </View>

            <View style={styles.equalizerWrap}>
                {bars.map((h, index) => (
                    <View
                        key={index}
                        style={[
                            styles.bar,
                            {
                                height: `${h * 100}%`,
                                opacity: 0.7 + index * 0.06,
                            },
                        ]}
                    />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
        paddingVertical: 6,
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
    },

    left: {
        flex: 1,
    },

    eyebrow: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        letterSpacing: 1,
        marginBottom: 4,
        textTransform: "uppercase",
    },

    scoreRow: {
        flexDirection: "row",
        alignItems: "flex-end",
    },

    score: {
        color: colors.text,
        fontSize: 32,
        lineHeight: 34,
        fontWeight: fontWeights.black,
    },

    outOf: {
        color: colors.primary,
        fontSize: 17,
        lineHeight: 22,
        fontWeight: fontWeights.extraBold,
        marginLeft: 4,
        marginBottom: 2,
    },

    equalizerWrap: {
        width: 52,
        height: 34,
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        marginLeft: spacing.md,
    },

    bar: {
        width: 6,
        backgroundColor: colors.primary,
        borderRadius: 999,
    },
});