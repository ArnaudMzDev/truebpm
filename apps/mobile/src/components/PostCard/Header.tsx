import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../../lib/config";


type Props = {
    // Auteur affiché (post original)
    pseudo: string;
    avatarUrl: string;
    createdAt: string;
    userId: string;

    // ✅ Optionnel : annotation repost
    repostByPseudo?: string;
    repostByUserId?: string;

    // ✅ Pour le menu "..."
    postId?: string;                 // id du post (doc) à supprimer
    canDelete?: boolean;             // true uniquement si c'est TON post (et pas un repost)
    onDeleted?: (postId: string) => void; // callback pour retirer de la liste
};

async function safeJson(res: Response): Promise<any | null> {
    const text = await res.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        console.log("Non-JSON response:", text.slice(0, 200));
        return null;
    }
}

export default function Header({
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

        const token = await AsyncStorage.getItem("token");
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
            console.log("Delete post error:", res.status, json);
            Alert.alert("Erreur", json?.error || "Impossible de supprimer ce post.");
            return;
        }

        // ✅ retire le post côté UI
        onDeleted?.(postId);
    };

    const openMenu = () => {
        // Pour l’instant on ne met une action que si c’est supprimable
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
            <View style={styles.leftWrap}>
                {/* ✅ Ligne auteur */}
                <TouchableOpacity style={styles.left} onPress={() => goToProfile(userId)} activeOpacity={0.85}>
                    <Image source={{ uri: avatarUrl || "https://picsum.photos/200" }} style={styles.avatar} />

                    <View style={{ flexShrink: 1 }}>
                        <Text style={styles.pseudo} numberOfLines={1}>
                            {pseudo}
                        </Text>

                        {showRepost ? (
                            <View style={styles.subLine}>
                                <TouchableOpacity onPress={() => goToProfile(repostByUserId)} activeOpacity={0.85}>
                                    <Text style={styles.repostText} numberOfLines={1}>
                                        Reposté par <Text style={styles.repostAt}>@{repostByPseudo}</Text>
                                    </Text>
                                </TouchableOpacity>

                                <Text style={styles.dot}> · </Text>
                                <Text style={styles.date}>{dateLabel}</Text>
                            </View>
                        ) : (
                            <Text style={styles.date}>{dateLabel}</Text>
                        )}
                    </View>
                </TouchableOpacity>
            </View>

            {/* ✅ Menu */}
            <TouchableOpacity style={styles.menuButton} activeOpacity={0.85} onPress={openMenu}>
                <Ionicons name="ellipsis-vertical" size={18} color={canDelete ? "#aaa" : "#555"} />
            </TouchableOpacity>
        </View>
    );
}

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
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 14,
    },

    leftWrap: { flex: 1, paddingRight: 10 },

    left: {
        flexDirection: "row",
        alignItems: "center",
    },

    avatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        marginRight: 10,
        shadowColor: "#9B5CFF",
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
    },

    pseudo: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "700",
    },

    date: {
        color: "#888",
        fontSize: 12,
        marginTop: 1,
    },

    subLine: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 1,
        flexWrap: "wrap",
    },

    repostText: {
        color: "#888",
        fontSize: 12,
    },

    repostAt: {
        color: "#9B5CFF",
        fontWeight: "800",
    },

    dot: {
        color: "#666",
        fontSize: 12,
    },

    menuButton: {
        padding: 6,
    },
});