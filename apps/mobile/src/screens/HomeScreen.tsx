import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    FlatList,
    TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const localIP = Constants.expoConfig?.hostUri?.split(":")[0];
const API_URL = `http://${localIP}:3000`;

export default function HomeScreen({ navigation }: any) {
    const insets = useSafeAreaInsets(); // 🔥 récupère haut/bas encoche

    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadFeed = async () => {
        try {
            const res = await fetch(`${API_URL}/api/posts/feed`);
            const data = await res.json();

            if (res.ok) setPosts(data.posts);
        } catch (e) {
            console.log("Feed error:", e);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadFeed();
    }, []);

    const renderPost = ({ item }: any) => (
        <TouchableOpacity
            style={styles.post}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("PostDetails", { post: item })}
        >
            {item.coverUrl && (
                <Image source={{ uri: item.coverUrl }} style={styles.cover} />
            )}

            <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.title} numberOfLines={1}>
                    {item.trackTitle}
                </Text>

                <Text style={styles.artist} numberOfLines={1}>
                    {item.artist}
                </Text>

                <View style={styles.row}>
                    <Text style={styles.rating}>⭐ {item.rating}/5</Text>

                    <TouchableOpacity
                        onPress={() =>
                            navigation.navigate("Profile", { userId: item.userId._id })
                        }
                    >
                        <Text style={styles.user}>
                            par {item.userId.pseudo}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
            {/* HEADER */}
            <View style={styles.headerRow}>
                <Text style={styles.header}>Derniers posts 🎧</Text>

                <TouchableOpacity
                    style={styles.newPostButton}
                    onPress={() => navigation.navigate("Search")}
                >
                    <Text style={styles.newPostText}>+ Poster</Text>
                </TouchableOpacity>
            </View>

            {/* FEED */}
            {loading ? (
                <Text style={{ color: "#aaa" }}>Chargement...</Text>
            ) : (
                <FlatList
                    data={posts}
                    keyExtractor={(item) => item._id}
                    renderItem={renderPost}
                    contentContainerStyle={{ paddingBottom: 120 }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
        paddingHorizontal: 16,
    },

    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },

    header: {
        color: "#fff",
        fontSize: 22,
        fontWeight: "800",
    },

    newPostButton: {
        backgroundColor: "#5E17EB",
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
    },

    newPostText: {
        color: "#fff",
        fontWeight: "700",
    },

    post: {
        backgroundColor: "#111",
        borderRadius: 14,
        padding: 12,
        marginBottom: 14,
        flexDirection: "row",
    },

    cover: {
        width: 70,
        height: 70,
        borderRadius: 8,
    },

    title: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },

    artist: {
        color: "#aaa",
        fontSize: 14,
        marginTop: 3,
    },

    row: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 8,
    },

    rating: {
        color: "#9B5CFF",
        fontWeight: "700",
        marginRight: 10,
    },

    user: {
        color: "#5E17EB",
        fontWeight: "600",
    },
});