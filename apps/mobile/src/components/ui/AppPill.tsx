import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius, spacing, typography, fontWeights } from "../../theme";

type Props = {
    label: string;
    color?: string;
};

export default function AppPill({ label, color = colors.primary }: Props) {
    return (
        <View style={[styles.pill, { borderColor: color }]}>
            <Text style={[styles.text, { color }]}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    pill: {
        alignSelf: "flex-start",
        borderWidth: 1,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm + 1,
        paddingVertical: 5,
    },
    text: {
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
    },
});