import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { io, Socket } from "socket.io-client";

import { API_URL, SOCKET_URL } from "../lib/config";
import AppScreen from "../components/ui/AppScreen";
import AppHeader from "../components/ui/AppHeader";
import AppCard from "../components/ui/AppCard";
import AppScreenLoader from "../components/ui/AppScreenLoader";
import { colors, spacing, radius, typography, fontWeights } from "../theme";
import { getStoredToken } from "../lib/authStorage";

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
    if (c.lastMessageType === "post") return c.lastMessageText || "Post partagé";
    if (c.lastMessageType === "image") return c.lastMessageText || "Photo";
    return c.lastMessageText || "—";
}

function getPreviewIcon(type?: Conversation["lastMessageType"]) {
    if (type === "post") return "musical-notes-outline";
    if (type === "image") return "image-outline";
    return "chatbubble-ellipses-outline";
}

function formatConversationTime(dateString?: string | null) {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();

    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay) {
        return date.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    const diffMs = now.getTime() - date.getTime();
    const diffD = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffD < 7) {
        return date.toLocaleDateString("fr-FR", { weekday: "short" });
    }

    return date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
    });
}

function ConversationRow({
                             item,
                             meId,
                             onPress,
                         }: {
    item: Conversation;
    meId: string | null;
    onPress: () => void;
}) {
    const other =
        item.participants?.find((p) => p?._id?.toString?.() !== meId?.toString?.()) ??
        item.participants?.[0] ??
        null;

    const unread = (item.unreadCount ?? 0) > 0;
    const preview = formatPreview(item);
    const timeLabel = formatConversationTime(item.lastMessageAt || item.updatedAt || null);
    const previewIcon = getPreviewIcon(item.lastMessageType);

    return (
        <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
            <AppCard style={[styles.rowCard, unread && styles.rowCardUnread]}>
                <View style={styles.row}>
                    <View style={styles.avatarWrap}>
                        <Image
                            source={{ uri: other?.avatarUrl || "https://picsum.photos/200" }}
                            style={styles.avatar}
                        />
                        {unread ? <View style={styles.unreadDot} /> : null}
                    </View>

                    <View style={styles.content}>
                        <View style={styles.topLine}>
                            <View style={styles.nameLine}>
                                <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>
                                    {other?.pseudo || "Conversation"}
                                </Text>
                                {unread ? <View style={styles.unreadPillMini} /> : null}
                            </View>

                            <View style={styles.topRight}>
                                {timeLabel ? <Text style={styles.time}>{timeLabel}</Text> : null}
                            </View>
                        </View>

                        <View style={styles.previewLine}>
                            <View style={[styles.previewIconWrap, unread && styles.previewIconWrapUnread]}>
                                <Ionicons
                                    name={previewIcon as keyof typeof Ionicons.glyphMap}
                                    size={13}
                                    color={unread ? colors.primary : colors.textMuted}
                                />
                            </View>

                            <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
                                {preview}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.trailing}>
                        {(item.unreadCount ?? 0) > 0 ? (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>
                                    {item.unreadCount! > 99 ? "99+" : item.unreadCount}
                                </Text>
                            </View>
                        ) : (
                            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                        )}
                    </View>
                </View>
            </AppCard>
        </TouchableOpacity>
    );
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
        const token = await getStoredToken();
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
            const stored = await getStoredToken();
            const rawToken = stripToken(stored);
            if (!rawToken) return;

            const s = io(SOCKET_URL, {
                transports: ["websocket", "polling"],
                auth: { token: rawToken },
                reconnection: true,
            });

            socketRef.current = s;

            s.on("conversations:invalidate", async () => {
                if (!alive) return;
                await fetchConversations();
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
    const subtitle = useMemo(
        () =>
            sharePostId
                ? "Choisis une conversation pour partager ce post"
                : "Retrouve toutes tes conversations",
        [sharePostId]
    );

    const ListHeader = () => (
        <View style={styles.listHeader}>
            {sharePostId ? (
                <View style={styles.shareBanner}>
                    <View style={styles.shareIconWrap}>
                        <Ionicons name="paper-plane-outline" size={16} color={colors.primary} />
                    </View>
                    <View style={styles.shareCopy}>
                        <Text style={styles.shareTitle}>Partager un post</Text>
                        <Text style={styles.shareText}>Choisis une conversation pour envoyer ce morceau.</Text>
                    </View>
                </View>
            ) : (
                <View style={styles.inboxIntro}>
                    <Text style={styles.inboxEyebrow}>Inbox</Text>
                    <Text style={styles.inboxTitle}>{conversations.length} conversation{conversations.length > 1 ? "s" : ""}</Text>
                </View>
            )}
        </View>
    );

    if (loading) {
        return <AppScreenLoader label="Chargement des conversations..." />;
    }

    return (
        <AppScreen>
            <AppHeader title={title} subtitle={subtitle} />

            <FlatList
                data={conversations}
                keyExtractor={(c) => c._id}
                renderItem={({ item }) => (
                    <ConversationRow
                        item={item}
                        meId={meId}
                        onPress={() => openConversation(item)}
                    />
                )}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={ListHeader}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primary}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyBox}>
                        <View style={styles.emptyIconWrap}>
                            <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
                        </View>
                        <Text style={styles.emptyTitle}>Aucune conversation</Text>
                        <Text style={styles.emptyText}>
                            Tes messages et partages de posts apparaîtront ici.
                        </Text>
                    </View>
                }
            />
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    listContent: {
        paddingBottom: 120,
    },

    listHeader: {
        marginBottom: spacing.sm,
    },

    inboxIntro: {
        marginBottom: spacing.xs,
        paddingHorizontal: spacing.xs,
    },

    inboxEyebrow: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        letterSpacing: 1,
        textTransform: "uppercase",
        marginBottom: 3,
    },

    inboxTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: fontWeights.black,
    },

    shareBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        backgroundColor: "#111018",
        borderWidth: 1,
        borderColor: colors.borderAccent,
        borderRadius: radius.xl,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },

    shareIconWrap: {
        width: 38,
        height: 38,
        borderRadius: radius.lg,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#151122",
        borderWidth: 1,
        borderColor: colors.borderAccent,
    },

    shareCopy: {
        flex: 1,
        minWidth: 0,
    },

    shareTitle: {
        color: colors.text,
        fontSize: typography.body,
        fontWeight: fontWeights.black,
    },

    shareText: {
        color: colors.textMuted,
        fontSize: typography.caption,
        fontWeight: fontWeights.medium,
        marginTop: 3,
    },

    rowCard: {
        marginBottom: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
    },

    rowCardUnread: {
        borderColor: colors.borderAccent,
        backgroundColor: "#10131B",
    },

    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
    },

    avatarWrap: {
        position: "relative",
        borderRadius: 999,
        padding: 2,
        backgroundColor: colors.surface3,
        borderWidth: 1,
        borderColor: colors.border,
    },

    avatar: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: colors.surface3,
    },

    unreadDot: {
        position: "absolute",
        right: 0,
        top: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.primary,
        borderWidth: 2,
        borderColor: colors.bg,
    },

    content: {
        flex: 1,
        minWidth: 0,
    },

    nameLine: {
        flex: 1,
        minWidth: 0,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
    },

    topLine: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.sm,
    },

    topRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },

    previewLine: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        marginTop: 7,
    },

    previewIconWrap: {
        width: 22,
        height: 22,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface3,
        borderWidth: 1,
        borderColor: colors.border,
    },

    previewIconWrapUnread: {
        backgroundColor: "#151122",
        borderColor: colors.borderAccent,
    },

    name: {
        color: colors.text,
        fontWeight: fontWeights.extraBold,
        fontSize: 16,
        flex: 1,
    },

    nameUnread: {
        fontWeight: fontWeights.black,
    },

    preview: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.medium,
        flex: 1,
    },

    previewUnread: {
        color: colors.textSoft,
        fontWeight: fontWeights.bold,
    },

    time: {
        color: colors.textMuted,
        fontSize: typography.caption,
        fontWeight: fontWeights.medium,
    },

    trailing: {
        width: 30,
        alignItems: "flex-end",
    },

    unreadPillMini: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: colors.primary,
    },

    badge: {
        minWidth: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 6,
    },

    badgeText: {
        color: colors.bg,
        fontSize: 11,
        fontWeight: fontWeights.black,
    },

    emptyBox: {
        marginTop: 44,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.xl,
    },

    emptyIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#151122",
        borderWidth: 1,
        borderColor: colors.borderAccent,
        marginBottom: 14,
    },

    emptyTitle: {
        color: colors.text,
        fontSize: typography.subtitle,
        fontWeight: fontWeights.black,
        marginBottom: 6,
    },

    emptyText: {
        color: colors.textMuted,
        textAlign: "center",
        fontSize: typography.body,
        lineHeight: 20,
    },
});
