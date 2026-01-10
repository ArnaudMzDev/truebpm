import React, { useMemo, useState, useCallback } from "react";
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
} from "react-native";
import { useUser } from "../context/UserContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";

const localIP = Constants.expoConfig?.hostUri?.split(":")[0];
const API_URL = `http://${localIP}:3000`;

type Props = {
    user: {
        _id: string;
        pseudo: string;
        avatarUrl?: string;
    };
    navigation: any;
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

export default function UserListItem({ user, navigation }: Props) {
    const { me, toggleFollow } = useUser();

    const [loadingFollow, setLoadingFollow] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState(false);

    const isSelf = me?._id?.toString() === user._id?.toString();

    const isFollowing = useMemo(() => {
        const list = me?.followingList || [];
        return list.some((id: any) => id?.toString?.() === user._id?.toString?.());
    }, [me, user._id]);

    const goToProfile = () => {
        navigation.push("UserProfile", { userId: user._id });
    };

    const handleToggle = async () => {
        if (loadingFollow) return;
        setLoadingFollow(true);
        try {
            await toggleFollow(user._id);
        } finally {
            setLoadingFollow(false);
        }
    };

    // ✅ navigation robuste vers Chat (via Main -> Tab -> MessagesStack)
    const goToChat = useCallback(
        (conversationId: string) => {
            navigation.navigate("Main", {
                screen: "Notifications", // ton tab "Messages"
                params: {
                    screen: "Chat", // screen du MessagesStack
                    params: {
                        conversationId,
                        otherUser: {
                            _id: user._id,
                            pseudo: user.pseudo,
                            avatarUrl: user.avatarUrl || "",
                        },
                    },
                },
            });
        },
        [navigation, user]
    );

    const openChat = async () => {
        if (loadingMsg) return;
        if (isSelf) return;

        const token = await AsyncStorage.getItem("token");
        if (!token) {
            Alert.alert("Erreur", "Tu n'es pas connecté.");
            return;
        }

        setLoadingMsg(true);
        try {
            const res = await fetch(`${API_URL}/api/conversations`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ otherUserId: user._id }),
            });

            const json = await safeJson(res);
            if (!res.ok) {
                console.log("create/open conversation error:", res.status, json);
                Alert.alert("Erreur", json?.error || "Impossible d'ouvrir la conversation.");
                return;
            }

            const conversationId =
                json?.conversationId || json?.conversation?._id || json?._id || null;

            if (!conversationId) {
                Alert.alert("Erreur", "Conversation introuvable.");
                return;
            }

            // ✅ IMPORTANT : on ouvre VRAIMENT le chat ici
            goToChat(conversationId);
        } finally {
            setLoadingMsg(false);
        }
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.userInfo} onPress={goToProfile} activeOpacity={0.8}>
                <Image
                    source={{ uri: user.avatarUrl || "https://picsum.photos/200" }}
                    style={styles.avatar}
                />
                <Text style={styles.pseudo} numberOfLines={1}>
                    {user.pseudo}
                </Text>
            </TouchableOpacity>

            {!isSelf && (
                <View style={styles.actions}>
                    {/* ✅ Message */}
                    <TouchableOpacity
                        style={[styles.msgBtn, loadingMsg && { opacity: 0.7 }]}
                        onPress={openChat}
                        disabled={loadingMsg}
                        activeOpacity={0.85}
                    >
                        {loadingMsg ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
                        )}
                    </TouchableOpacity>

                    {/* ✅ Follow */}
                    <TouchableOpacity
                        style={[
                            styles.followBtn,
                            isFollowing && styles.following,
                            loadingFollow && { opacity: 0.7 },
                        ]}
                        onPress={handleToggle}
                        disabled={loadingFollow}
                        activeOpacity={0.85}
                    >
                        {loadingFollow ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.followText}>
                                {isFollowing ? "Ne plus suivre" : "Suivre"}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderColor: "#222",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#000",
    },
    userInfo: { flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 12 },
    avatar: { width: 42, height: 42, borderRadius: 21, marginRight: 12, backgroundColor: "#111" },
    pseudo: { color: "#fff", fontSize: 16, fontWeight: "600", flexShrink: 1 },

    actions: { flexDirection: "row", alignItems: "center", gap: 10 },

    msgBtn: {
        width: 42,
        height: 38,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10,
        backgroundColor: "#222",
        borderWidth: 1,
        borderColor: "#2a2a2a",
    },

    followBtn: {
        minWidth: 120,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#5E17EB",
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
    },
    following: { backgroundColor: "#330000", borderWidth: 1, borderColor: "#FF4444" },
    followText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});