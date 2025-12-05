import React, { useState } from "react";
import {
    View,
    TextInput,
    Text,
    FlatList,
    Image,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from "react-native";
import { usePlayer } from "../context/PlayerContext";
import Constants from "expo-constants";

const localIP = Constants.expoConfig?.hostUri?.split(":")[0];
const API_URL = `http://${localIP}:3000`;

type SearchType = "song" | "album" | "artist";

export default function SearchScreen() {
    const [query, setQuery] = useState("");
    const [type, setType] = useState<SearchType>("song");
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const { playPreview } = usePlayer();

    const search = async () => {
        if (!query.trim()) return;
        setLoading(true);

        try {
            const res = await fetch(
                `${API_URL}/api/search/apple?q=${encodeURIComponent(
                    query
                )}&type=${type}`
            );

            const data = await res.json();

            if (!res.ok) {
                console.log("Search error:", data);
                setResults([]);
                setLoading(false);
                return;
            }

            setResults(data.items || []);
        } catch (e) {
            console.log("Search fetch error:", e);
            setResults([]);
        }

        setLoading(false);
    };

    const renderItem = ({ item }: any) => {
        if (type === "song") {
            return (
                <TouchableOpacity
                    style={styles.item}
                    onPress={() => {
                        if (item.previewUrl) {
                            playPreview({
                                title: item.title,
                                artist: item.artist,
                                cover: item.cover,
                                url: item.previewUrl,
                            });
                        }
                    }}
                >
                    <Image source={{ uri: item.cover }} style={styles.cover} />

                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.artist} numberOfLines={1}>{item.artist}</Text>
                    </View>

                    {item.previewUrl && <Text style={styles.play}>▶</Text>}
                </TouchableOpacity>
            );
        }

        if (type === "album") {
            return (
                <View style={styles.item}>
                    <Image source={{ uri: item.cover }} style={styles.cover} />

                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.artist} numberOfLines={1}>{item.artist}</Text>
                    </View>
                </View>
            );
        }

        return (
            <View style={styles.item}>
                <Image source={{ uri: item.cover }} style={styles.cover} />

                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <TextInput
                style={styles.input}
                placeholder="Rechercher un titre, album, artiste..."
                placeholderTextColor="#777"
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={search}
            />

            <View style={styles.filters}>
                <TouchableOpacity
                    style={[styles.filter, type === "song" && styles.filterActive]}
                    onPress={() => setType("song")}
                >
                    <Text style={styles.filterText}>Sons</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.filter, type === "album" && styles.filterActive]}
                    onPress={() => setType("album")}
                >
                    <Text style={styles.filterText}>Albums</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.filter, type === "artist" && styles.filterActive]}
                    onPress={() => setType("artist")}
                >
                    <Text style={styles.filterText}>Artistes</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#9B5CFF" />
            ) : (
                <FlatList
                    data={results}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 200 }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#000", padding: 16, paddingTop: 50 },
    input: {
        backgroundColor: "#111",
        padding: 14,
        borderRadius: 12,
        color: "#fff",
        borderWidth: 1,
        borderColor: "#222",
    },
    filters: {
        flexDirection: "row",
        marginTop: 14,
        marginBottom: 10,
        backgroundColor: "#111",
        padding: 4,
        borderRadius: 10,
    },
    filter: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: "center",
    },
    filterActive: { backgroundColor: "#5E17EB" },
    filterText: { color: "#fff", fontWeight: "600" },
    item: {
        flexDirection: "row",
        padding: 12,
        backgroundColor: "#111",
        borderRadius: 12,
        marginTop: 10,
        alignItems: "center",
    },
    cover: { width: 60, height: 60, borderRadius: 8 },
    title: { color: "#fff", fontSize: 15, fontWeight: "700" },
    artist: { color: "#aaa", marginTop: 3 },
    play: { color: "#fff", fontSize: 20, marginLeft: 10 },
});