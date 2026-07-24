import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, fontWeights } from "../theme";

type AvatarProps = {
    size?: number;
    label?: string | null;
    seed?: string | null;
    style?: StyleProp<ViewStyle>;
};

const AVATAR_PALETTE = [
    { bg: "#151020", accent: "#9B5CFF", text: "#F7F4FF" },
    { bg: "#101820", accent: "#52D6FF", text: "#F4FBFF" },
    { bg: "#1D1418", accent: "#FF5C8A", text: "#FFF5F8" },
    { bg: "#111B16", accent: "#67E8A7", text: "#F3FFF8" },
    { bg: "#1D1710", accent: "#FFD166", text: "#FFF9EA" },
    { bg: "#15151F", accent: "#A6A8FF", text: "#F6F6FF" },
];

function hashString(value: string) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function getInitials(value?: string | null) {
    const cleaned = (value || "").trim().replace(/^@+/, "");
    if (!cleaned) return "TB";

    const words = cleaned
        .split(/[\s._-]+/)
        .map((word) => word.trim())
        .filter(Boolean);

    if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
    return cleaned.slice(0, 2).toUpperCase();
}

export function DefaultAvatar({ size = 44, label, seed, style }: AvatarProps) {
    const identity = (seed || label || "TrueBPM").trim();
    const palette = AVATAR_PALETTE[hashString(identity) % AVATAR_PALETTE.length];
    const fontSize = size >= 96 ? 30 : size >= 64 ? 20 : size >= 40 ? 13 : 10;

    return (
        <View
            style={[
                styles.avatar,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: palette.bg,
                    borderColor: palette.accent,
                },
                style,
            ]}
        >
            <View
                style={[
                    styles.avatarAccent,
                    {
                        backgroundColor: palette.accent,
                        width: size * 0.82,
                        height: size * 0.82,
                        borderRadius: size / 2,
                    },
                ]}
            />
            <Text style={[styles.avatarText, { color: palette.text, fontSize }]}>
                {getInitials(label || seed)}
            </Text>
        </View>
    );
}

export function DefaultBanner({ style }: { style?: StyleProp<ViewStyle> }) {
    return <View style={[styles.banner, style]} />;
}

const styles = StyleSheet.create({
    avatar: {
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        overflow: "hidden",
    },
    avatarAccent: {
        position: "absolute",
        right: "-36%",
        bottom: "-44%",
        opacity: 0.3,
    },
    avatarText: {
        fontWeight: fontWeights.black,
        letterSpacing: 0,
    },
    banner: {
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surfaceFeed,
        overflow: "hidden",
    },
});
