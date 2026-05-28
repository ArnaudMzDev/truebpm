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
import { API_URL } from "../lib/config";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography, fontWeights } from "../theme";
import { getStoredToken } from "../lib/authStorage";

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
        if (__DEV__) console.log("Non-JSON response:", text.slice(0, 200));
        return null;
    }
}

export default function UserListItem({ user, navigation }: Props) {
    const { me, toggleFollow } = useUser();
    if (!user || !user._id) return null;

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
                screen: "MessagesTab",
                params: {
                    screen: "Chat",
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

        const token = await getStoredToken();
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
                            <ActivityIndicator size="small" color={colors.text} />
                        ) : (
                            <Ionicons name="chatbubble-ellipses" size={16} color={colors.text} />
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
                            <ActivityIndicator size="small" color={colors.text} />
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
        marginBottom: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderWidth: 1,
        borderColor: colors.borderSoft,
        borderRadius: radius.xl,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: colors.surface2,
    },
    userInfo: { flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 12 },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: spacing.md,
        backgroundColor: colors.surface4,
        borderWidth: 1,
        borderColor: colors.border,
    },
    pseudo: { color: colors.text, fontSize: 16, fontWeight: fontWeights.extraBold, flexShrink: 1 },

    actions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },

    msgBtn: {
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.md,
        backgroundColor: colors.surface3,
        borderWidth: 1,
        borderColor: colors.border,
    },

    followBtn: {
        minWidth: 104,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primaryDark,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: radius.md,
    },
    following: { backgroundColor: "#24151B", borderWidth: 1, borderColor: colors.danger },
    followText: { color: colors.text, fontSize: typography.bodySm, fontWeight: fontWeights.extraBold },
});
