import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, ViewStyle } from "react-native";
import { colors } from "../theme";

type PlayerWaveProps = {
    active: boolean;
    size?: "sm" | "md" | "lg";
    color?: string;
    inactiveColor?: string;
    style?: ViewStyle;
};

const START_VALUES = [0.48, 0.72, 0.56];

export default function PlayerWave({
    active,
    size = "md",
    color = colors.primary,
    inactiveColor = colors.textFaint,
    style,
}: PlayerWaveProps) {
    const scales = useRef(START_VALUES.map((value) => new Animated.Value(value))).current;
    const metrics = size === "sm" ? smallMetrics : size === "lg" ? largeMetrics : mediumMetrics;

    useEffect(() => {
        if (!active) {
            scales.forEach((value, index) => value.setValue(START_VALUES[index]));
            return;
        }

        const animations = scales.map((value, index) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(index * 90),
                    Animated.timing(value, {
                        toValue: index === 1 ? 0.48 : 1,
                        duration: 320,
                        useNativeDriver: true,
                    }),
                    Animated.timing(value, {
                        toValue: index === 1 ? 1 : 0.5,
                        duration: 360,
                        useNativeDriver: true,
                    }),
                ])
            )
        );

        animations.forEach((animation) => animation.start());

        return () => {
            animations.forEach((animation) => animation.stop());
        };
    }, [active, scales]);

    return (
        <View style={[styles.wrap, metrics.wrap, style]}>
            {scales.map((scale, index) => (
                <Animated.View
                    key={index}
                    style={[
                        styles.bar,
                        metrics.bar,
                        {
                            backgroundColor: active ? color : inactiveColor,
                            opacity: active ? 0.96 : 0.42,
                            transform: [{ scaleY: active ? scale : 0.52 + index * 0.13 }],
                        },
                    ]}
                />
            ))}
        </View>
    );
}

const mediumMetrics = StyleSheet.create({
    wrap: {
        width: 24,
        height: 22,
    },
    bar: {
        width: 4,
        height: 18,
    },
});

const smallMetrics = StyleSheet.create({
    wrap: {
        width: 18,
        height: 16,
    },
    bar: {
        width: 3,
        height: 14,
    },
});

const largeMetrics = StyleSheet.create({
    wrap: {
        width: 58,
        height: 52,
    },
    bar: {
        width: 10,
        height: 44,
    },
});

const styles = StyleSheet.create({
    wrap: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    bar: {
        borderRadius: 999,
    },
});
