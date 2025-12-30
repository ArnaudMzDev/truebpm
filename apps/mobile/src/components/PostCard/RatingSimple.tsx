import React from "react";
import { View, Text, StyleSheet } from "react-native";

type Props = {
    rating: number | null;
};

export default function RatingSimple({ rating }: Props) {
    if (rating === null) return null;

    return (
        <View style={styles.container}>
            <Text style={styles.label}>Note :</Text>
            <Text style={styles.value}>{rating.toFixed(1)} / 5</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 10,
    },
    label: {
        color: "#ccc",
        fontSize: 14,
        marginRight: 6,
    },
    value: {
        color: "#9B5CFF",
        fontSize: 15,
        fontWeight: "700",
    },
});