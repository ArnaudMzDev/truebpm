import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography, fontWeights } from "../../theme";

type Props = {
    icon?: keyof typeof Ionicons.glyphMap;
    title: string;
    text: string;
    ctaLabel?: string;
    onPress?: () => void;
};

export default function AppEmptyState({
                                          icon = "sparkles-outline",
                                          title,
                                          text,
                                          ctaLabel,
                                          onPress,
                                      }: Props) {
    return (
        <View style={styles.wrap}>
            <View style={styles.iconWrap}>
                <Ionicons name={icon} size={20} color={colors.primary} />
            </View>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.text}>{text}</Text>

            {ctaLabel && onPress ? (
                <TouchableOpacity style={styles.cta} onPress={onPress} activeOpacity={0.85}>
                    <Text style={styles.ctaText}>{ctaLabel}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        marginTop: 44,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.xl,
    },
    iconWrap: {
        width: 46,
        height: 46,
        borderRadius: 23,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#151122",
        borderWidth: 1,
        borderColor: colors.borderAccent,
        marginBottom: 14,
    },
    title: {
        color: colors.text,
        fontSize: typography.subtitle,
        fontWeight: fontWeights.black,
        marginBottom: 6,
        textAlign: "center",
    },
    text: {
        color: colors.textMuted,
        textAlign: "center",
        fontSize: typography.body,
        lineHeight: 20,
    },
    cta: {
        marginTop: 16,
        backgroundColor: colors.primaryDark,
        borderRadius: radius.lg,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    ctaText: {
        color: colors.text,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.extraBold,
    },
});