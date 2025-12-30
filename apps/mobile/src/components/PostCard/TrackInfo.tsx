import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { EntityType } from "./types";

type Props = {
    coverUrl?: string | null;
    title: string;
    artist: string;
    entityType?: EntityType;
};

function getEntityLabel(entityType?: EntityType) {
    if (entityType === "album") return "ALBUM";
    if (entityType === "artist") return "ARTISTE";
    return "SON";
}

export default function TrackInfo({ coverUrl, title, artist, entityType }: Props) {
    return (
        <View style={styles.row}>
            <View style={styles.coverWrap}>
                {coverUrl ? (
                    <Image source={{ uri: coverUrl }} style={styles.cover} />
                ) : (
                    <View style={styles.coverPlaceholder} />
                )}
            </View>

            <View style={styles.meta}>
                <View style={styles.topLine}>
                    <Text numberOfLines={1} style={styles.title}>
                        {title}
                    </Text>

                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{getEntityLabel(entityType)}</Text>
                    </View>
                </View>

                <Text numberOfLines={1} style={styles.artist}>
                    {artist}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 12,
    },
    coverWrap: {
        width: 54,
        height: 54,
        borderRadius: 10,
        overflow: "hidden",
        backgroundColor: "#151515",
        borderWidth: 1,
        borderColor: "#232323",
    },
    cover: {
        width: "100%",
        height: "100%",
    },
    coverPlaceholder: {
        width: "100%",
        height: "100%",
        backgroundColor: "#1b1b1b",
    },
    meta: {
        flex: 1,
        marginLeft: 12,
    },
    topLine: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    title: {
        flex: 1,
        color: "#fff",
        fontSize: 15,
        fontWeight: "800",
    },
    artist: {
        color: "#aaa",
        marginTop: 3,
        fontSize: 13,
        fontWeight: "600",
    },
    badge: {
        backgroundColor: "#141414",
        borderWidth: 1,
        borderColor: "#2a2a2a",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
    },
    badgeText: {
        color: "#cfcfcf",
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 0.4,
    },
});