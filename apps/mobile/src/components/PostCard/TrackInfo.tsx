import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { EntityType } from "./types";
import { colors, spacing, typography, fontWeights, radius } from "../../theme";

type Props = {
    coverUrl?: string | null;
    title?: string;
    artist?: string;
    entityType?: EntityType;
    isPlaying?: boolean;
};

function getEntityLabel(entityType?: EntityType) {
    if (entityType === "album") return "ALBUM";
    if (entityType === "artist") return "ARTISTE";
    return "SON";
}

function getEntityIcon(entityType?: EntityType) {
    if (entityType === "album") return "disc-outline";
    if (entityType === "artist") return "person-outline";
    return "musical-notes-outline";
}

export default function TrackInfo({
                                      coverUrl,
                                      title,
                                      artist,
                                      entityType,
                                      isPlaying = false,
                                  }: Props) {
    const cleanTitle =
        typeof title === "string" && title.trim().length > 0
            ? title.trim()
            : "Titre inconnu";

    const cleanArtist =
        typeof artist === "string" && artist.trim().length > 0
            ? artist.trim()
            : "Artiste inconnu";

    const cleanCover =
        typeof coverUrl === "string" && coverUrl.trim().length > 0
            ? coverUrl.trim()
            : "";

    return (
        <View style={styles.wrap}>
            <View style={styles.coverWrap}>
                {cleanCover ? (
                    <Image source={{ uri: cleanCover }} style={styles.cover} />
                ) : (
                    <View style={styles.coverPlaceholder}>
                        <Ionicons
                            name={getEntityIcon(entityType) as any}
                            size={20}
                            color={colors.textMuted}
                        />
                    </View>
                )}
            </View>

            <View style={styles.meta}>
                <View style={styles.titleRow}>
                    <Text numberOfLines={1} style={styles.title}>
                        {cleanTitle}
                    </Text>

                    <View style={styles.entityPill}>
                        <Text style={styles.entityPillText}>
                            {getEntityLabel(entityType)}
                        </Text>
                    </View>
                </View>

                <Text numberOfLines={1} style={styles.artist}>
                    {cleanArtist}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        marginTop: spacing.xs,
        marginBottom: spacing.md,
    },

    coverWrap: {
        width: 72,
        height: 72,
        borderRadius: 22,
        overflow: "hidden",
        backgroundColor: "#171720",
        borderWidth: 1,
        borderColor: "#262634",
    },

    cover: {
        width: "100%",
        height: "100%",
    },

    coverPlaceholder: {
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#171720",
    },

    meta: {
        flex: 1,
        marginLeft: 14,
        minWidth: 0,
    },

    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },

    title: {
        flexShrink: 1,
        color: colors.text,
        fontSize: 18,
        lineHeight: 24,
        fontWeight: fontWeights.black,
    },

    entityPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: "#2A2A35",
        backgroundColor: "transparent",
    },

    entityPillText: {
        color: colors.textFaint,
        fontSize: 11,
        fontWeight: fontWeights.black,
        letterSpacing: 0.8,
        textTransform: "uppercase",
    },

    artist: {
        marginTop: 4,
        color: colors.textMuted,
        fontSize: 15,
        fontWeight: fontWeights.medium,
    },
});