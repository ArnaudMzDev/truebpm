import React from "react";
import { View, Text, StyleSheet } from "react-native";
import LoaderLogo from "../LoaderLogo";
import { colors, typography, fontWeights } from "../../theme";

type Props = {
    label?: string;
};

export default function AppScreenLoader({ label = "Chargement..." }: Props) {
    return (
        <View style={styles.container}>
            <LoaderLogo size={44} />
            <Text style={styles.label}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
    },

    label: {
        color: colors.textMuted,
        fontSize: typography.body,
        fontWeight: fontWeights.medium,
        marginTop: 18,
        textAlign: "center",
    },
});