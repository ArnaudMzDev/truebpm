import React, { memo, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { colors, fontWeights, radius, spacing, typography } from "../../theme";

type Props = {
    startsAt: string;
    endsAt: string;
    onStarted: () => void;
    onExpired: () => void;
};

function BlindTestClock({ startsAt, endsAt, onStarted, onExpired }: Props) {
    const [now, setNow] = useState(Date.now());
    const progress = useRef(new Animated.Value(1)).current;
    const startedRef = useRef(false);
    const expiredRef = useRef(false);

    useEffect(() => {
        startedRef.current = false;
        expiredRef.current = false;
        setNow(Date.now());
        progress.setValue(1);
    }, [endsAt, progress, startsAt]);

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 200);
        return () => clearInterval(interval);
    }, []);

    const startMs = new Date(startsAt).getTime();
    const endMs = new Date(endsAt).getTime();
    const durationMs = Math.max(1, endMs - startMs);
    const remainingMs = Math.max(0, endMs - now);
    const isCountdown = now < startMs;
    const remainingRatio = Math.max(0, Math.min(1, remainingMs / durationMs));

    useEffect(() => {
        Animated.timing(progress, {
            toValue: remainingRatio,
            duration: 180,
            useNativeDriver: true,
        }).start();
    }, [progress, remainingRatio]);

    useEffect(() => {
        if (!isCountdown && !startedRef.current) {
            startedRef.current = true;
            onStarted();
        }
        if (remainingMs <= 0 && !expiredRef.current) {
            expiredRef.current = true;
            onExpired();
        }
    }, [isCountdown, onExpired, onStarted, remainingMs]);

    const label = isCountdown
        ? String(Math.max(1, Math.ceil((startMs - now) / 1000)))
        : String(Math.ceil(remainingMs / 1000));

    return (
        <View style={styles.wrap} accessibilityLiveRegion="polite">
            <View style={styles.topRow}>
                <Text style={styles.label}>{isCountdown ? "Prêt ?" : "Temps restant"}</Text>
                <Text style={[styles.time, remainingMs < 5000 && !isCountdown && styles.timeUrgent]}>
                    {isCountdown ? label : `${label}s`}
                </Text>
            </View>
            <View style={styles.track}>
                <Animated.View style={[styles.fill, { transform: [{ scaleX: progress }] }]} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        gap: spacing.sm,
    },
    topRow: {
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "space-between",
    },
    label: {
        color: colors.textMuted,
        fontSize: typography.caption,
        fontWeight: fontWeights.bold,
    },
    time: {
        color: colors.text,
        fontSize: typography.subtitle,
        fontWeight: fontWeights.black,
        fontVariant: ["tabular-nums"],
    },
    timeUrgent: {
        color: colors.danger,
    },
    track: {
        height: 5,
        overflow: "hidden",
        borderRadius: radius.pill,
        backgroundColor: colors.surface4,
    },
    fill: {
        width: "100%",
        height: "100%",
        borderRadius: radius.pill,
        backgroundColor: colors.primary,
        transformOrigin: "left",
    },
});

export default memo(BlindTestClock);
