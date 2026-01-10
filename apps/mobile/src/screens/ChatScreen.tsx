import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    FlatList,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Image,
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

type Msg = {
    _id: string;
    type: "text" | "post";
    text?: string;
    createdAt: string;
    senderId?: { _id: string; pseudo: string; avatarUrl?: string };
    postId?: any; // pour plus tard (preview post partagé)
};

export default function ChatScreen({ route, navigation }: any) {
    const { conversationId, otherUser } = route.params;

    const [meId, setMeId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState<Msg[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);

    const LIMIT = 30;

    useEffect(() => {
        navigation.setOptions?.({ headerShown: false });
    }, [navigation]);

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

    const fetchInitial = useCallback(async () => {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        setLoading(true);
        setCursor(null);
        setHasMore(true);

        const res = await fetch(
            `${API_URL}/api/conversations/${conversationId}/messages?limit=${LIMIT}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const json = await safeJson(res);
        if (!res.ok) {
            console.log("fetch messages error:", res.status, json);
            setMessages([]);
            setHasMore(false);
            setLoading(false);
            return;
        }

        // API renvoie du + récent au + ancien
        setMessages(json?.messages || []);
        setCursor(json?.nextCursor || null);
        setHasMore(!!json?.nextCursor);
        setLoading(false);
    }, [conversationId]);

    const loadMore = useCallback(async () => {
        if (!cursor || loadingMore || !hasMore) return;

        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        setLoadingMore(true);

        try {
            const res = await fetch(
                `${API_URL}/api/conversations/${conversationId}/messages?limit=${LIMIT}&cursor=${encodeURIComponent(
                    cursor
                )}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const json = await safeJson(res);
            if (!res.ok) {
                setHasMore(false);
                return;
            }

            const next = (json?.messages || []) as Msg[];
            setMessages((prev) => [...prev, ...next]); // on ajoute des + anciens à la fin (car liste inversée)
            setCursor(json?.nextCursor || null);
            setHasMore(!!json?.nextCursor);
        } finally {
            setLoadingMore(false);
        }
    }, [conversationId, cursor, hasMore, loadingMore]);

    useEffect(() => {
        (async () => {
            const id = await loadMeId();
            setMeId(id);
            await fetchInitial();
        })();
    }, [fetchInitial, loadMeId]);

    const sendText = useCallback(async () => {
        const t = text.trim();
        if (!t || sending) return;

        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        setSending(true);

        // optimistic msg
        const tempId = `tmp_${Date.now()}`;
        const optimistic: Msg = {
            _id: tempId,
            type: "text",
            text: t,
            createdAt: new Date().toISOString(),
            senderId: meId ? { _id: meId, pseudo: "moi" } : undefined,
        };

        setMessages((prev) => [optimistic, ...prev]);
        setText("");

        try {
            const res = await fetch(`${API_URL}/api/conversations/${conversationId}/messages`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ type: "text", text: t }),
            });

            const json = await safeJson(res);
            if (!res.ok) {
                console.log("send message error:", res.status, json);
                // rollback
                setMessages((prev) => prev.filter((m) => m._id !== tempId));
                setText(t);
                return;
            }

            const created = json?.message as Msg;
            if (created?._id) {
                setMessages((prev) => [created, ...prev.filter((m) => m._id !== tempId)]);
            }
        } finally {
            setSending(false);
        }
    }, [conversationId, meId, sending, text]);

    const title = useMemo(() => otherUser?.pseudo || "Chat", [otherUser]);

    const renderItem = ({ item }: { item: Msg }) => {
        const mine = item?.senderId?._id?.toString?.() === meId?.toString?.();

        return (
            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                {item.type === "post" ? (
                    <Text style={[styles.msgText, mine ? styles.textMine : styles.textOther]}>
                        📌 Post partagé {item.text ? `— ${item.text}` : ""}
                    </Text>
                ) : (
                    <Text style={[styles.msgText, mine ? styles.textMine : styles.textOther]}>{item.text}</Text>
                )}
            </View>
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
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} activeOpacity={0.85}>
                    <Ionicons name="chevron-back" size={22} color="#fff" />
                </TouchableOpacity>

                <View style={styles.headerCenter}>
                    <Image source={{ uri: otherUser?.avatarUrl || "https://picsum.photos/200" }} style={styles.headerAvatar} />
                    <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                </View>

                <View style={{ width: 36 }} />
            </View>

            {/* Messages (inverted = newest at bottom in UI, but easiest for chat) */}
            <FlatList
                data={messages}
                keyExtractor={(m) => m._id}
                renderItem={renderItem}
                inverted
                contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
                onEndReached={loadMore}
                onEndReachedThreshold={0.2}
                ListFooterComponent={
                    loadingMore ? <ActivityIndicator color="#9B5CFF" style={{ marginVertical: 10 }} /> : null
                }
            />

            {/* Input */}
            <View style={styles.inputRow}>
                <TextInput
                    style={styles.input}
                    value={text}
                    onChangeText={setText}
                    placeholder="Message..."
                    placeholderTextColor="#666"
                    multiline
                />
                <TouchableOpacity onPress={sendText} style={styles.sendBtn} activeOpacity={0.85} disabled={sending}>
                    <Ionicons name="send" size={18} color="#fff" />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#000" },
    loading: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },

    header: {
        paddingTop: 50,
        paddingHorizontal: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#111",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    headerBtn: { padding: 8 },
    headerCenter: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, marginLeft: 6 },
    headerAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#111" },
    headerTitle: { color: "#fff", fontWeight: "900", fontSize: 16, flexShrink: 1 },

    bubble: {
        maxWidth: "78%",
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 14,
        marginVertical: 6,
    },
    bubbleMine: { alignSelf: "flex-end", backgroundColor: "#5E17EB" },
    bubbleOther: { alignSelf: "flex-start", backgroundColor: "#111", borderWidth: 1, borderColor: "#1e1e1e" },
    msgText: { fontSize: 14, fontWeight: "600" },
    textMine: { color: "#fff" },
    textOther: { color: "#ddd" },

    inputRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: "#111",
        backgroundColor: "#000",
    },
    input: {
        flex: 1,
        minHeight: 44,
        maxHeight: 120,
        color: "#fff",
        backgroundColor: "#111",
        borderWidth: 1,
        borderColor: "#222",
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: "#5E17EB",
        alignItems: "center",
        justifyContent: "center",
    },
});