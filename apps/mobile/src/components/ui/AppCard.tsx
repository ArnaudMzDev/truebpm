import React from "react";
import { View, StyleSheet, ViewProps } from "react-native";
import { colors, radius, spacing, shadows } from "../../theme";

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
        width: "100%",
        backgroundColor: "rgba(15, 18, 24, 0.72)",
        borderRadius: radius.xxl,
    },

    padded: {
        padding: spacing.lg,
    },

    elevated: {
        ...shadows.card,
    },
});
