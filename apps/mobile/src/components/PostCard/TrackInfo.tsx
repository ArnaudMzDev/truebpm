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

function TrackInfo({
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
                    <Image source={{ uri: cleanCover }} style={styles.cover} resizeMode="cover" />
                ) : (
                    <View style={styles.coverPlaceholder}>
                        <Ionicons
                            name={getEntityIcon(entityType) as any}
                            size={20}
                            color={colors.textMuted}
                        />
                    </View>
                )}
                <View style={styles.coverSheen} pointerEvents="none" />
            </View>

            <View style={styles.meta}>
                <View style={styles.entityLine}>
                    <View style={styles.entityPill}>
                        <Ionicons
                            name={getEntityIcon(entityType) as any}
                            size={12}
                            color={colors.primary}
                        />
                        <Text style={styles.entityPillText}>
                            {getEntityLabel(entityType)}
                        </Text>
                    </View>
                </View>

                <View style={styles.titleRow}>
                    <Text numberOfLines={1} style={styles.title}>
                        {cleanTitle}
                    </Text>
                </View>

                <Text numberOfLines={1} style={styles.artist}>
                    {cleanArtist}
                </Text>
            </View>
        </View>
    );
}

export default React.memo(TrackInfo);

const styles = StyleSheet.create({
    wrap: {
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        marginTop: 0,
        marginBottom: spacing.sm,
        backgroundColor: "rgba(8, 10, 14, 0.58)",
        borderWidth: 1,
        borderColor: colors.borderSoft,
        borderRadius: radius.xl,
        padding: 10,
    },

    coverWrap: {
        width: 88,
        height: 88,
        borderRadius: radius.xl,
        overflow: "hidden",
        backgroundColor: colors.surface4,
        borderWidth: 1,
        borderColor: colors.borderStrong,
    },

    cover: {
        width: "100%",
        height: "100%",
    },

    coverSheen: {
        ...StyleSheet.absoluteFillObject,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        borderRadius: radius.xl,
    },

    coverPlaceholder: {
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface4,
    },

    meta: {
        flex: 1,
        marginLeft: spacing.md,
        minWidth: 0,
        paddingRight: spacing.xs,
    },

    entityLine: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 7,
    },

    titleRow: {
        flexDirection: "row",
        alignItems: "center",
    },

    title: {
        flexShrink: 1,
        color: colors.text,
        fontSize: 20,
        lineHeight: 25,
        fontWeight: fontWeights.black,
    },

    entityPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.borderAccent,
        backgroundColor: colors.primaryFaint,
    },

    entityPillText: {
        color: colors.primary,
        fontSize: 11,
        fontWeight: fontWeights.black,
        letterSpacing: 0.7,
        textTransform: "uppercase",
    },

    artist: {
        marginTop: 4,
        color: colors.textMuted,
        fontSize: 14,
        fontWeight: fontWeights.medium,
    },
});
