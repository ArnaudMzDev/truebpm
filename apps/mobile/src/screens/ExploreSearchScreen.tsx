import React, { useMemo, useState } from "react";
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useUser } from "../context/UserContext";

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
        return list.some(
            (id: any) => id?.toString?.() === user._id?.toString?.()
        );
    }, [me, user._id]);

    /* ----------------------------- */
    /*          ACTIONS              */
    /* ----------------------------- */

    const goToProfile = () => {
        navigation.push("UserProfile", { userId: user._id });
    };

    const handleToggleFollow = async () => {
        if (loadingFollow) return;
        setLoadingFollow(true);
        try {
            await toggleFollow(user._id);
        } finally {
            setLoadingFollow(false);
        }
    };

    const openChat = async () => {
        if (loadingMsg || isSelf) return;

        const token = await AsyncStorage.getItem("token");
        if (!token) {
            Alert.alert("Erreur", "Tu n'es pas connecté.");
            return;
        }

        setLoadingMsg(true);

        try {
            // ✅ créer ou récupérer la conversation
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
                Alert.alert(
                    "Erreur",
                    json?.error || "Impossible d'ouvrir la conversation."
                );
                return;
            }

            const conversationId =
                json?.conversation?._id || json?.conversationId || json?._id;

            if (!conversationId) {
                Alert.alert("Erreur", "Conversation introuvable.");
                return;
            }

            // ✅ navigation vers le TAB Messages puis Chat
            const tabsNav = navigation.getParent?.();
            (tabsNav || navigation).navigate("Notifications", {
                screen: "Chat",
                params: {
                    conversationId,
                    otherUser: {
                        _id: user._id,
                        pseudo: user.pseudo,
                        avatarUrl: user.avatarUrl || "",
                    },
                },
            });
        } finally {
            setLoadingMsg(false);
        }
    };

    /* ----------------------------- */
    /*              UI               */
    /* ----------------------------- */

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={styles.userInfo}
                onPress={goToProfile}
                activeOpacity={0.85}
            >
                <Image
                    source={{
                        uri: user.avatarUrl || "https://picsum.photos/200",
                    }}
                    style={styles.avatar}
                />
                <Text style={styles.pseudo} numberOfLines={1}>
                    {user.pseudo}
                </Text>
            </TouchableOpacity>

            {!isSelf && (
                <View style={styles.actions}>
                    {/* 💬 Message */}
                    <TouchableOpacity
                        style={[
                            styles.msgBtn,
                            loadingMsg && { opacity: 0.6 },
                        ]}
                        onPress={openChat}
                        disabled={loadingMsg}
                        activeOpacity={0.85}
                    >
                        {loadingMsg ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Ionicons
                                name="chatbubble-ellipses"
                                size={16}
                                color="#fff"
                            />
                        )}
                    </TouchableOpacity>

                    {/* ➕ Follow */}
                    <TouchableOpacity
                        style={[
                            styles.followBtn,
                            isFollowing && styles.following,
                            loadingFollow && { opacity: 0.6 },
                        ]}
                        onPress={handleToggleFollow}
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

/* ----------------------------- */
/*             STYLES            */
/* ----------------------------- */

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

    userInfo: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        paddingRight: 12,
    },

    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        marginRight: 12,
        backgroundColor: "#111",
    },

    pseudo: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
        flexShrink: 1,
    },

    actions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

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

    following: {
        backgroundColor: "#330000",
        borderWidth: 1,
        borderColor: "#FF4444",
    },

    followText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "700",
    },
});