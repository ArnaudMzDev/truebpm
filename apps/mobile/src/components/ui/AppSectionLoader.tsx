import React from "react";
import { View, StyleSheet } from "react-native";
import LoaderLogo from "../LoaderLogo";
import { colors, radius } from "../../theme";

type Props = {
    compact?: boolean;
};

export default function AppSectionLoader({ compact = false }: Props) {
    return (
        <View style={[styles.container, compact && styles.containerCompact]}>
            <LoaderLogo size={compact ? 22 : 28} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 20,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.lg,
    },

    containerCompact: {
        paddingVertical: 12,
    },
});