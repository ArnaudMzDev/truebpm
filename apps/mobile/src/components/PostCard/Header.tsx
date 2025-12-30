import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";


type Props = {
    pseudo: string;
    avatarUrl: string;
    createdAt: string;
    userId: string;
};

export default function Header({ pseudo, avatarUrl, createdAt, userId }: Props) {
    const navigation = useNavigation();
    const dateLabel = formatDate(createdAt);

    const goToProfile = () => {
        navigation.navigate("UserProfile", { userId });
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.left} onPress={goToProfile}>
                <Image
                    source={{ uri: avatarUrl || "https://picsum.photos/200" }}
                    style={styles.avatar}
                />

                <View>
                    <Text style={styles.pseudo}>{pseudo}</Text>
                    <Text style={styles.date}>{dateLabel}</Text>
                </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuButton}>
                <Ionicons name="ellipsis-vertical" size={18} color="#aaa" />
            </TouchableOpacity>
        </View>
    );
}

/* ------------------------------------- */
/*           FORMATAGE DE LA DATE        */
/* ------------------------------------- */
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

    return date.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long"
    });
}

/* ------------------------------------- */
/*                STYLES                 */
/* ------------------------------------- */

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 14,
    },

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

    menuButton: {
        padding: 6,
    },
});