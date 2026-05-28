import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, radius, typography, fontWeights } from "../../theme";

type Props = {
    text: string;
};

function CommentBox({ text }: Props) {
    if (!text || text.trim().length === 0) return null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.dot} />
                <Text style={styles.eyebrow}>Avis</Text>
            </View>
            <Text style={styles.comment}>{text.trim()}</Text>
        </View>
    );
}

export default React.memo(CommentBox);

const styles = StyleSheet.create({
    container: {
        marginTop: spacing.sm,
        marginBottom: 0,
        width: "100%",
        backgroundColor: "rgba(10, 13, 19, 0.72)",
        borderWidth: 1,
        borderColor: colors.borderSoft,
        borderRadius: radius.xl,
        padding: spacing.md,
    },

    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        marginBottom: 9,
    },

    dot: {
        width: 6,
        height: 6,
        borderRadius: radius.pill,
        backgroundColor: colors.primary,
    },

    eyebrow: {
        color: colors.primary,
        fontSize: typography.caption,
        fontWeight: fontWeights.extraBold,
    },

    comment: {
        color: colors.textSoft,
        fontSize: 15,
        lineHeight: 22,
        fontWeight: fontWeights.medium,
    },
});
