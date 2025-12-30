import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { EntityType } from "./types";

type Props = {
    entityType?: EntityType;
    average: number | null;
    ratings?: Record<string, number> | null;

    // legacy fallback
    prod?: number | null;
    lyrics?: number | null;
    emotion?: number | null;
};

function getLabel(entityType: EntityType | undefined, key: string) {
    const type = entityType ?? "song";

    const map: Record<string, Record<string, string>> = {
        song: {
            prod: "Production",
            lyrics: "Paroles",
            emotion: "Émotion",
        },
        album: {
            cohesion: "Cohésion",
            production: "Production",
            originality: "Originalité",
        },
        artist: {
            identity: "Identité",
            consistency: "Régularité",
            impact: "Impact",
        },
    };

    return map[type]?.[key] ?? key;
}

function format(v: number) {
    return Number(v.toFixed(1)).toString();
}

export default function RatingMulti({
                                        entityType,
                                        average,
                                        ratings,
                                        prod,
                                        lyrics,
                                        emotion,
                                    }: Props) {
    const [open, setOpen] = useState(false);

    const computedRatings = useMemo(() => {
        if (ratings && typeof ratings === "object" && Object.keys(ratings).length > 0) {
            return ratings;
        }

        // legacy fallback
        const legacy: Record<string, number> = {};
        if (typeof prod === "number") legacy.prod = prod;
        if (typeof lyrics === "number") legacy.lyrics = lyrics;
        if (typeof emotion === "number") legacy.emotion = emotion;

        return Object.keys(legacy).length ? legacy : null;
    }, [ratings, prod, lyrics, emotion]);

    const computedAverage = useMemo(() => {
        if (typeof average === "number") return average;
        if (!computedRatings) return null;

        const values = Object.values(computedRatings);
        if (!values.length) return null;

        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        return Number(avg.toFixed(1));
    }, [average, computedRatings]);

    if (!computedRatings && computedAverage === null) return null;

    return (
        <View style={styles.wrap}>
            <View style={styles.topRow}>
                <Text style={styles.title}>Multi-critères</Text>

                {computedAverage !== null ? (
                    <View style={styles.pill}>
                        <Text style={styles.pillText}>{format(computedAverage)} / 5</Text>
                    </View>
                ) : null}
            </View>

            <TouchableOpacity
                style={styles.accordionBtn}
                onPress={() => setOpen((v) => !v)}
                activeOpacity={0.85}
            >
                <Text style={styles.accordionText}>Détails</Text>
                <Ionicons
                    name={open ? "chevron-up" : "chevron-down"}
                    size={16}
                    color="#bdbdbd"
                />
            </TouchableOpacity>

            {open && computedRatings ? (
                <View style={styles.details}>
                    {Object.entries(computedRatings).map(([k, v]) => (
                        <View key={k} style={styles.detailRow}>
                            <Text style={styles.detailLabel}>{getLabel(entityType, k)}</Text>
                            <Text style={styles.detailValue}>{format(Number(v))} / 5</Text>
                        </View>
                    ))}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: "#1f1f1f",
    },
    topRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    title: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "800",
    },
    pill: {
        backgroundColor: "#141414",
        borderWidth: 1,
        borderColor: "#2a2a2a",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
    },
    pillText: {
        color: "#9B5CFF",
        fontWeight: "900",
        fontSize: 12,
        letterSpacing: 0.3,
    },
    accordionBtn: {
        marginTop: 10,
        backgroundColor: "#101010",
        borderWidth: 1,
        borderColor: "#232323",
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    accordionText: {
        color: "#d8d8d8",
        fontWeight: "800",
        fontSize: 13,
    },
    details: {
        marginTop: 10,
        backgroundColor: "#0f0f0f",
        borderWidth: 1,
        borderColor: "#1e1e1e",
        borderRadius: 12,
        padding: 12,
    },
    detailRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 6,
    },
    detailLabel: {
        color: "#cfcfcf",
        fontWeight: "700",
        fontSize: 13,
    },
    detailValue: {
        color: "#ffffff",
        fontWeight: "900",
        fontSize: 13,
    },
});