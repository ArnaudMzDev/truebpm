import React, { useCallback, useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    FlatList,
    Image,
    Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "../lib/config";
import { useUser } from "../context/UserContext";

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

export default function FollowRequestsScreen({ navigation }: any) {
    const { refreshMe } = useUser();

    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const fetchRequests = useCallback(async () => {
        const token = await AsyncStorage.getItem("token");
        if (!token) {
            setItems([]);
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/follow/requests`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const json = await safeJson(res);
            if (!res.ok) {
                Alert.alert("Erreur", json?.error || "Impossible de charger les demandes.");
                setItems([]);
                return;
            }

            setItems(Array.isArray(json?.requests) ? json.requests : []);
        } catch (e) {
            console.log("fetch follow requests error:", e);
            Alert.alert("Erreur", "Impossible de charger les demandes.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const handleAction = useCallback(
        async (requestId: string, action: "accept" | "decline") => {
            const token = await AsyncStorage.getItem("token");
            if (!token) return;

            setProcessingId(requestId);
            try {
                const res = await fetch(`${API_URL}/api/follow/requests/${requestId}`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ action }),
                });

                const json = await safeJson(res);
                if (!res.ok) {
                    Alert.alert("Erreur", json?.error || "Impossible de traiter la demande.");
                    return;
                }

                setItems((prev) => prev.filter((x) => String(x._id) !== String(requestId)));

                if (action === "accept") {
                    await refreshMe();
                }
            } catch (e) {
                console.log("follow request action error:", e);
                Alert.alert("Erreur", "Impossible de traiter la demande.");
            } finally {
                setProcessingId(null);
            }
        },
        [refreshMe]
    );

    if (loading) {
        return (
            <View style={styles.loader}>
                <ActivityIndicator size="large" color="#9B5CFF" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.85}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>

                <Text style={styles.title}>Demandes</Text>

                <View style={{ width: 24 }} />
            </View>

            <FlatList
                data={items}
                keyExtractor={(item) => item._id}
                ListEmptyComponent={
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>Aucune demande d’abonnement pour le moment.</Text>
                    </View>
                }
                renderItem={({ item }) => {
                    const requester = item?.requesterId;
                    const busy = processingId === item._id;

                    return (
                        <View style={styles.card}>
                            <TouchableOpacity
                                style={styles.userRow}
                                activeOpacity={0.85}
                                onPress={() =>
                                    navigation.navigate("UserProfile", {
                                        userId: requester?._id,
                                    })
                                }
                            >
                                <Image
                                    source={{ uri: requester?.avatarUrl || "https://picsum.photos/200" }}
                                    style={styles.avatar}
                                />

                                <View style={{ flex: 1 }}>
                                    <Text style={styles.pseudo}>{requester?.pseudo || "Utilisateur"}</Text>
                                    <Text style={styles.bio} numberOfLines={2}>
                                        {requester?.bio?.trim() || "Souhaite suivre ton compte privé"}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <View style={styles.actionsRow}>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.declineBtn, busy && { opacity: 0.7 }]}
                                    activeOpacity={0.85}
                                    disabled={busy}
                                    onPress={() => handleAction(item._id, "decline")}
                                >
                                    <Text style={styles.declineText}>Refuser</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.acceptBtn, busy && { opacity: 0.7 }]}
                                    activeOpacity={0.85}
                                    disabled={busy}
                                    onPress={() => handleAction(item._id, "accept")}
                                >
                                    {busy ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={styles.acceptText}>Accepter</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    loader: {
        flex: 1,
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
    },
    container: {
        flex: 1,
        backgroundColor: "#000",
        paddingTop: 54,
        paddingHorizontal: 16,
    },
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 18,
    },
    title: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "800",
    },
    emptyBox: {
        marginTop: 10,
        backgroundColor: "#0F0F0F",
        borderWidth: 1,
        borderColor: "#1F1F1F",
        borderRadius: 18,
        padding: 16,
    },
    emptyText: {
        color: "#888",
        fontSize: 13,
        textAlign: "center",
    },
    card: {
        backgroundColor: "#0F0F0F",
        borderWidth: 1,
        borderColor: "#1F1F1F",
        borderRadius: 18,
        padding: 14,
        marginBottom: 12,
    },
    userRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: "#111",
    },
    pseudo: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "800",
    },
    bio: {
        color: "#888",
        fontSize: 12,
        marginTop: 4,
        lineHeight: 17,
    },
    actionsRow: {
        flexDirection: "row",
        gap: 10,
        marginTop: 14,
    },
    actionBtn: {
        flex: 1,
        minHeight: 44,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    declineBtn: {
        backgroundColor: "#161616",
        borderWidth: 1,
        borderColor: "#2A2A2A",
    },
    acceptBtn: {
        backgroundColor: "#5E17EB",
    },
    declineText: {
        color: "#fff",
        fontWeight: "800",
    },
    acceptText: {
        color: "#fff",
        fontWeight: "800",
    },
});