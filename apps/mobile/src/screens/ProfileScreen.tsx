import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    ScrollView,
    TouchableOpacity
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function ProfileScreen({ navigation }: any) {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadUser = async () => {
            const stored = await AsyncStorage.getItem("user");
            if (stored) setUser(JSON.parse(stored));
            setLoading(false);
        };
        loadUser();
    }, []);

    const handleLogout = async () => {
        await AsyncStorage.removeItem("token");
        await AsyncStorage.removeItem("user");
        navigation.replace("Login");
    };

    if (loading || !user) {
        return (
            <View style={styles.loading}>
                <Text style={{ color: "#fff" }}>Chargement...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>

            {/* BANNER */}
            <View style={styles.bannerBox}>
                <Image
                    source={{ uri: user.bannerUrl || "https://picsum.photos/600/200" }}
                    style={styles.banner}
                />
            </View>

            {/* BUTTONS */}
            <View style={styles.buttonsRow}>
                <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => navigation.navigate("EditProfile")}
                >
                    <Text style={styles.editText}>Modifier</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Text style={styles.logoutIcon}>⏻</Text>
                </TouchableOpacity>
            </View>

            {/* AVATAR */}
            <Image
                source={{ uri: user.avatarUrl || "https://picsum.photos/200" }}
                style={[styles.avatar, styles.avatarGlow]}
            />

            {/* PSEUDO */}
            <Text style={styles.pseudo}>{user.pseudo}</Text>

            {/* BIO */}
            <Text style={styles.bio}>{user.bio || "Aucune bio."}</Text>

            {/* STATS */}
            <View style={styles.stats}>
                <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{user.followers || 0}</Text>
                    <Text style={styles.statLabel}>Followers</Text>
                </View>

                <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{user.following || 0}</Text>
                    <Text style={styles.statLabel}>Following</Text>
                </View>

                <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{user.notesCount || 0}</Text>
                    <Text style={styles.statLabel}>Notes</Text>
                </View>
            </View>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
    },

    container: {
        flex: 1,
        backgroundColor: "#000",
    },

    bannerBox: {
        width: "100%",
        height: 160,
        backgroundColor: "#111",
    },

    banner: {
        width: "100%",
        height: "100%",
    },

    buttonsRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        paddingHorizontal: 16,
        marginTop: 10,
        gap: 10,
    },

    editButton: {
        backgroundColor: "#5E17EB",
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 10,
    },

    editText: {
        color: "#fff",
        fontWeight: "600",
    },

    logoutButton: {
        backgroundColor: "#330000",
        borderWidth: 1,
        borderColor: "#FF4444",
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 10,
    },

    logoutIcon: {
        color: "#FF5555",
        fontSize: 14,
        fontWeight: "700",
    },

    avatar: {
        width: 90,
        height: 90,
        borderRadius: 45,
        borderWidth: 3,
        borderColor: "#000",
        marginTop: -50,
        marginLeft: 20,
    },

    avatarGlow: {
        shadowColor: "#9B5CFF",
        shadowOpacity: 0.4,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 },
    },

    pseudo: {
        fontSize: 22,
        color: "#fff",
        fontWeight: "800",
        marginTop: 10,
        marginLeft: 20,
    },

    bio: {
        color: "#ccc",
        fontSize: 14,
        marginTop: 6,
        marginLeft: 20,
        marginRight: 20,
    },

    stats: {
        flexDirection: "row",
        justifyContent: "space-around",
        marginTop: 25,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderColor: "#222",
    },

    statBox: { alignItems: "center" },

    statNumber: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
    },

    statLabel: {
        color: "#aaa",
        fontSize: 13,
    },
});