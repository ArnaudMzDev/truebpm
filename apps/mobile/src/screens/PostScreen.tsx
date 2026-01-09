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

import PostCard from "../components/PostCard";
import { PostType } from "../components/PostCard/types";

const localIP = Constants.expoConfig?.hostUri?.split(":")[0];
const API_URL = `http://${localIP}:3000`;

type CommentUser = { pseudo: string; avatarUrl?: string; _id: string };

type CommentType = {
    _id: string;
    text: string;
    createdAt: string;
    userId: CommentUser;
    repliesCount?: number;
    directRepliesCount?: number;

    // ✅ likes
    likesCount?: number;
    likedByMe?: boolean;
};

type ReplyType = {
    _id: string;
    text: string;
    createdAt: string;
    userId: CommentUser;
    parentId: string;
    rootId: string;
    depth: number;
    replyToUserId?: { pseudo: string } | null;

    // ✅ likes
    likesCount?: number;
    likedByMe?: boolean;
};

async function safeJson(res: Response) {
    const txt = await res.text();
    if (!txt) return null;
    try {
        return JSON.parse(txt);
    } catch {
        console.log("Non-JSON response:", txt.slice(0, 200));
        return null;
    }
}

export default function PostScreen({ route, navigation }: any) {
    const { postId } = route.params;

    const [post, setPost] = useState<PostType | null>(null);
    const [loadingPost, setLoadingPost] = useState(true);

    const [comments, setComments] = useState<CommentType[]>([]);
    const [loadingComments, setLoadingComments] = useState(true);

    // composer
    const [text, setText] = useState("");
    const [replyTo, setReplyTo] = useState<(CommentType | ReplyType) | null>(null);

    const placeholder = useMemo(
        () => (replyTo ? `Répondre à ${replyTo.userId.pseudo}…` : "Écrire un commentaire…"),
        [replyTo]
    );

    // threads state
    const [threadOpen, setThreadOpen] = useState<Record<string, boolean>>({});
    const [threadReplies, setThreadReplies] = useState<Record<string, ReplyType[]>>({});
    const [threadCursor, setThreadCursor] = useState<Record<string, string | null>>({});
    const [threadHasMore, setThreadHasMore] = useState<Record<string, boolean>>({});
    const [threadLoading, setThreadLoading] = useState<Record<string, boolean>>({});

    // anti double tap likes
    const [likeLoading, setLikeLoading] = useState<Record<string, boolean>>({});

    // refs pour éviter stale state dans fetchThread
    const threadCursorRef = useRef<Record<string, string | null>>({});
    useEffect(() => {
        threadCursorRef.current = threadCursor;
    }, [threadCursor]);

    const openUserProfile = useCallback(
        (userId?: string) => {
            if (!userId) return;
            navigation.push("UserProfile", { userId });
        },
        [navigation]
    );

    const fetchPost = useCallback(async () => {
        setLoadingPost(true);
        const token = await AsyncStorage.getItem("token");

        const res = await fetch(`${API_URL}/api/posts/${postId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const json = await safeJson(res);
        if (res.ok) setPost(json?.post ?? null);
        setLoadingPost(false);
    }, [postId]);

    const fetchComments = useCallback(async () => {
        setLoadingComments(true);
        const token = await AsyncStorage.getItem("token");

        const res = await fetch(`${API_URL}/api/posts/${postId}/comments?limit=50`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const json = await safeJson(res);
        if (res.ok) setComments(json?.comments ?? []);
        setLoadingComments(false);
    }, [postId]);

    useEffect(() => {
        fetchPost();
        fetchComments();
    }, [fetchPost, fetchComments]);

    // fetch 10 replies (thread)
    const fetchThread = useCallback(
        async (rootId: string, mode: "initial" | "more" = "initial") => {
            if (threadLoading[rootId]) return;

            setThreadLoading((m) => ({ ...m, [rootId]: true }));
            try {
                const cursor = mode === "more" ? threadCursorRef.current[rootId] : null;

                const url =
                    `${API_URL}/api/comments/${rootId}/thread?limit=10` +
                    (cursor ? `&cursor=${encodeURIComponent(cursor)}` : "");

                const token = await AsyncStorage.getItem("token");
                const res = await fetch(url, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });

                const json = await safeJson(res);
                if (!res.ok) {
                    console.log("fetchThread error:", res.status, json);
                    return;
                }

                const newItems: ReplyType[] = json?.replies ?? [];
                const next: string | null = json?.nextCursor ?? null;

                setThreadReplies((m) => ({
                    ...m,
                    [rootId]: mode === "more" ? [...(m[rootId] ?? []), ...newItems] : newItems,
                }));

                setThreadCursor((m) => {
                    const nextMap = { ...m, [rootId]: next };
                    threadCursorRef.current = nextMap;
                    return nextMap;
                });

                setThreadHasMore((m) => ({ ...m, [rootId]: !!next }));
            } finally {
                setThreadLoading((m) => ({ ...m, [rootId]: false }));
            }
        },
        [threadLoading]
    );

    const toggleThread = useCallback(
        async (rootId: string) => {
            const willOpen = !threadOpen[rootId];

            setThreadOpen((m) => ({ ...m, [rootId]: willOpen }));

            if (willOpen && !threadReplies[rootId]) {
                await fetchThread(rootId, "initial");
            }
        },
        [threadOpen, threadReplies, fetchThread]
    );

    // ✅ like comment/reply (optimiste + rollback)
    const toggleLike = useCallback(
        async (commentId: string, where: { type: "comment" } | { type: "reply"; rootId: string }) => {
            if (likeLoading[commentId]) return;

            const token = await AsyncStorage.getItem("token");
            if (!token) return;

            setLikeLoading((m) => ({ ...m, [commentId]: true }));

            // snapshot + optimistic
            let prevLiked = false;
            let prevCount = 0;

            const applyOptimistic = () => {
                if (where.type === "comment") {
                    const t = comments.find((c) => c._id === commentId);
                    prevLiked = !!t?.likedByMe;
                    prevCount = t?.likesCount ?? 0;

                    const nextLiked = !prevLiked;
                    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));

                    setComments((prev) =>
                        prev.map((c) => (c._id === commentId ? { ...c, likedByMe: nextLiked, likesCount: nextCount } : c))
                    );
                } else {
                    const arr = threadReplies[where.rootId] ?? [];
                    const t = arr.find((r) => r._id === commentId);
                    prevLiked = !!t?.likedByMe;
                    prevCount = t?.likesCount ?? 0;

                    const nextLiked = !prevLiked;
                    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));

                    setThreadReplies((prev) => ({
                        ...prev,
                        [where.rootId]: (prev[where.rootId] ?? []).map((r) =>
                            r._id === commentId ? { ...r, likedByMe: nextLiked, likesCount: nextCount } : r
                        ),
                    }));
                }
            };

            const rollback = () => {
                if (where.type === "comment") {
                    setComments((prev) =>
                        prev.map((c) => (c._id === commentId ? { ...c, likedByMe: prevLiked, likesCount: prevCount } : c))
                    );
                } else {
                    setThreadReplies((prev) => ({
                        ...prev,
                        [where.rootId]: (prev[where.rootId] ?? []).map((r) =>
                            r._id === commentId ? { ...r, likedByMe: prevLiked, likesCount: prevCount } : r
                        ),
                    }));
                }
            };

            applyOptimistic();

            try {
                const res = await fetch(`${API_URL}/api/comments/${commentId}/like`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                });

                const json = await safeJson(res);
                if (!res.ok) {
                    rollback();
                    return;
                }

                const serverLiked = !!json?.likedByMe; // grâce à la réponse améliorée
                const serverCount = typeof json?.likesCount === "number" ? json.likesCount : undefined;

                if (where.type === "comment") {
                    setComments((prev) =>
                        prev.map((c) =>
                            c._id === commentId
                                ? { ...c, likedByMe: serverLiked, likesCount: serverCount ?? c.likesCount }
                                : c
                        )
                    );
                } else {
                    setThreadReplies((prev) => ({
                        ...prev,
                        [where.rootId]: (prev[where.rootId] ?? []).map((r) =>
                            r._id === commentId
                                ? { ...r, likedByMe: serverLiked, likesCount: serverCount ?? r.likesCount }
                                : r
                        ),
                    }));
                }
            } finally {
                setLikeLoading((m) => ({ ...m, [commentId]: false }));
            }
        },
        [comments, likeLoading, threadReplies]
    );

    // submit comment/reply
    const submit = useCallback(async () => {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        const clean = text.trim();
        if (!clean) return;

        setText("");

        // reply cascade
        if (replyTo) {
            const res = await fetch(`${API_URL}/api/comments/${replyTo._id}/replies`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ text: clean }),
            });

            const json = await safeJson(res);
            if (!res.ok) {
                setText(clean);
                return;
            }

            const created: ReplyType | undefined = json?.reply;
            if (created?._id) {
                const rootId =
                    created.rootId ||
                    (("rootId" in replyTo && (replyTo as any).rootId) ? (replyTo as any).rootId : null) ||
                    ("_id" in replyTo ? replyTo._id : "");

                setThreadOpen((m) => ({ ...m, [rootId]: true }));

                setThreadReplies((m) => ({
                    ...m,
                    [rootId]: [created, ...(m[rootId] ?? [])],
                }));

                setComments((prev) =>
                    prev.map((c) => (c._id === rootId ? { ...c, repliesCount: (c.repliesCount || 0) + 1 } : c))
                );

                setPost((p) => (p ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p));
                setReplyTo(null);
            }
            return;
        }

        // top-level comment
        const res = await fetch(`${API_URL}/api/posts/${postId}/comments`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ text: clean }),
        });

        const json = await safeJson(res);
        if (!res.ok) {
            setText(clean);
            return;
        }

        const created: CommentType | undefined = json?.comment;
        if (created?._id) {
            setComments((prev) => [created, ...prev]);
            setPost((p) => (p ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p));
        }
    }, [postId, replyTo, text]);

    const UserLine = ({ u }: { u: CommentUser }) => {
        const uri = u.avatarUrl || "https://picsum.photos/200";
        return (
            <TouchableOpacity onPress={() => openUserProfile(u._id)} activeOpacity={0.85} style={styles.userLine}>
                <Image source={{ uri }} style={styles.avatar} />
                <Text style={styles.pseudo}>{u.pseudo || "Utilisateur"}</Text>
            </TouchableOpacity>
        );
    };

    const LikeChip = ({ liked, count, onPress, disabled }: any) => (
        <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.likeBtn} disabled={disabled}>
            <Ionicons
                name={(liked ? "heart" : "heart-outline") as any}
                size={16}
                color={liked ? "#ff4d6d" : "#bbb"}
            />
            <Text style={styles.likeCount}>{count}</Text>
        </TouchableOpacity>
    );

    const renderReply = (r: ReplyType) => {
        const left = Math.min(48, Math.max(12, (r.depth || 1) * 12));
        const liked = !!r.likedByMe;
        const count = r.likesCount ?? 0;

        return (
            <View key={r._id} style={[styles.replyRow, { marginLeft: left }]}>
                <UserLine u={r.userId} />

                {r.replyToUserId?.pseudo ? (
                    <Text style={styles.replyTo}>{"en réponse à "}@{r.replyToUserId.pseudo}</Text>
                ) : null}

                <TouchableOpacity onPress={() => openUserProfile(r.userId?._id)} activeOpacity={0.9}>
                    <Text style={styles.replyText}>{r.text}</Text>
                </TouchableOpacity>

                <View style={styles.rowActions}>
                    <TouchableOpacity onPress={() => setReplyTo(r)} activeOpacity={0.8}>
                        <Text style={styles.replyBtn}>Répondre</Text>
                    </TouchableOpacity>

                    <LikeChip
                        liked={liked}
                        count={count}
                        disabled={!!likeLoading[r._id]}
                        onPress={() => toggleLike(r._id, { type: "reply", rootId: r.rootId })}
                    />
                </View>
            </View>
        );
    };

    const renderComment = ({ item }: { item: CommentType }) => {
        const open = !!threadOpen[item._id];
        const loading = !!threadLoading[item._id];
        const replies = threadReplies[item._id] ?? [];
        const hasMore = !!threadHasMore[item._id];

        const liked = !!item.likedByMe;
        const count = item.likesCount ?? 0;

        return (
            <View style={styles.commentRow}>
                <UserLine u={item.userId} />

                <TouchableOpacity onPress={() => openUserProfile(item.userId?._id)} activeOpacity={0.9}>
                    <Text style={styles.commentText}>{item.text}</Text>
                </TouchableOpacity>

                <View style={styles.rowActions}>
                    <TouchableOpacity onPress={() => setReplyTo(item)} activeOpacity={0.8}>
                        <Text style={styles.replyBtn}>Répondre</Text>
                    </TouchableOpacity>

                    {(item.repliesCount || 0) > 0 ? (
                        <TouchableOpacity onPress={() => toggleThread(item._id)} activeOpacity={0.8}>
                            <Text style={styles.threadBtn}>{open ? "Masquer" : `Voir ${item.repliesCount} réponse(s)`}</Text>
                        </TouchableOpacity>
                    ) : null}

                    <LikeChip
                        liked={liked}
                        count={count}
                        disabled={!!likeLoading[item._id]}
                        onPress={() => toggleLike(item._id, { type: "comment" })}
                    />
                </View>

                {open ? (
                    <View style={styles.threadBox}>
                        {loading ? (
                            <ActivityIndicator color="#9B5CFF" style={{ paddingVertical: 10 }} />
                        ) : (
                            <>
                                {replies.map(renderReply)}

                                {hasMore ? (
                                    <TouchableOpacity
                                        onPress={() => fetchThread(item._id, "more")}
                                        activeOpacity={0.85}
                                        style={styles.moreBtn}
                                    >
                                        <Text style={styles.moreText}>Voir plus</Text>
                                    </TouchableOpacity>
                                ) : null}
                            </>
                        )}
                    </View>
                ) : null}
            </View>
        );
    };

    if (loadingPost && !post) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color="#9B5CFF" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: "#000" }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
            <View style={styles.screen}>
                <View style={styles.topBar}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
                        <Ionicons name="arrow-back" size={22} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.topTitle}>Post</Text>
                    <View style={{ width: 38 }} />
                </View>

                {post ? <PostCard post={post} /> : null}

                <Text style={styles.sectionTitle}>Commentaires</Text>

                {loadingComments ? (
                    <ActivityIndicator color="#9B5CFF" style={{ marginTop: 10 }} />
                ) : (
                    <FlatList
                        data={comments}
                        keyExtractor={(i) => i._id}
                        renderItem={renderComment}
                        style={{ flex: 1 }}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{ paddingBottom: 140 }}
                    />
                )}

                <View style={styles.composer}>
                    {replyTo ? (
                        <View style={styles.replyingTo}>
                            <Text style={styles.replyingToText}>Réponse à {replyTo.userId?.pseudo}</Text>
                            <TouchableOpacity onPress={() => setReplyTo(null)} style={{ padding: 6 }}>
                                <Ionicons name="close" size={18} color="#aaa" />
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    <View style={styles.inputRow}>
                        <TextInput
                            value={text}
                            onChangeText={setText}
                            placeholder={placeholder}
                            placeholderTextColor="#666"
                            style={styles.input}
                            multiline
                        />
                        <TouchableOpacity onPress={submit} style={styles.sendBtn} activeOpacity={0.85}>
                            <Ionicons name="send" size={18} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#000", paddingTop: 40, paddingHorizontal: 14 },
    loading: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },

    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
    topTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },

    sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "800", marginTop: 10, marginBottom: 8 },

    commentRow: { paddingVertical: 12, borderBottomWidth: 1, borderColor: "#151515" },

    userLine: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
    avatar: { width: 28, height: 28, borderRadius: 14, marginRight: 10, backgroundColor: "#111" },
    pseudo: { color: "#fff", fontWeight: "900" },

    commentText: { color: "#d0d0d0", fontSize: 14, marginTop: 2 },

    rowActions: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 14 },
    replyBtn: { color: "#9B5CFF", fontWeight: "800", fontSize: 12 },
    threadBtn: { color: "#bbb", fontWeight: "700", fontSize: 12 },

    likeBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: "auto" },
    likeCount: { color: "#bbb", fontWeight: "800", fontSize: 12 },

    threadBox: { marginTop: 10, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: "#222" },

    replyRow: { paddingVertical: 10, borderBottomWidth: 1, borderColor: "#111" },
    replyTo: { color: "#777", fontWeight: "700", fontSize: 12, marginBottom: 4 },
    replyText: { color: "#cfcfcf", fontSize: 13, marginTop: 2 },

    moreBtn: { paddingVertical: 10 },
    moreText: { color: "#9B5CFF", fontWeight: "900" },

    composer: {
        backgroundColor: "#0f0f0f",
        borderWidth: 1,
        borderColor: "#202020",
        borderRadius: 14,
        padding: 10,
        marginTop: 10,
        marginBottom: 14,
    },
    replyingTo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    replyingToText: { color: "#aaa", fontSize: 12, fontWeight: "700" },

    inputRow: { flexDirection: "row", alignItems: "flex-end" },
    input: { flex: 1, color: "#fff", minHeight: 40, maxHeight: 120, paddingRight: 10 },
    sendBtn: {
        backgroundColor: "#9B5CFF",
        width: 42,
        height: 42,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
    },
});