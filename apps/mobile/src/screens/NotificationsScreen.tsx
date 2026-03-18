import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    TouchableOpacity,
    Image,
    RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL, SOCKET_URL } from "../lib/config";
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
    if (t.toLowerCase().startsWith("bearer ")) t = t.slice(7).trim();
    if (
        (t.startsWith('"') && t.endsWith('"')) ||
        (t.startsWith("'") && t.endsWith("'"))
    ) {
        t = t.slice(1, -1).trim();
    }
    return t || null;
}

function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();

    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);

    if (diffMin < 1) return "à l'instant";
    if (diffMin < 60) return `il y a ${diffMin} min`;
    if (diffH < 24) return `il y a ${diffH} h`;
    if (diffD < 7) return `il y a ${diffD} j`;
    return date.toLocaleDateString("fr-FR");
}

function getNotificationText(item: any) {
    const actor = item?.actorId?.pseudo || "Quelqu’un";

    switch (item.type) {
        case "follow":
            return `${actor} a commencé à te suivre`;
        case "like_post":
            return `${actor} a aimé ton post`;
        case "comment_post":
            return `${actor} a commenté ton post`;
        case "reply_comment":
            return `${actor} a répondu à ton commentaire`;
        case "like_comment":
            return `${actor} a aimé ton commentaire`;
        case "repost_post":
            return `${actor} a reposté ton post`;
        default:
            return `${actor} a interagi avec toi`;
    }
}

function uniqById(list: any[]) {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const item of list) {
        const id = String(item?._id || "");
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(item);
    }
    return out;
}

export default function NotificationsScreen({ navigation }: any) {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    const fetchNotifications = useCallback(async () => {
        const token = await AsyncStorage.getItem("token");
        if (!token) {
            setItems([]);
            return;
        }

        const res = await fetch(`${API_URL}/api/notifications`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        const json = await safeJson(res);
        if (!res.ok) {
            console.log("fetchNotifications error:", res.status, json);
            setItems([]);
            return;
        }

        setItems(json?.notifications || []);
    }, []);

    const markAllRead = useCallback(async () => {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        await fetch(`${API_URL}/api/notifications/read-all`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
    }, []);

    useEffect(() => {
        (async () => {
            setLoading(true);
            await markAllRead();
            await fetchNotifications();
            setLoading(false);
        })();
    }, [fetchNotifications, markAllRead]);

    useEffect(() => {
        let alive = true;

        (async () => {
            const stored = await AsyncStorage.getItem("token");
            const rawToken = stripToken(stored);
            if (!rawToken) return;

            const s = io(SOCKET_URL, {
                transports: ["websocket", "polling"],
                auth: { token: rawToken },
            });

            socketRef.current = s;

            s.on("notification:new", ({ notification }: any) => {
                if (!alive || !notification?._id) return;
                setItems((prev) => uniqById([notification, ...prev]));
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
    }, []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await markAllRead();
        await fetchNotifications();
        setRefreshing(false);
    }, [fetchNotifications, markAllRead]);

    const openItem = useCallback(
        (item: any) => {
            if (item?.postId?._id) {
                navigation.navigate("PostDetail", { postId: item.postId._id });
                return;
            }

            if (item?.actorId?._id) {
                navigation.navigate("UserProfile", { userId: item.actorId._id });
            }
        },
        [navigation]
    );

    if (loading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color="#9B5CFF" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Notifications</Text>

            <FlatList
                data={items}
                keyExtractor={(item) => item._id}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#9B5CFF"
                    />
                }
                ListEmptyComponent={<Text style={styles.empty}>Aucune notification pour l’instant.</Text>}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.row} activeOpacity={0.85} onPress={() => openItem(item)}>
                        <Image
                            source={{ uri: item?.actorId?.avatarUrl || "https://picsum.photos/200" }}
                            style={styles.avatar}
                        />

                        <View style={{ flex: 1 }}>
                            <Text style={styles.text}>{getNotificationText(item)}</Text>
                            <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
                        </View>
                    </TouchableOpacity>
                )}
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
        gap: 12,
        alignItems: "center",
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#111",
    },
    avatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: "#111",
    },
    text: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "700",
    },
    date: {
        color: "#777",
        fontSize: 12,
        marginTop: 4,
    },
});