import React from "react";
import { View, Text, StyleSheet } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";

export default function Logo({ size = 48 }: { size?: number }) {
    return (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
            {/* True en blanc */}
            <Text style={[styles.logoText, { fontSize: size, color: "white" }]}>
                True
            </Text>

            {/* BPM en dégradé — SINGLE INSTANCE */}
            <MaskedView
                maskElement={
                    <Text style={[styles.logoText, { fontSize: size }]}>BPM</Text>
                }
            >
                <LinearGradient
                    colors={["#9B5CFF", "#5E17EB"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ paddingHorizontal: 4 }}
                >
                    {/* Ce texte invisible sert juste de surface pour le masque */}
                    <Text
                        style={[
                            styles.logoText,
                            { fontSize: size, opacity: 0 },
                        ]}
                    >
                        BPM
                    </Text>
                </LinearGradient>
            </MaskedView>
        </View>
    );
}

const styles = StyleSheet.create({
    logoText: {
        fontWeight: "800",
        letterSpacing: 1,
    },
});