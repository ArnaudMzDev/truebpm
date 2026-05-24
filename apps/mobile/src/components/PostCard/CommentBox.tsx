import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, radius, typography, fontWeights } from "../../theme";

type Props = {
    text: string;
};

export default function CommentBox({ text }: Props) {
    if (!text || text.trim().length === 0) return null;

    return (
        <View style={styles.container}>
            <Text style={styles.eyebrow}>AVIS</Text>
            <Text style={styles.comment}>{text.trim()}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: spacing.sm,
        marginBottom: spacing.sm,
        backgroundColor: colors.surface3,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.xl,
        padding: spacing.md,
    },

    eyebrow: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        letterSpacing: 1,
        marginBottom: 8,
    },

    comment: {
        color: colors.textSoft,
        fontSize: 14,
        lineHeight: 21,
    },
});