import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius, typography, fontWeights } from "../../theme";

type Props = {
    title: string;
    subtitle?: string;
    onBack?: () => void;
    right?: React.ReactNode;
};

export default function AppTopBar({ title, subtitle, onBack, right }: Props) {
    const insets = useSafeAreaInsets();

    return (
        <View
            style={[
                styles.wrap,
                {
                    paddingTop: Math.max(insets.top, 10),
                },
            ]}
        >
            <View style={styles.row}>
                <View style={styles.side}>
                    {onBack ? (
                        <TouchableOpacity style={styles.iconBtn} onPress={onBack} activeOpacity={0.85}>
                            <Ionicons name="chevron-back" size={20} color={colors.text} />
                        </TouchableOpacity>
                    ) : null}
                </View>

                <View style={styles.center}>
                    {subtitle ? <Text style={styles.eyebrow}>{subtitle}</Text> : null}
                    <Text style={styles.title} numberOfLines={1}>
                        {title}
                    </Text>
                </View>

                <View style={[styles.side, styles.sideRight]}>{right}</View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        paddingBottom: spacing.md,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        minHeight: 48,
    },
    side: {
        width: 44,
        alignItems: "flex-start",
        justifyContent: "center",
    },
    sideRight: {
        alignItems: "flex-end",
    },
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.sm,
    },
    iconBtn: {
        width: 40,
        height: 40,
        borderRadius: radius.lg,
        backgroundColor: colors.surface3,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },
    eyebrow: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        letterSpacing: 1,
        textTransform: "uppercase",
        marginBottom: 2,
    },
    title: {
        color: colors.text,
        fontSize: 16,
        fontWeight: fontWeights.black,
    },
});