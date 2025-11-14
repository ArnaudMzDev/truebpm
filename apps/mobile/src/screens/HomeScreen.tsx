import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function HomeScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Bienvenue sur TrueBPM 🎧</Text>
            <Text style={styles.subtitle}>
                Ici on construira le vrai home (feed, notes, etc.).
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: "800",
        color: "#fff",
        textAlign: "center",
    },
    subtitle: {
        marginTop: 12,
        fontSize: 14,
        color: "#aaa",
        textAlign: "center",
    },
});