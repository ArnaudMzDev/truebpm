import React from "react";
import { View, StyleSheet, ViewProps } from "react-native";
import { colors, radius, spacing } from "../../theme";

type Props = ViewProps & {
    padded?: boolean;
    elevated?: boolean;
};

export default function AppCard({
                                    children,
                                    style,
                                    padded = true,
                                    elevated = false,
                                    ...rest
                                }: Props) {
    return (
        <View
            style={[
                styles.card,
                padded && styles.padded,
                elevated && styles.elevated,
                style,
            ]}
            {...rest}
        >
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface2,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.xl,
    },

    padded: {
        padding: spacing.lg,
    },

    elevated: {
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
    },
});