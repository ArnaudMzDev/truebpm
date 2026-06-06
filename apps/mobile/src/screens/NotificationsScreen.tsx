import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { io, Socket } from "socket.io-client";
import { Ionicons } from "@expo/vector-icons";

import { API_URL, SOCKET_URL } from "../lib/config";
import AppScreen from "../components/ui/AppScreen";
import AppHeader from "../components/ui/AppHeader";
import AppCard from "../components/ui/AppCard";
import AppScreenLoader from "../components/ui/AppScreenLoader";
import { colors, spacing, radius, typography, fontWeights, shadows } from "../theme";
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
        case "follow_request":
            return `${actor} a demandé à te suivre`;
        case "follow_accept":
            return `${actor} a accepté ta demande d'abonnement`;
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

function getTypeMeta(type: string) {
    switch (type) {
        case "follow":
            return {
                icon: "person-add" as keyof typeof Ionicons.glyphMap,
                pill: "Nouveau follow",
                accent: "#4ADE80",
                bg: "#0F1A12",
                border: "#1D3322",
                soft: "rgba(74, 222, 128, 0.12)",
            };
        case "follow_request":
            return {
                icon: "mail-open-outline" as keyof typeof Ionicons.glyphMap,
                pill: "Demande",
                accent: colors.primary,
                bg: "#151022",
                border: colors.borderAccent,
                soft: "rgba(155, 92, 255, 0.12)",
            };
        case "follow_accept":
            return {
                icon: "checkmark-circle-outline" as keyof typeof Ionicons.glyphMap,
                pill: "Acceptée",
                accent: "#22C55E",
                bg: "#101A13",
                border: "#1E3826",
                soft: "rgba(34, 197, 94, 0.12)",
            };
        case "like_post":
        case "like_comment":
            return {
                icon: "heart" as keyof typeof Ionicons.glyphMap,
                pill: "Like",
                accent: colors.danger,
                bg: "#1A1013",
                border: "#352027",
                soft: "rgba(255, 77, 109, 0.12)",
            };
        case "comment_post":
            return {
                icon: "chatbubble-ellipses" as keyof typeof Ionicons.glyphMap,
                pill: "Commentaire",
                accent: colors.info,
                bg: "#0E1720",
                border: "#1E3142",
                soft: "rgba(56, 189, 248, 0.12)",
            };
        case "reply_comment":
            return {
                icon: "return-up-forward" as keyof typeof Ionicons.glyphMap,
                pill: "Réponse",
                accent: colors.warning,
                bg: "#1A140A",
                border: "#3B2C12",
                soft: "rgba(245, 158, 11, 0.12)",
            };
        case "repost_post":
            return {
                icon: "repeat" as keyof typeof Ionicons.glyphMap,
                pill: "Repost",
                accent: "#A78BFA",
                bg: "#14111E",
                border: "#2E2742",
                soft: "rgba(167, 139, 250, 0.12)",
            };
        default:
            return {
                icon: "notifications-outline" as keyof typeof Ionicons.glyphMap,
                pill: "Activité",
                accent: colors.primary,
                bg: colors.surface,
                border: colors.border,
                soft: "rgba(155, 92, 255, 0.12)",
            };
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

function NotificationCard({
                              item,
                              onPress,
                          }: {
    item: any;
    onPress: () => void;
}) {
    const meta = getTypeMeta(item?.type);
    const actorAvatar = item?.actorId?.avatarUrl || "https://picsum.photos/200";
    const postCover = item?.postId?.coverUrl || null;
    const postTitle = item?.postId?.trackTitle || "";
    const postArtist = item?.postId?.artist || "";

    return (
        <TouchableOpacity activeOpacity={0.92} onPress={onPress}>
            <AppCard
                style={[
                    styles.card,
                    {
                        backgroundColor: meta.bg,
                        borderColor: meta.border,
                    },
                ]}
            >
                <View style={styles.cardTop}>
                    <View style={styles.leftBlock}>
                        <View style={styles.avatarWrap}>
                            <Image source={{ uri: actorAvatar }} style={styles.avatar} />
                            <View style={[styles.iconBadge, { backgroundColor: meta.accent }]}>
                                <Ionicons name={meta.icon} size={12} color="#fff" />
                            </View>
                        </View>

                        <View style={styles.mainContent}>
                            <View style={styles.topLine}>
                                <View
                                    style={[
                                        styles.pill,
                                        {
                                            borderColor: meta.accent,
                                            backgroundColor: meta.soft,
                                        },
                                    ]}
                                >
                                    <Text style={[styles.pillText, { color: meta.accent }]}>
                                        {meta.pill}
                                    </Text>
                                </View>

                                <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
                            </View>

                            <Text style={styles.text}>{getNotificationText(item)}</Text>
                        </View>
                    </View>

                    <View style={styles.chevronWrap}>
                        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                    </View>
                </View>

                {item?.commentId?.text ? (
                    <View style={styles.commentPreview}>
                        <View style={styles.previewHead}>
                            <Ionicons
                                name="chatbubble-ellipses-outline"
                                size={13}
                                color={colors.primary}
                            />
                            <Text style={styles.commentPreviewLabel}>Commentaire</Text>
                        </View>

                        <Text style={styles.commentPreviewText} numberOfLines={2}>
                            {item.commentId.text}
                        </Text>
                    </View>
                ) : null}

                {item?.postId?._id ? (
                    <View style={styles.postPreview}>
                        {postCover ? (
                            <Image source={{ uri: postCover }} style={styles.postCover} />
                        ) : (
                            <View style={styles.postCoverFallback}>
                                <Ionicons
                                    name="musical-notes"
                                    size={16}
                                    color={colors.textMuted}
                                />
                            </View>
                        )}

                        <View style={styles.postPreviewContent}>
                            <View style={styles.previewHead}>
                                <Ionicons
                                    name="musical-notes-outline"
                                    size={13}
                                    color={colors.primary}
                                />
                                <Text style={styles.postPreviewLabel}>Post concerné</Text>
                            </View>

                            <Text style={styles.postTitle} numberOfLines={1}>
                                {postTitle || "Post musical"}
                            </Text>
                            <Text style={styles.postArtist} numberOfLines={1}>
                                {postArtist || "Voir le post"}
                            </Text>
                        </View>
                    </View>
                ) : null}
            </AppCard>
        </TouchableOpacity>
    );
}

export default function NotificationsScreen({ navigation }: any) {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    const fetchNotifications = useCallback(async () => {
        const token = await getStoredToken();
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
        const token = await getStoredToken();
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
            const stored = await getStoredToken();
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
        return <AppScreenLoader label="Chargement des notifications..." />;
    }

    return (
        <AppScreen>
            <AppHeader
                title="Notifications"
            />

            <FlatList
                data={items}
                keyExtractor={(item) => item._id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
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
                            <Ionicons
                                name="notifications-off-outline"
                                size={20}
                                color={colors.primary}
                            />
                        </View>
                        <Text style={styles.emptyTitle}>Aucune notification</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <NotificationCard item={item} onPress={() => openItem(item)} />
                )}
            />
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    listContent: {
        paddingBottom: 120,
    },

    card: {
        marginBottom: spacing.md,
        ...shadows.glowPrimary,
        shadowOpacity: 0.08,
    },

    cardTop: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: spacing.sm,
    },

    leftBlock: {
        flexDirection: "row",
        flex: 1,
        gap: spacing.md,
    },

    avatarWrap: {
        position: "relative",
        width: 50,
        height: 50,
    },

    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: colors.surface3,
    },

    iconBadge: {
        position: "absolute",
        right: -2,
        bottom: -2,
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: colors.bg,
    },

    mainContent: {
        flex: 1,
        minWidth: 0,
    },

    topLine: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.sm,
        marginBottom: 8,
    },

    pill: {
        borderWidth: 1,
        borderRadius: radius.pill,
        paddingHorizontal: 9,
        paddingVertical: 4,
    },

    pillText: {
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
    },

    text: {
        color: colors.text,
        fontSize: typography.body,
        fontWeight: fontWeights.bold,
        lineHeight: 20,
    },

    date: {
        color: colors.textMuted,
        fontSize: typography.caption,
        flexShrink: 0,
    },

    chevronWrap: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.04)",
    },

    commentPreview: {
        marginTop: spacing.md,
        backgroundColor: "rgba(15, 18, 24, 0.62)",
        borderRadius: radius.xl,
        padding: spacing.md,
    },

    previewHead: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginBottom: 6,
    },

    commentPreviewLabel: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        textTransform: "uppercase",
    },

    commentPreviewText: {
        color: colors.textSoft,
        fontSize: typography.bodySm,
        lineHeight: 18,
    },

    postPreview: {
        marginTop: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        backgroundColor: "rgba(15, 18, 24, 0.62)",
        borderRadius: radius.xl,
        padding: 10,
    },

    postPreviewContent: {
        flex: 1,
        minWidth: 0,
    },

    postCover: {
        width: 52,
        height: 52,
        borderRadius: 10,
        backgroundColor: colors.surface3,
    },

    postCoverFallback: {
        width: 52,
        height: 52,
        borderRadius: 10,
        backgroundColor: colors.surface3,
        alignItems: "center",
        justifyContent: "center",
    },

    postPreviewLabel: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        textTransform: "uppercase",
    },

    postTitle: {
        color: colors.text,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.extraBold,
    },

    postArtist: {
        color: colors.textMuted,
        fontSize: typography.caption,
        marginTop: 3,
    },

    emptyBox: {
        marginTop: 44,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.xl,
    },

    emptyIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primaryFaint,
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
