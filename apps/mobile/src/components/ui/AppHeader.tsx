import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, typography, fontWeights } from "../../theme";

type Props = {
    title: string;
    subtitle?: string;
    right?: React.ReactNode;
    style?: ViewStyle;
    compact?: boolean;
};

export default function AppHeader({
                                      title,
                                      subtitle,
                                      right,
                                      style,
                                      compact = false,
                                  }: Props) {
    const insets = useSafeAreaInsets();

    return (
        <View
            style={[
                styles.container,
                compact ? styles.containerCompact : styles.containerDefault,
                {
                    paddingTop: Math.max(insets.top, 10),
                },
                style,
            ]}
        >
            <View style={styles.left}>
                <Text style={styles.title} numberOfLines={1}>
                    {title}
                </Text>

                {subtitle ? (
                    <Text style={styles.subtitle} numberOfLines={2}>
                        {subtitle}
                    </Text>
                ) : null}
            </View>

            {right ? <View style={styles.right}>{right}</View> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    containerDefault: {
        minHeight: 84,
        paddingBottom: spacing.md,
    },

    containerCompact: {
        minHeight: 68,
        paddingBottom: spacing.sm,
    },

    left: {
        flex: 1,
        paddingRight: spacing.md,
    },

    right: {
        marginLeft: spacing.md,
        justifyContent: "center",
        alignItems: "center",
    },

    title: {
        color: colors.text,
        fontSize: typography.title,
        fontWeight: fontWeights.black,
        lineHeight: 28,
        letterSpacing: -0.3,
    },

    subtitle: {
        color: colors.textMuted,
        marginTop: 5,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.medium,
        lineHeight: 18,
    },
});