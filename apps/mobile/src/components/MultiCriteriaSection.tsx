// apps/mobile/src/components/MultiCriteriaSection.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Slider from "@react-native-community/slider";

type MultiCriteriaSectionProps = {
    prod: number;
    lyrics: number;
    emotion: number;
    onChangeProd: (value: number) => void;
    onChangeLyrics: (value: number) => void;
    onChangeEmotion: (value: number) => void;
};

export const MultiCriteriaSection: React.FC<MultiCriteriaSectionProps> = ({
                                                                              prod,
                                                                              lyrics,
                                                                              emotion,
                                                                              onChangeProd,
                                                                              onChangeLyrics,
                                                                              onChangeEmotion,
                                                                          }) => {
    return (
        <View style={styles.container}>
            <View style={styles.row}>
                <Text style={styles.label}>Production</Text>
                <Text style={styles.value}>{prod}/5</Text>
            </View>
            <Slider
                minimumValue={1}
                maximumValue={5}
                step={1}
                value={prod}
                onValueChange={onChangeProd}
                minimumTrackTintColor="#9B5CFF"
                maximumTrackTintColor="#444"
                thumbTintColor="#9B5CFF"
            />

            <View style={styles.row}>
                <Text style={styles.label}>Paroles</Text>
                <Text style={styles.value}>{lyrics}/5</Text>
            </View>
            <Slider
                minimumValue={1}
                maximumValue={5}
                step={1}
                value={lyrics}
                onValueChange={onChangeLyrics}
                minimumTrackTintColor="#9B5CFF"
                maximumTrackTintColor="#444"
                thumbTintColor="#9B5CFF"
            />

            <View style={styles.row}>
                <Text style={styles.label}>Émotion</Text>
                <Text style={styles.value}>{emotion}/5</Text>
            </View>
            <Slider
                minimumValue={1}
                maximumValue={5}
                step={1}
                value={emotion}
                onValueChange={onChangeEmotion}
                minimumTrackTintColor="#9B5CFF"
                maximumTrackTintColor="#444"
                thumbTintColor="#9B5CFF"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#111",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 10,
    },
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 4,
    },
    label: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
    },
    value: {
        color: "#ccc",
        fontSize: 13,
        fontWeight: "500",
    },
});

export default MultiCriteriaSection;