import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { API_URL } from "../../lib/config";
import { colors, spacing, typography, fontWeights, radius } from "../../theme";
import { getStoredToken } from "../../lib/authStorage";
import { DefaultAvatar } from "../ProfileFallbacks";

type Props = {
    pseudo: string;
    avatarUrl: string;
    createdAt: string;
    userId: string;
    repostByPseudo?: string;
    repostByUserId?: string;
    postId?: string;
    canDelete?: boolean;
    onDeleted?: (postId: string) => void;
};

async function safeJson(res: Response): Promise<any | null> {
    const text = await res.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        if (__DEV__) console.log("Non-JSON response:", text.slice(0, 200));
        return null;
    }
}

function Header({
                    pseudo,
                    avatarUrl,
                    createdAt,
                    userId,
                    repostByPseudo,
                    repostByUserId,
                    postId,
                    canDelete,
                    onDeleted,
                }: Props) {
    const navigation = useNavigation<any>();
    const dateLabel = formatDate(createdAt);

    const goToProfile = (id?: string) => {
        if (!id) return;
        navigation.navigate("UserProfile", { userId: id });
    };

    const showRepost = !!repostByPseudo && !!repostByUserId;

    const handleDelete = async () => {
        if (!postId) return;

        const token = await getStoredToken();
        if (!token) {
            Alert.alert("Erreur", "Tu n'es pas connecté.");
            return;
        }

        const res = await fetch(`${API_URL}/api/posts/${postId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
        });

        const json = await safeJson(res);
        if (!res.ok) {
            Alert.alert("Erreur", json?.error || "Impossible de supprimer ce post.");
            return;
        }

        onDeleted?.(postId);
    };

    const openMenu = () => {
        if (!canDelete || !postId) return;

        Alert.alert(
            "Options",
            "Que veux-tu faire ?",
            [
                { text: "Annuler", style: "cancel" },
                {
                    text: "Supprimer",
                    style: "destructive",
                    onPress: () => {
                        Alert.alert(
                            "Supprimer ce post ?",
                            "Cette action est définitive.",
                            [
                                { text: "Annuler", style: "cancel" },
                                { text: "Supprimer", style: "destructive", onPress: handleDelete },
                            ]
                        );
                    },
                },
            ],
            { cancelable: true }
        );
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={styles.left}
                onPress={() => goToProfile(userId)}
                activeOpacity={0.88}
            >
                {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                    <DefaultAvatar label={pseudo} seed={userId} size={44} style={styles.avatar} />
                )}

                <View style={styles.textWrap}>
                    <View style={styles.nameRow}>
                        <Text style={styles.pseudo} numberOfLines={1}>
                            {pseudo}
                        </Text>
                    </View>

                    <View style={styles.metaRow}>
                        <Text style={styles.date}>{dateLabel}</Text>

                        {showRepost ? (
                            <>
                                <Text style={styles.dot}>·</Text>
                                <TouchableOpacity
                                    onPress={() => goToProfile(repostByUserId)}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.repostText} numberOfLines={1}>
                                        reposté par <Text style={styles.repostAt}>@{repostByPseudo}</Text>
                                    </Text>
                                </TouchableOpacity>
                            </>
                        ) : null}
                    </View>
                </View>
            </TouchableOpacity>

            {canDelete ? (
                <TouchableOpacity
                    style={styles.menuButton}
                    activeOpacity={0.8}
                    onPress={openMenu}
                    hitSlop={8}
                >
                    <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

export default React.memo(Header);

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();

    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);

    if (diffSec < 60) return "à l'instant";
    if (diffMin < 60) return `il y a ${diffMin} min`;
    if (diffH < 24) return `il y a ${diffH} h`;
    if (diffD === 1) return "hier";
    if (diffD < 7) return `il y a ${diffD} jours`;

    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: spacing.md,
    },

    left: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        paddingRight: spacing.sm,
    },

    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: spacing.md,
        backgroundColor: colors.surface4,
        borderWidth: 1,
        borderColor: colors.borderAccent,
    },

    textWrap: {
        flex: 1,
        minWidth: 0,
        justifyContent: "center",
    },

    nameRow: {
        flexDirection: "row",
        alignItems: "center",
    },

    pseudo: {
        color: colors.text,
        fontSize: 15,
        fontWeight: fontWeights.black,
        lineHeight: 20,
    },

    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        marginTop: 3,
        gap: 6,
    },

    date: {
        color: colors.textMuted,
        fontSize: typography.caption,
    },

    dot: {
        color: colors.textFaint,
        fontSize: typography.caption,
    },

    repostText: {
        color: colors.textMuted,
        fontSize: typography.caption,
    },

    repostAt: {
        color: colors.primary,
        fontWeight: fontWeights.black,
    },

    menuButton: {
        width: 40,
        height: 40,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 4,
        backgroundColor: "rgba(8, 10, 14, 0.72)",
        borderWidth: 1,
        borderColor: colors.borderSoft,
    },
});
