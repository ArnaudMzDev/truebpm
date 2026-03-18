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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "../lib/config";

const PROFILE_MUSIC_PICK_KEY = "edit_profile_pending_music_pick";
const NOTE_TRACK_PICK_KEY = "create_note_pending_track_pick";

type SearchType = "song" | "album" | "artist";

type SongItem = {
    id: string;
    type: "song";
    title: string;
    artist: string;
    cover: string | null;
    previewUrl: string | null;
};

type AlbumItem = {
    id: string;
    type: "album";
    title: string;
    artist: string;
    cover: string | null;
};

type ArtistItem = {
    id: string;
    type: "artist";
    name: string;
    cover: string | null;
};

type AnyItem = SongItem | AlbumItem | ArtistItem;

type PickProfileKind =
    | "pinnedTrack"
    | "favoriteArtists"
    | "favoriteAlbums"
    | "favoriteTracks";

type CreatePostNavPayload = {
    entityType: "song" | "album" | "artist";
    entityId: string | null;
    track: {
        title: string;
        artist: string;
        cover: string | null;
        previewUrl?: string | null;
    };
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

function normalizeToProfileMusic(item: AnyItem) {
    if (item.type === "song") {
        return {
            entityId: item.id,
            entityType: "song" as const,
            title: item.title,
            artist: item.artist,
            coverUrl: item.cover || "",
            previewUrl: item.previewUrl || "",
        };
    }

    if (item.type === "album") {
        return {
            entityId: item.id,
            entityType: "album" as const,
            title: item.title,
            artist: item.artist,
            coverUrl: item.cover || "",
            previewUrl: "",
        };
    }

    return {
        entityId: item.id,
        entityType: "artist" as const,
        title: item.name,
        artist: item.name,
        coverUrl: item.cover || "",
        previewUrl: "",
    };
}

export default function SearchScreen({ navigation, route }: any) {
    const mode: "pickTrack" | "pickProfileMusic" | "pickNoteTrack" =
        route?.params?.mode || "pickTrack";

    const kind: PickProfileKind | undefined = route?.params?.kind;

    const initialType: SearchType =
        route?.params?.initialType ||
        (kind === "favoriteArtists"
            ? "artist"
            : kind === "favoriteAlbums"
                ? "album"
                : "song");

    const [query, setQuery] = useState("");
    const [type, setType] = useState<SearchType>(initialType);
    const [results, setResults] = useState<AnyItem[]>([]);
    const [loading, setLoading] = useState(false);

    const search = async (forcedType?: SearchType) => {
        const effective = forcedType ?? type;
        if (!query.trim()) return;

        try {
            setLoading(true);

            const url = `${API_URL}/api/search/apple?q=${encodeURIComponent(
                query.trim()
            )}&type=${effective}`;

            const res = await fetch(url);
            const json = await safeJson(res);

            if (!res.ok || !json?.items) {
                console.log("Search error:", res.status, json);
                setResults([]);
                return;
            }

            setResults(Array.isArray(json.items) ? json.items : []);
        } catch (err) {
            console.log("Search fetch error:", err);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const goToCreatePost = (payload: CreatePostNavPayload) => {
        navigation.navigate("CreatePost", payload);
    };

    const selectForProfileMusic = async (item: AnyItem) => {
        if (!kind) return;

        const normalized = normalizeToProfileMusic(item);

        if (kind === "pinnedTrack" && normalized.entityType !== "song") return;
        if (kind === "favoriteArtists" && normalized.entityType !== "artist") return;
        if (kind === "favoriteAlbums" && normalized.entityType !== "album") return;
        if (kind === "favoriteTracks" && normalized.entityType !== "song") return;

        try {
            await AsyncStorage.setItem(
                PROFILE_MUSIC_PICK_KEY,
                JSON.stringify({
                    kind,
                    item: normalized,
                })
            );
        } catch (e) {
            console.log("save picked profile music error:", e);
        }

        navigation.goBack();
    };

    const selectForNoteTrack = async (item: AnyItem) => {
        const normalized = normalizeToProfileMusic(item);

        try {
            await AsyncStorage.setItem(
                NOTE_TRACK_PICK_KEY,
                JSON.stringify(normalized)
            );
        } catch (e) {
            console.log("save picked note track error:", e);
        }

        navigation.goBack();
    };

    const handlePress = (item: AnyItem) => {
        if (mode === "pickProfileMusic") {
            selectForProfileMusic(item);
            return;
        }

        if (mode === "pickNoteTrack") {
            selectForNoteTrack(item);
            return;
        }

        if (item.type === "song") {
            goToCreatePost({
                entityType: "song",
                entityId: item.id,
                track: {
                    title: item.title,
                    artist: item.artist,
                    cover: item.cover,
                    previewUrl: item.previewUrl,
                },
            });
            return;
        }

        if (item.type === "album") {
            goToCreatePost({
                entityType: "album",
                entityId: item.id,
                track: {
                    title: item.title,
                    artist: item.artist,
                    cover: item.cover,
                    previewUrl: null,
                },
            });
            return;
        }

        goToCreatePost({
            entityType: "artist",
            entityId: item.id,
            track: {
                title: item.name,
                artist: item.name,
                cover: item.cover,
                previewUrl: null,
            },
        });
    };

    const renderItem = ({ item }: { item: AnyItem }) => {
        if (item.type === "song") {
            return (
                <TouchableOpacity style={styles.item} onPress={() => handlePress(item)}>
                    {item.cover ? (
                        <Image source={{ uri: item.cover }} style={styles.cover} />
                    ) : (
                        <View style={styles.placeholder}>
                            <Ionicons name="musical-notes" size={18} color="#bbb" />
                        </View>
                    )}

                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text numberOfLines={1} style={styles.title}>
                            {item.title}
                        </Text>
                        <Text numberOfLines={1} style={styles.artist}>
                            {item.artist}
                        </Text>
                    </View>

                    {item.previewUrl ? <Ionicons name="play" size={18} color="#bbb" /> : null}
                </TouchableOpacity>
            );
        }

        if (item.type === "album") {
            return (
                <TouchableOpacity style={styles.item} onPress={() => handlePress(item)}>
                    {item.cover ? (
                        <Image source={{ uri: item.cover }} style={styles.cover} />
                    ) : (
                        <View style={styles.placeholder}>
                            <Ionicons name="disc" size={18} color="#bbb" />
                        </View>
                    )}

                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text numberOfLines={1} style={styles.title}>
                            {item.title}
                        </Text>
                        <Text numberOfLines={1} style={styles.artist}>
                            {item.artist}
                        </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={18} color="#666" />
                </TouchableOpacity>
            );
        }

        return (
            <TouchableOpacity style={styles.item} onPress={() => handlePress(item)}>
                {item.cover ? (
                    <Image source={{ uri: item.cover }} style={styles.cover} />
                ) : (
                    <View style={styles.placeholder}>
                        <Ionicons name="person" size={18} color="#bbb" />
                    </View>
                )}

                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text numberOfLines={1} style={styles.title}>
                        {item.name}
                    </Text>
                    <Text numberOfLines={1} style={styles.artist}>
                        Artiste
                    </Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color="#666" />
            </TouchableOpacity>
        );
    };

    const screenTitle =
        mode === "pickProfileMusic"
            ? kind === "pinnedTrack"
                ? "Choisir un son épinglé"
                : kind === "favoriteArtists"
                    ? "Choisir des artistes favoris"
                    : kind === "favoriteAlbums"
                        ? "Choisir des albums favoris"
                        : "Choisir des morceaux favoris"
            : mode === "pickNoteTrack"
                ? "Choisir un son pour la note"
                : "Rechercher";

    return (
        <View style={styles.container}>
            <Text style={styles.screenTitle}>{screenTitle}</Text>

            <TextInput
                style={styles.input}
                placeholder="Rechercher un titre, album, artiste..."
                placeholderTextColor="#777"
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => search()}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
            />

            <View style={styles.filters}>
                {(["song", "album", "artist"] as SearchType[]).map((t) => (
                    <TouchableOpacity
                        key={t}
                        style={[styles.filter, type === t && styles.filterActive]}
                        onPress={() => {
                            setType(t);
                            if (query.trim()) search(t);
                        }}
                    >
                        <Text style={styles.filterText}>
                            {t === "song" ? "Sons" : t === "album" ? "Albums" : "Artistes"}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#9B5CFF" style={{ marginTop: 30 }} />
            ) : (
                <FlatList
                    data={results}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 200 }}
                    keyboardShouldPersistTaps="handled"
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
        padding: 16,
        paddingTop: 50,
    },
    screenTitle: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "800",
        marginBottom: 14,
    },
    input: {
        backgroundColor: "#111",
        padding: 14,
        borderRadius: 12,
        color: "#fff",
        fontSize: 16,
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
    filterActive: {
        backgroundColor: "#5E17EB",
    },
    filterText: {
        color: "#fff",
        fontWeight: "600",
    },
    item: {
        flexDirection: "row",
        padding: 12,
        backgroundColor: "#111",
        borderRadius: 12,
        marginTop: 10,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#1f1f1f",
    },
    cover: {
        width: 60,
        height: 60,
        borderRadius: 8,
    },
    placeholder: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: "#1b1b1b",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#2a2a2a",
    },
    title: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "700",
    },
    artist: {
        color: "#aaa",
        marginTop: 3,
        fontSize: 13,
    },
});