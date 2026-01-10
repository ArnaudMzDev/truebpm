import React, { useCallback, useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    FlatList,
    TouchableOpacity,
    Image,
    RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";

const localIP = Constants.expoConfig?.hostUri?.split(":")[0];
const API_URL = `http://${localIP}:3000`;

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

type Conversation = {
    _id: string;
    participants: Array<{ _id: string; pseudo: string; avatarUrl?: string }>;
    lastMessageAt?: string | null;
    lastMessageText?: string;
    lastMessageType?: "text" | "post";
    updatedAt?: string;
};

export default function ConversationsScreen({ navigation }: any) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [meId, setMeId] = useState<string | null>(null);

    const loadMeId = useCallback(async () => {
        const raw = await AsyncStorage.getItem("user");
        if (!raw) return null;
        try {
            const u = JSON.parse(raw);
            return u?._id ? String(u._id) : null;
        } catch {
            return null;
        }
    }, []);

    const fetchConversations = useCallback(async () => {
        const token = await AsyncStorage.getItem("token");
        if (!token) {
            setConversations([]);
            return;
        }

        const res = await fetch(`${API_URL}/api/conversations`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        const json = await safeJson(res);
        if (!res.ok) {
            console.log("fetchConversations error:", res.status, json);
            setConversations([]);
            return;
        }

        setConversations(json?.conversations || []);
    }, []);

    useEffect(() => {
        (async () => {
            setLoading(true);
            const id = await loadMeId();
            setMeId(id);
            await fetchConversations();
            setLoading(false);
        })();
    }, [fetchConversations, loadMeId]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchConversations();
        setRefreshing(false);
    }, [fetchConversations]);

    const openConversation = (c: Conversation) => {
        // autre participant (DM)
        const other =
            c.participants?.find((p) => p._id?.toString?.() !== meId?.toString?.()) ??
            c.participants?.[0];

        navigation.navigate("Chat", {
            conversationId: c._id,
            otherUser: other ? { _id: other._id, pseudo: other.pseudo, avatarUrl: other.avatarUrl } : null,
        });
    };

    const renderItem = ({ item }: { item: Conversation }) => {
        const other =
            item.participants?.find((p) => p._id?.toString?.() !== meId?.toString?.()) ??
            item.participants?.[0];

        const last =
            item.lastMessageType === "post"
                ? item.lastMessageText || "📌 Post partagé"
                : item.lastMessageText || "—";

        return (
            <TouchableOpacity style={styles.row} onPress={() => openConversation(item)} activeOpacity={0.85}>
                <Image
                    source={{ uri: other?.avatarUrl || "https://picsum.photos/200" }}
                    style={styles.avatar}
                />
                <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>
                        {other?.pseudo || "Conversation"}
                    </Text>
                    <Text style={styles.preview} numberOfLines={1}>
                        {last}
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#666" />
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color="#9B5CFF" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Messages</Text>

            <FlatList
                data={conversations}
                keyExtractor={(c) => c._id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingBottom: 120 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9B5CFF" />}
                ListEmptyComponent={
                    <Text style={styles.empty}>Aucune conversation pour l’instant.</Text>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#000", paddingTop: 50, paddingHorizontal: 16 },
    title: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 14 },
    loading: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
    empty: { color: "#777", textAlign: "center", marginTop: 30 },

    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#111",
    },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#111" },
    name: { color: "#fff", fontWeight: "800", fontSize: 15 },
    preview: { color: "#888", marginTop: 2, fontSize: 13 },
});