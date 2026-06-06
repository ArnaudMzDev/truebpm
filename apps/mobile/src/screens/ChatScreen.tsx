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
    Alert,
    Keyboard,
    TouchableWithoutFeedback,
    Modal,
    Pressable,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL, SOCKET_URL } from "../lib/config";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { io, Socket } from "socket.io-client";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius, typography, fontWeights, shadows } from "../theme";
import { getStoredToken } from "../lib/authStorage";

type OtherUser = {
    _id: string;
    pseudo: string;
    avatarUrl?: string;
    isOnline?: boolean;
    lastSeenAt?: string | null;
} | null;

type Msg = {
    _id: string;
    type: "text" | "post" | "image";
    text?: string;
    createdAt: string;
    senderId?: { _id: string; pseudo: string; avatarUrl?: string };
    postId?: any;
    imageUrl?: string;
    imageWidth?: number | null;
    imageHeight?: number | null;
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

function pad2(n: number) {
    return String(n).padStart(2, "0");
}

function formatTimeHHMM(dateString: string) {
    const d = new Date(dateString);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatLastSeen(dateString?: string | null) {
    if (!dateString) return "Hors ligne";

    const d = new Date(dateString);
    const now = new Date();

    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);

    if (diffMin < 1) return "Vu à l'instant";
    if (diffMin < 60) return `Vu il y a ${diffMin} min`;
    if (diffH < 24) return `Vu à ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    if (diffD < 7) return `Vu il y a ${diffD} j`;
    return `Vu le ${d.toLocaleDateString("fr-FR")}`;
}

function stripToken(raw: string | null) {
    if (!raw) return null;
    let t = raw.trim();
    if (!t) return null;

    if (t.toLowerCase().startsWith("bearer ")) t = t.slice(7).trim();

    if (
        (t.startsWith('"') && t.endsWith('"')) ||
        (t.startsWith("'") && t.endsWith("'"))
    ) {
        t = t.slice(1, -1).trim();
    }

    return t || null;
}

function toBearer(raw: string | null) {
    const token = stripToken(raw);
    return token ? `Bearer ${token}` : null;
}

function toRawToken(raw: string | null) {
    return stripToken(raw);
}

function uniqById(list: Msg[]) {
    const seen = new Set<string>();
    const out: Msg[] = [];
    for (const m of list) {
        const id = String(m?._id || "");
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(m);
    }
    return out;
}

async function uploadMessageImage(uri: string, bearerToken: string) {
    const form = new FormData();
    form.append(
        "file",
        {
            uri,
            name: `msg_${Date.now()}.jpg`,
            type: "image/jpeg",
        } as any
    );

    const res = await fetch(`${API_URL}/api/uploads/message-image`, {
        method: "POST",
        headers: { Authorization: bearerToken },
        body: form,
    });

    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || "Upload failed");
    return json as { imageUrl: string; width?: number; height?: number };
}

export default function ChatScreen({ route, navigation }: any) {
    const insets = useSafeAreaInsets();

    const conversationId: string = route?.params?.conversationId;
    const initialOtherUser: OtherUser = route?.params?.otherUser ?? null;
    const sharePostId: string | null = route?.params?.sharePostId ?? null;

    const [otherUser, setOtherUser] = useState<OtherUser>(initialOtherUser);

    const otherUserId = useMemo(
        () => (otherUser?._id ? String(otherUser._id) : null),
        [otherUser?._id]
    );

    const [meId, setMeId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState<Msg[]>([]);

    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);

    const [readAtOther, setReadAtOther] = useState<string | null>(null);

    const [otherTyping, setOtherTyping] = useState(false);
    const typingTimeoutRef = useRef<any>(null);
    const lastTypingSentRef = useRef(0);

    const [keyboardVisible, setKeyboardVisible] = useState(false);

    const [viewerVisible, setViewerVisible] = useState(false);
    const [viewerUri, setViewerUri] = useState<string | null>(null);

    const LIMIT = 30;
    const listRef = useRef<FlatList<Msg> | null>(null);

    const shareSentRef = useRef(false);
    const socketRef = useRef<Socket | null>(null);

    const meIdRef = useRef<string | null>(null);
    const otherIdRef = useRef<string | null>(null);

    useEffect(() => {
        meIdRef.current = meId;
    }, [meId]);

    useEffect(() => {
        otherIdRef.current = otherUserId;
    }, [otherUserId]);

    useEffect(() => {
        navigation.setOptions?.({ headerShown: false });
    }, [navigation]);

    useEffect(() => {
        const showSub = Keyboard.addListener(
            Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
            () => setKeyboardVisible(true)
        );

        const hideSub = Keyboard.addListener(
            Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
            () => setKeyboardVisible(false)
        );

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

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

    const fetchOtherUserPresence = useCallback(async () => {
        if (!otherUserId) return;

        const token = await getStoredToken();
        const res = await fetch(`${API_URL}/api/user/${otherUserId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const json = await safeJson(res);
        if (!res.ok || !json?.user) return;

        setOtherUser((prev) => ({
            ...(prev || {}),
            ...json.user,
        }));
    }, [otherUserId]);

    const scrollBottom = useCallback((animated = true) => {
        requestAnimationFrame(() => {
            listRef.current?.scrollToEnd?.({ animated });
        });
    }, []);

    const markAsRead = useCallback(async () => {
        const bearer = toBearer(await getStoredToken());
        if (!bearer) return;

        await fetch(`${API_URL}/api/conversations/${conversationId}/read`, {
            method: "POST",
            headers: { Authorization: bearer },
        }).catch(() => {});
    }, [conversationId]);

    const fetchReadState = useCallback(async () => {
        const bearer = toBearer(await getStoredToken());
        if (!bearer) return;

        const res = await fetch(`${API_URL}/api/conversations/${conversationId}`, {
            headers: { Authorization: bearer },
        });

        const json = await safeJson(res);
        if (!res.ok) return;

        setReadAtOther(json?.conversation?.readAtOther ?? null);
    }, [conversationId]);

    const fetchInitial = useCallback(async () => {
        const bearer = toBearer(await getStoredToken());
        if (!bearer) return;

        setLoading(true);
        setCursor(null);
        setHasMore(true);

        const res = await fetch(
            `${API_URL}/api/conversations/${conversationId}/messages?limit=${LIMIT}`,
            { headers: { Authorization: bearer } }
        );

        const json = await safeJson(res);
        if (!res.ok) {
            setMessages([]);
            setHasMore(false);
            setLoading(false);
            return;
        }

        const desc = (json?.messages || []) as Msg[];
        const asc = [...desc].reverse();
        setMessages(uniqById(asc));

        setCursor(json?.nextCursor || null);
        setHasMore(!!json?.nextCursor);

        setLoading(false);

        await Promise.all([
            markAsRead(),
            fetchReadState(),
            fetchOtherUserPresence(),
        ]);

        requestAnimationFrame(() => listRef.current?.scrollToEnd?.({ animated: false }));
    }, [conversationId, fetchOtherUserPresence, fetchReadState, markAsRead]);

    const loadMore = useCallback(async () => {
        if (!cursor || loadingMore || !hasMore) return;

        const bearer = toBearer(await getStoredToken());
        if (!bearer) return;

        setLoadingMore(true);
        try {
            const res = await fetch(
                `${API_URL}/api/conversations/${conversationId}/messages?limit=${LIMIT}&cursor=${encodeURIComponent(cursor)}`,
                { headers: { Authorization: bearer } }
            );

            const json = await safeJson(res);
            if (!res.ok) {
                setHasMore(false);
                return;
            }

            const desc = (json?.messages || []) as Msg[];
            const asc = [...desc].reverse();
            setMessages((prev) => uniqById([...asc, ...prev]));

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

    const title = useMemo(() => otherUser?.pseudo || "Chat", [otherUser]);

    const presenceLabel = useMemo(() => {
        if (otherUser?.isOnline) return "En ligne";
        return formatLastSeen(otherUser?.lastSeenAt || null);
    }, [otherUser?.isOnline, otherUser?.lastSeenAt]);

    const myLastMsg = useMemo(() => {
        if (!meId) return null;
        for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i];
            if (String(m?.senderId?._id) === String(meId)) return m;
        }
        return null;
    }, [messages, meId]);

    const myLastMsgId = myLastMsg?._id ? String(myLastMsg._id) : null;

    const myLastMsgSeen = useMemo(() => {
        if (!readAtOther || !myLastMsg) return false;
        return new Date(readAtOther).getTime() >= new Date(myLastMsg.createdAt).getTime();
    }, [myLastMsg, readAtOther]);

    const markAsReadRef = useRef(markAsRead);
    useEffect(() => {
        markAsReadRef.current = markAsRead;
    }, [markAsRead]);

    const scrollBottomRef = useRef(scrollBottom);
    useEffect(() => {
        scrollBottomRef.current = scrollBottom;
    }, [scrollBottom]);

    useEffect(() => {
        let alive = true;

        (async () => {
            try {
                if (!conversationId) return;

                const stored = await getStoredToken();
                const rawToken = toRawToken(stored);
                if (!rawToken) return;

                const s = io(SOCKET_URL, {
                    transports: ["websocket", "polling"],
                    auth: { token: rawToken },
                    reconnection: true,
                    reconnectionAttempts: Infinity,
                    reconnectionDelay: 500,
                    timeout: 10000,
                });

                socketRef.current = s;

                s.on("connect", () => {
                    if (!alive) return;
                    s.emit("conversation:join", { conversationId });
                    s.emit("read:mark", { conversationId });
                });

                s.on("message:new", ({ conversationId: cid, message }: any) => {
                    if (!alive) return;
                    if (String(cid) !== String(conversationId)) return;

                    const sender = String(message?.senderId?._id || "");
                    const myId = meIdRef.current;
                    if (myId && sender === String(myId)) return;

                    setOtherTyping(false);

                    setMessages((prev) => {
                        const next = uniqById([...prev, message as Msg]);
                        next.sort((a, b) => {
                            const ta = new Date(a.createdAt).getTime();
                            const tb = new Date(b.createdAt).getTime();
                            if (ta !== tb) return ta - tb;
                            return String(a._id).localeCompare(String(b._id));
                        });
                        return next;
                    });

                    scrollBottomRef.current(true);
                    markAsReadRef.current().catch(() => {});
                    s.emit("read:mark", { conversationId: cid });
                });

                s.on("typing:update", ({ conversationId: cid, userId, typing }: any) => {
                    if (!alive) return;
                    if (String(cid) !== String(conversationId)) return;

                    const otherId = otherIdRef.current;
                    if (!otherId) return;
                    if (String(userId) !== String(otherId)) return;

                    setOtherTyping(!!typing);
                });

                s.on("read:update", ({ conversationId: cid, userId, readAt }: any) => {
                    if (!alive) return;
                    if (String(cid) !== String(conversationId)) return;

                    const otherId = otherIdRef.current;
                    if (!otherId) return;
                    if (String(userId) !== String(otherId)) return;

                    setReadAtOther(readAt || null);
                });

                s.on("presence:update", ({ userId, isOnline, lastSeenAt }: any) => {
                    if (!alive) return;
                    const otherId = otherIdRef.current;
                    if (!otherId) return;
                    if (String(userId) !== String(otherId)) return;

                    setOtherUser((prev) =>
                        prev
                            ? {
                                ...prev,
                                isOnline: !!isOnline,
                                lastSeenAt: lastSeenAt || null,
                            }
                            : prev
                    );
                });
            } catch {}
        })();

        return () => {
            alive = false;

            const s = socketRef.current;
            if (s) {
                try {
                    s.emit("conversation:leave", { conversationId });
                    s.removeAllListeners();
                    s.disconnect();
                } catch {}
            }
            socketRef.current = null;

            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        };
    }, [conversationId]);

    const sendTyping = useCallback(
        (typing: boolean) => {
            const s = socketRef.current;
            if (!s || !s.connected) return;
            s.emit("typing:set", { conversationId, typing });
        },
        [conversationId]
    );

    const onChangeText = useCallback(
        (v: string) => {
            setText(v);

            const now = Date.now();
            if (now - lastTypingSentRef.current > 800) {
                lastTypingSentRef.current = now;
                sendTyping(true);
            }

            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                sendTyping(false);
            }, 1200);
        },
        [sendTyping]
    );

    const sendText = useCallback(async () => {
        const t = text.trim();
        if (!t || sending) return;

        const bearer = toBearer(await getStoredToken());
        if (!bearer) return;

        setSending(true);
        sendTyping(false);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;

        const tempId = `tmp_${Date.now()}`;
        const optimistic: Msg = {
            _id: tempId,
            type: "text",
            text: t,
            createdAt: new Date().toISOString(),
            senderId: meId ? { _id: meId, pseudo: "moi" } : undefined,
        };

        setMessages((prev) => uniqById([...prev, optimistic]));
        setText("");
        scrollBottom(true);

        try {
            const res = await fetch(`${API_URL}/api/conversations/${conversationId}/messages`, {
                method: "POST",
                headers: { Authorization: bearer, "Content-Type": "application/json" },
                body: JSON.stringify({ type: "text", text: t }),
            });

            const json = await safeJson(res);
            if (!res.ok) {
                setMessages((prev) => prev.filter((m) => m._id !== tempId));
                setText(t);
                return;
            }

            const created = json?.message as Msg;
            if (created?._id) {
                setMessages((prev) => prev.map((m) => (m._id === tempId ? created : m)));
            }

            setTimeout(() => fetchReadState(), 400);
        } finally {
            setSending(false);
        }
    }, [conversationId, fetchReadState, meId, scrollBottom, sending, sendTyping, text]);

    const sendImage = useCallback(async () => {
        if (sending) return;

        const bearer = toBearer(await getStoredToken());
        if (!bearer) return;

        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert("Permission", "Autorise l’accès aux photos pour envoyer une image.");
            return;
        }

        const picked = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
        });

        if (picked.canceled) return;

        setSending(true);
        sendTyping(false);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;

        const tempId = `tmp_img_${Date.now()}`;
        const optimistic: Msg = {
            _id: tempId,
            type: "image",
            createdAt: new Date().toISOString(),
            senderId: meId ? { _id: meId, pseudo: "moi" } : undefined,
            imageUrl: picked.assets[0].uri,
            imageWidth: picked.assets[0].width ?? null,
            imageHeight: picked.assets[0].height ?? null,
        };

        setMessages((prev) => uniqById([...prev, optimistic]));
        scrollBottom(true);

        try {
            const up = await uploadMessageImage(picked.assets[0].uri, bearer);

            const res = await fetch(`${API_URL}/api/conversations/${conversationId}/messages`, {
                method: "POST",
                headers: { Authorization: bearer, "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "image",
                    imageUrl: up.imageUrl,
                    imageWidth: up.width ?? null,
                    imageHeight: up.height ?? null,
                }),
            });

            const json = await safeJson(res);
            if (!res.ok) throw new Error();

            const created = json?.message as Msg;
            if (created?._id) {
                setMessages((prev) => prev.map((m) => (m._id === tempId ? created : m)));
            }

            setTimeout(() => fetchReadState(), 400);
        } catch {
            setMessages((prev) => prev.filter((m) => m._id !== tempId));
            Alert.alert("Erreur", "Impossible d’envoyer l’image.");
        } finally {
            setSending(false);
        }
    }, [conversationId, fetchReadState, meId, scrollBottom, sending, sendTyping]);

    const sendPost = useCallback(
        async (postId: string) => {
            if (!postId || sending) return;

            const bearer = toBearer(await getStoredToken());
            if (!bearer) return;

            setSending(true);
            sendTyping(false);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;

            const tempId = `tmp_post_${Date.now()}`;
            const optimistic: Msg = {
                _id: tempId,
                type: "post",
                createdAt: new Date().toISOString(),
                senderId: meId ? { _id: meId, pseudo: "moi" } : undefined,
                postId: { _id: postId },
            };

            setMessages((prev) => uniqById([...prev, optimistic]));
            scrollBottom(true);

            try {
                const res = await fetch(`${API_URL}/api/conversations/${conversationId}/messages`, {
                    method: "POST",
                    headers: { Authorization: bearer, "Content-Type": "application/json" },
                    body: JSON.stringify({ type: "post", postId }),
                });

                const json = await safeJson(res);
                if (!res.ok) {
                    setMessages((prev) => prev.filter((m) => m._id !== tempId));
                    return;
                }

                const created = json?.message as Msg;
                if (created?._id) {
                    setMessages((prev) => prev.map((m) => (m._id === tempId ? created : m)));
                }

                setTimeout(() => fetchReadState(), 400);
            } finally {
                setSending(false);
            }
        },
        [conversationId, fetchReadState, meId, scrollBottom, sending, sendTyping]
    );

    useEffect(() => {
        if (!sharePostId || shareSentRef.current) return;
        shareSentRef.current = true;
        sendPost(sharePostId).catch(() => {
            shareSentRef.current = false;
        });
    }, [sendPost, sharePostId]);

    const openImageViewer = useCallback((uri?: string | null) => {
        if (!uri) return;
        setViewerUri(uri);
        setViewerVisible(true);
    }, []);

    const renderItem = ({ item }: { item: Msg }) => {
        const mine = String(item?.senderId?._id) === String(meId);
        const time = formatTimeHHMM(item.createdAt);
        const isMyLast = mine && myLastMsgId && String(item._id) === String(myLastMsgId);

        const Status =
            isMyLast ? (
                <Text style={[styles.status, mine ? styles.statusMine : styles.statusOther]}>
                    {myLastMsgSeen ? "Vu" : "Envoyé"}
                </Text>
            ) : null;

        if (item.type === "image" && item.imageUrl) {
            const w = 220;
            const h =
                item.imageWidth && item.imageHeight
                    ? Math.round((w * item.imageHeight) / item.imageWidth)
                    : 260;

            return (
                <View style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
                    <TouchableOpacity
                        activeOpacity={0.92}
                        onPress={() => openImageViewer(item.imageUrl)}
                        style={[styles.bubble, styles.imageBubble, mine ? styles.bubbleMine : styles.bubbleOther]}
                    >
                        <Image
                            source={{ uri: item.imageUrl }}
                            style={{
                                width: w,
                                height: Math.min(320, Math.max(160, h)),
                                borderRadius: radius.lg,
                            }}
                            resizeMode="cover"
                        />
                    </TouchableOpacity>

                    <View style={[styles.metaRow, mine ? styles.metaMine : styles.metaOther]}>
                        <Text style={[styles.time, mine ? styles.timeMine : styles.timeOther]}>{time}</Text>
                        {Status}
                    </View>
                </View>
            );
        }

        if (item.type === "post" && item.postId) {
            const raw = item.postId;
            const p = raw?.repostOf ? raw.repostOf : raw;
            const pid = p?._id || raw?._id;

            const author = p?.userId || raw?.userId;
            const authorName = author?.pseudo || "Utilisateur";
            const authorAvatar = author?.avatarUrl || "https://picsum.photos/200";

            const trackTitle = p?.trackTitle || "Post partagé";
            const artist = p?.artist || "";
            const album = p?.albumName || p?.collectionName || p?.album || "";

            const isGeneral = p?.mode === "general";
            const ratingSimple = typeof p?.rating === "number" ? Number(p.rating) : null;
            const ratingAvg = (() => {
                const r = p?.ratings;
                if (!r || typeof r !== "object") return null;
                const vals = Object.values(r).filter((v) => typeof v === "number") as number[];
                if (!vals.length) return null;
                return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
            })();
            const ratingToShow = isGeneral ? ratingSimple : ratingAvg;

            const openPost = (id: string) => {
                if (!id) return;
                navigation.navigate("PostDetail", { postId: id });
            };

            return (
                <View style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => openPost(pid)}
                        style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}
                    >
                        <View style={styles.postHeaderRow}>
                            <Image source={{ uri: authorAvatar }} style={styles.postAuthorAvatar} />
                            <Text style={styles.postAuthorName} numberOfLines={1}>
                                {authorName}
                            </Text>

                            {typeof ratingToShow === "number" ? (
                                <View style={styles.postRatingPill}>
                                    <Ionicons name="star" size={14} color="#fff" />
                                    <Text style={styles.postRatingText}>{ratingToShow}</Text>
                                </View>
                            ) : null}
                        </View>

                        <View style={styles.postCard}>
                            <Image
                                source={{ uri: p?.coverUrl || "https://picsum.photos/200" }}
                                style={styles.postCover}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.msgText, mine ? styles.textMine : styles.textOther]} numberOfLines={1}>
                                    {trackTitle}
                                </Text>
                                {artist || album ? (
                                    <Text
                                        style={[styles.postArtist, mine ? { color: "#EEE" } : { color: colors.textMuted }]}
                                        numberOfLines={1}
                                    >
                                        {artist}
                                        {!!album ? ` • ${album}` : ""}
                                    </Text>
                                ) : null}
                            </View>
                        </View>
                    </TouchableOpacity>

                    <View style={[styles.metaRow, mine ? styles.metaMine : styles.metaOther]}>
                        <Text style={[styles.time, mine ? styles.timeMine : styles.timeOther]}>{time}</Text>
                        {Status}
                    </View>
                </View>
            );
        }

        return (
            <View style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                    <Text style={[styles.msgText, mine ? styles.textMine : styles.textOther]}>
                        {item.text || ""}
                    </Text>
                </View>

                <View style={[styles.metaRow, mine ? styles.metaMine : styles.metaOther]}>
                    <Text style={[styles.time, mine ? styles.timeMine : styles.timeOther]}>{time}</Text>
                    {Status}
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const composerBottom = keyboardVisible ? 8 : Math.max(insets.bottom, 12) + 10;

    return (
        <>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={0}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.flex}>
                        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} activeOpacity={0.85}>
                                <Ionicons name="chevron-back" size={22} color={colors.text} />
                            </TouchableOpacity>

                            <View style={styles.headerCenter}>
                                <View style={styles.headerAvatarWrap}>
                                    <Image
                                        source={{ uri: otherUser?.avatarUrl || "https://picsum.photos/200" }}
                                        style={styles.headerAvatar}
                                    />
                                    <View
                                        style={[
                                            styles.presenceDot,
                                            otherUser?.isOnline ? styles.presenceDotOnline : styles.presenceDotOffline,
                                        ]}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.headerTitle} numberOfLines={1}>
                                        {title}
                                    </Text>

                                    {otherTyping ? (
                                        <Text style={styles.typing}>écrit…</Text>
                                    ) : (
                                        <Text
                                            style={[
                                                styles.presence,
                                                otherUser?.isOnline ? styles.presenceOnline : styles.presenceOffline,
                                            ]}
                                        >
                                            {presenceLabel}
                                        </Text>
                                    )}
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.headerBtn}
                                activeOpacity={0.85}
                                onPress={() => {
                                    if (otherUser?._id) navigation.navigate("UserProfile", { userId: otherUser._id });
                                }}
                            >
                                <Ionicons name="person-outline" size={18} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            ref={(r) => {
                                listRef.current = r;
                            }}
                            data={messages}
                            keyExtractor={(m) => String(m._id)}
                            renderItem={renderItem}
                            contentContainerStyle={[
                                styles.messagesContent,
                                { paddingBottom: composerBottom + 88 },
                            ]}
                            onEndReached={loadMore}
                            onEndReachedThreshold={0.2}
                            ListHeaderComponent={
                                loadingMore ? (
                                    <ActivityIndicator color={colors.primary} style={{ marginBottom: 10 }} />
                                ) : null
                            }
                            keyboardShouldPersistTaps="handled"
                            maintainVisibleContentPosition={{
                                minIndexForVisible: 1,
                            }}
                            showsVerticalScrollIndicator={false}
                            onScrollBeginDrag={Keyboard.dismiss}
                        />

                        <View
                            style={[
                                styles.inputDock,
                                { bottom: composerBottom },
                            ]}
                        >
                            <View style={styles.inputRow}>
                                <TouchableOpacity
                                    onPress={sendImage}
                                    style={[styles.attachBtn, sending && { opacity: 0.6 }]}
                                    activeOpacity={0.85}
                                    disabled={sending}
                                >
                                    <Ionicons name="attach" size={18} color={colors.text} />
                                </TouchableOpacity>

                                <TextInput
                                    style={styles.input}
                                    value={text}
                                    onChangeText={onChangeText}
                                    placeholder="Message..."
                                    placeholderTextColor={colors.textFaint}
                                    multiline
                                />

                                <TouchableOpacity
                                    onPress={sendText}
                                    style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.6 }]}
                                    activeOpacity={0.85}
                                    disabled={!text.trim() || sending}
                                >
                                    <Ionicons name="send" size={18} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>

            <Modal visible={viewerVisible} transparent animationType="fade">
                <View style={styles.viewerOverlay}>
                    <Pressable style={styles.viewerClose} onPress={() => setViewerVisible(false)}>
                        <Ionicons name="close" size={26} color="#fff" />
                    </Pressable>

                    <Pressable style={styles.viewerBackdrop} onPress={() => setViewerVisible(false)}>
                        {viewerUri ? (
                            <Image
                                source={{ uri: viewerUri }}
                                style={styles.viewerImage}
                                resizeMode="contain"
                            />
                        ) : null}
                    </Pressable>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },

    container: {
        flex: 1,
        backgroundColor: colors.bg,
    },

    loading: {
        flex: 1,
        backgroundColor: colors.bg,
        justifyContent: "center",
        alignItems: "center",
    },

    header: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSoft,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#090B10",
    },

    headerBtn: {
        width: 40,
        height: 40,
        borderRadius: radius.lg,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface,
    },

    headerCenter: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        flex: 1,
        marginLeft: 8,
    },

    headerAvatarWrap: {
        position: "relative",
        borderRadius: 999,
        padding: 2,
        backgroundColor: colors.surface3,
    },

    headerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surface3,
    },

    presenceDot: {
        position: "absolute",
        right: -1,
        bottom: -1,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: "#090B10",
    },

    presenceDotOnline: {
        backgroundColor: "#2DD36F",
    },

    presenceDotOffline: {
        backgroundColor: colors.textFaint,
    },

    headerTitle: {
        color: colors.text,
        fontWeight: fontWeights.black,
        fontSize: 17,
        flexShrink: 1,
    },

    typing: {
        color: colors.primary,
        fontWeight: fontWeights.extraBold,
        fontSize: typography.caption,
        marginTop: 2,
    },

    presence: {
        fontWeight: fontWeights.bold,
        fontSize: typography.caption,
        marginTop: 2,
    },

    presenceOnline: {
        color: "#2DD36F",
    },

    presenceOffline: {
        color: colors.textMuted,
    },

    messagesContent: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.lg,
        paddingBottom: 12,
    },

    row: {
        marginVertical: 7,
    },

    rowMine: {
        alignItems: "flex-end",
    },

    rowOther: {
        alignItems: "flex-start",
    },

    bubble: {
        maxWidth: "84%",
        paddingVertical: 11,
        paddingHorizontal: spacing.md,
        borderRadius: 18,
    },

    imageBubble: {
        padding: 5,
    },

    bubbleMine: {
        backgroundColor: colors.primaryDark,
        borderTopRightRadius: 7,
        ...shadows.glowPrimary,
    },

    bubbleOther: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 7,
    },

    msgText: {
        fontSize: 15,
        lineHeight: 20,
        fontWeight: fontWeights.medium,
    },

    textMine: {
        color: colors.text,
    },

    textOther: {
        color: colors.textSoft,
    },

    metaRow: {
        flexDirection: "row",
        gap: 10,
        marginTop: 5,
        alignItems: "center",
    },

    metaMine: {
        justifyContent: "flex-end",
    },

    metaOther: {
        justifyContent: "flex-start",
    },

    time: {
        fontSize: 11,
        fontWeight: fontWeights.bold,
    },

    timeMine: {
        color: "#DDD2FF",
    },

    timeOther: {
        color: colors.textMuted,
    },

    status: {
        fontSize: 11,
        fontWeight: fontWeights.extraBold,
    },

    statusMine: {
        color: "#E7DDFF",
    },

    statusOther: {
        color: colors.textMuted,
    },

    postHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: spacing.sm,
    },

    postAuthorAvatar: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: colors.surface4,
    },

    postAuthorName: {
        fontSize: 13,
        fontWeight: fontWeights.black,
        flex: 1,
        color: colors.text,
    },

    postRatingPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: radius.pill,
        backgroundColor: "rgba(255,255,255,0.16)",
    },

    postRatingText: {
        color: colors.text,
        fontWeight: fontWeights.black,
        fontSize: 12,
    },

    postCard: {
        flexDirection: "row",
        gap: spacing.sm,
        alignItems: "center",
        minWidth: 230,
    },

    postCover: {
        width: 50,
        height: 50,
        borderRadius: radius.lg,
        backgroundColor: colors.surface4,
    },

    postArtist: {
        marginTop: 2,
        fontSize: 12,
        fontWeight: fontWeights.bold,
    },

    inputDock: {
        position: "absolute",
        left: spacing.md,
        right: spacing.md,
        zIndex: 20,
    },

    inputRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        gap: spacing.sm,
        padding: spacing.sm,
        backgroundColor: "rgba(9, 11, 16, 0.96)",
        borderRadius: radius.xxl,
        ...shadows.card,
    },

    attachBtn: {
        width: 44,
        height: 44,
        borderRadius: radius.lg,
        backgroundColor: colors.surface3,
        alignItems: "center",
        justifyContent: "center",
    },

    input: {
        flex: 1,
        minHeight: 44,
        maxHeight: 120,
        color: colors.text,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
    },

    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: radius.lg,
        backgroundColor: colors.primaryDark,
        alignItems: "center",
        justifyContent: "center",
        ...shadows.glowPrimary,
    },

    viewerOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.96)",
    },

    viewerClose: {
        position: "absolute",
        top: 56,
        right: 20,
        zIndex: 10,
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.08)",
    },

    viewerBackdrop: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
    },

    viewerImage: {
        width: "100%",
        height: "80%",
    },
});
