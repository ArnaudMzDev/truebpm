import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { API_URL, SOCKET_URL } from "../lib/config";
import { Ionicons } from "@expo/vector-icons";
import { io, Socket } from "socket.io-client";


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

function stripToken(raw: string | null) {
    if (!raw) return null;
    let t = raw.trim();

    if (t.toLowerCase().startsWith("bearer ")) {
        t = t.slice(7).trim();
    }

    if (
        (t.startsWith('"') && t.endsWith('"')) ||
        (t.startsWith("'") && t.endsWith("'"))
    ) {
        t = t.slice(1, -1).trim();
    }

    return t || null;
}

type Participant = { _id: string; pseudo: string; avatarUrl?: string };

type Conversation = {
    _id: string;
    participants: Participant[];
    lastMessageAt?: string | null;
    lastMessageText?: string;
    lastMessageType?: "text" | "post" | "image" | "";
    updatedAt?: string;
    unreadCount?: number;
};

function formatPreview(c: Conversation) {
    if (c.lastMessageType === "post") return c.lastMessageText || "📌 Post partagé";
    if (c.lastMessageType === "image") return c.lastMessageText || "📷 Photo";
    return c.lastMessageText || "—";
}

export default function ConversationsScreen({ navigation, route }: any) {
    const sharePostId: string | null = route?.params?.sharePostId ?? null;

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [meId, setMeId] = useState<string | null>(null);

    const socketRef = useRef<Socket | null>(null);

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

    useEffect(() => {
        let alive = true;

        (async () => {
            const stored = await AsyncStorage.getItem("token");
            const rawToken = stripToken(stored);
            if (!rawToken) return;

            const s = io(SOCKET_URL, {
                transports: ["websocket", "polling"],
                auth: { token: rawToken },
                reconnection: true,
            });

            socketRef.current = s;

            s.on("connect", () => {
                console.log("conversations socket connected", s.id);
            });

            s.on("conversations:invalidate", async () => {
                if (!alive) return;
                await fetchConversations();
            });

            s.on("disconnect", (reason) => {
                console.log("conversations socket disconnected:", reason);
            });
        })();

        return () => {
            alive = false;
            const s = socketRef.current;
            if (s) {
                s.removeAllListeners();
                s.disconnect();
            }
            socketRef.current = null;
        };
    }, [fetchConversations]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchConversations();
        setRefreshing(false);
    }, [fetchConversations]);

    const openConversation = useCallback(
        (c: Conversation) => {
            const other =
                c.participants?.find((p) => p?._id?.toString?.() !== meId?.toString?.()) ??
                c.participants?.[0] ??
                null;

            navigation.navigate("Chat", {
                conversationId: c._id,
                otherUser: other
                    ? { _id: other._id, pseudo: other.pseudo, avatarUrl: other.avatarUrl }
                    : null,
                sharePostId: sharePostId || null,
            });
        },
        [meId, navigation, sharePostId]
    );

    const title = useMemo(() => (sharePostId ? "Partager à..." : "Messages"), [sharePostId]);

    const renderItem = ({ item }: { item: Conversation }) => {
        const other =
            item.participants?.find((p) => p?._id?.toString?.() !== meId?.toString?.()) ??
            item.participants?.[0] ??
            null;

        const unread = (item.unreadCount ?? 0) > 0;

        return (
            <TouchableOpacity style={styles.row} onPress={() => openConversation(item)} activeOpacity={0.85}>
                <Image source={{ uri: other?.avatarUrl || "https://picsum.photos/200" }} style={styles.avatar} />

                <View style={{ flex: 1 }}>
                    <View style={styles.topLine}>
                        <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>
                            {other?.pseudo || "Conversation"}
                        </Text>

                        {(item.unreadCount ?? 0) > 0 ? (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{item.unreadCount}</Text>
                            </View>
                        ) : null}
                    </View>

                    <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
                        {formatPreview(item)}
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
            <Text style={styles.title}>{title}</Text>

            <FlatList
                data={conversations}
                keyExtractor={(c) => c._id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingBottom: 120 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9B5CFF" />}
                ListEmptyComponent={<Text style={styles.empty}>Aucune conversation pour l’instant.</Text>}
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

    topLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    name: { color: "#fff", fontWeight: "800", fontSize: 15, flex: 1 },
    preview: { color: "#888", marginTop: 2, fontSize: 13 },

    nameUnread: { color: "#fff" },
    previewUnread: { color: "#ddd" },

    badge: {
        minWidth: 20,
        paddingHorizontal: 6,
        height: 18,
        borderRadius: 9,
        backgroundColor: "#9B5CFF",
        alignItems: "center",
        justifyContent: "center",
    },
    badgeText: { color: "#000", fontSize: 11, fontWeight: "900" },
});