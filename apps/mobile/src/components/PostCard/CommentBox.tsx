import React from "react";
import { View, Text, StyleSheet } from "react-native";

type Props = {
    text: string;
};

export default function CommentBox({ text }: Props) {
    if (!text || text.trim().length === 0) return null;

    return (
        <View style={styles.container}>
            <Text style={styles.comment}>{text.trim()}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 14,
    },
    comment: {
        color: "#ddd",
        fontSize: 14,
        lineHeight: 19,
    },
});