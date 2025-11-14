import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";
import Logo from "./Logo";

export default function LoaderLogo({ size = 48 }) {
    const scale = useRef(new Animated.Value(1)).current;
    const glow = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(scale, {
                        toValue: 1.15,
                        duration: 900,
                        useNativeDriver: false, // 🔧 FIX 1
                    }),
                    Animated.timing(scale, {
                        toValue: 1,
                        duration: 900,
                        useNativeDriver: false, // 🔧 FIX 1
                    }),
                ]),
                Animated.sequence([
                    Animated.timing(glow, {
                        toValue: 1,
                        duration: 900,
                        useNativeDriver: false, // 🔧 FIX 2
                    }),
                    Animated.timing(glow, {
                        toValue: 0,
                        duration: 900,
                        useNativeDriver: false, // 🔧 FIX 2
                    }),
                ]),
            ])
        ).start();
    }, []);

    const shadow = glow.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 15],
    });

    return (
        <Animated.View
            style={{
                transform: [{ scale }],
                shadowColor: "#9B5CFF",
                shadowOpacity: 0.5,
                shadowRadius: shadow,
                shadowOffset: { width: 0, height: 0 },
            }}
        >
            <Logo size={size} />
        </Animated.View>
    );
}