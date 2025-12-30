// apps/mobile/src/components/PostMultiRating.tsx
import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type PostMultiRatingProps = {
    prod: number | null;
    lyrics: number | null;
    emotion: number | null;
};

const PostMultiRating: React.FC<PostMultiRatingProps> = ({
                                                             prod,
                                                             lyrics,
                                                             emotion,
                                                         }) => {
    const [expanded, setExpanded] = useState(false);

    if (
        prod == null ||
        lyrics == null ||
        emotion == null ||
        prod <= 0 ||
        lyrics <= 0 ||
        emotion <= 0
    ) {
        // Pas de multi-note dispo, on n'affiche rien
        return null;
    }

    const average = ((prod + lyrics + emotion) / 3).toFixed(1);

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={styles.header}
                onPress={() => setExpanded((prev) => !prev)}
                activeOpacity={0.8}
            >
                <View style={styles.headerLeft}>
                    <Text style={styles.label}>Note multi</Text>
                    <Text style={styles.value}>{average} / 5</Text>
                    <Ionicons name="star" size={14} color="#FFD35C" style={{ marginLeft: 4 }} />
                </View>
                <Ionicons
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#fff"
                />
            </TouchableOpacity>

            {expanded && (
                <View style={styles.details}>
                    <View style={styles.row}>
                        <Text style={styles.detailLabel}>Production</Text>
                        <Text style={styles.detailValue}>{prod}/5</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.detailLabel}>Paroles</Text>
                        <Text style={styles.detailValue}>{lyrics}/5</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.detailLabel}>Émotion</Text>
                        <Text style={styles.detailValue}>{emotion}/5</Text>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#111",
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginTop: 8,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
    },
    label: {
        color: "#aaa",
        fontSize: 13,
        marginRight: 6,
    },
    value: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
    },
    details: {
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: "#222",
        paddingTop: 8,
        gap: 4,
    },
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    detailLabel: {
        color: "#ccc",
        fontSize: 13,
    },
    detailValue: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "600",
    },
});

export default PostMultiRating;