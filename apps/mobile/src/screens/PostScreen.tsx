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

type BaseNode = {
    _id: string;
    text: string;
    createdAt: string;
    userId: CommentUser;

    // replies
    repliesCount?: number;        // total descendants (optionnel)
    directRepliesCount?: number;  // ✅ pour "Voir X réponses" sur chaque node

    // likes
    likesCount?: number;
    likedByMe?: boolean;
};

type CommentType = BaseNode;

type ReplyType = BaseNode & {
    parentId: string;
    rootId: string;
    depth: number;
    replyToUserId?: { pseudo: string } | null;
};

function isObject(x: any) {
    return x !== null && typeof x === "object";
}

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

    // ✅ Cascade state (par parentId)
    const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
    const [childrenMap, setChildrenMap] = useState<Record<string, ReplyType[]>>({});
    const [cursorMap, setCursorMap] = useState<Record<string, string | null>>({});
    const [hasMoreMap, setHasMoreMap] = useState<Record<string, boolean>>({});
    const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

    const cursorRef = useRef<Record<string, string | null>>({});
    useEffect(() => {
        cursorRef.current = cursorMap;
    }, [cursorMap]);

    // anti double tap likes
    const [likeLoading, setLikeLoading] = useState<Record<string, boolean>>({});

    const openUserProfile = useCallback(
        (userId?: string) => {
            if (!userId) return;
            navigation.push("UserProfile", { userId });
        },
        [navigation]
    );

    const openShare = useCallback(() => {
        if (!post?._id) return;

        navigation.navigate("Main", {
            screen: "Notifications",
            params: {
                screen: "Conversations",
                params: { sharePostId: post._id },
            },
        });
    }, [navigation, post?._id]);

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

    // ✅ Fetch direct replies d’un parent (comment OU reply)
    const fetchReplies = useCallback(
        async (parentId: string, mode: "initial" | "more" = "initial") => {
            if (loadingMap[parentId]) return;

            setLoadingMap((m) => ({ ...m, [parentId]: true }));
            try {
                const cursor = mode === "more" ? cursorRef.current[parentId] : null;

                const url =
                    `${API_URL}/api/comments/${parentId}/replies?limit=10` +
                    (cursor ? `&cursor=${encodeURIComponent(cursor)}` : "");

                const token = await AsyncStorage.getItem("token");
                const res = await fetch(url, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });

                const json = await safeJson(res);
                if (!res.ok) {
                    console.log("fetchReplies error:", res.status, json);
                    return;
                }

                const newItems: ReplyType[] = json?.replies ?? [];
                const next: string | null = json?.nextCursor ?? null;

                // ✅ merge stable en évitant les doublons
                setChildrenMap((m) => {
                    const prev = m[parentId] ?? [];
                    const merged = mode === "more" ? [...prev, ...newItems] : newItems;

                    const seen = new Set<string>();
                    const unique: ReplyType[] = [];
                    for (const it of merged) {
                        const id = String(it?._id);
                        if (!id || seen.has(id)) continue;
                        seen.add(id);
                        unique.push(it);
                    }

                    // Tri ASC naturel : ObjectId (ou createdAt)
                    unique.sort((a, b) => String(a._id).localeCompare(String(b._id)));

                    return { ...m, [parentId]: unique };
                });

                setCursorMap((m) => {
                    const nextMap = { ...m, [parentId]: next };
                    cursorRef.current = nextMap;
                    return nextMap;
                });

                setHasMoreMap((m) => ({ ...m, [parentId]: !!next }));
            } finally {
                setLoadingMap((m) => ({ ...m, [parentId]: false }));
            }
        },
        [loadingMap]
    );

    const toggleOpen = useCallback(
        async (parentId: string) => {
            const willOpen = !openMap[parentId];
            setOpenMap((m) => ({ ...m, [parentId]: willOpen }));

            if (willOpen && !childrenMap[parentId]) {
                await fetchReplies(parentId, "initial");
            }
        },
        [openMap, childrenMap, fetchReplies]
    );

    // ✅ Like (comment ou reply) : on ne dépend pas du rootId ici
    const toggleLike = useCallback(
        async (nodeId: string, where: { type: "comment" } | { type: "reply"; parentId: string }) => {
            if (likeLoading[nodeId]) return;

            const token = await AsyncStorage.getItem("token");
            if (!token) return;

            setLikeLoading((m) => ({ ...m, [nodeId]: true }));

            let prevLiked = false;
            let prevCount = 0;

            const optimistic = () => {
                if (where.type === "comment") {
                    const t = comments.find((c) => c._id === nodeId);
                    prevLiked = !!t?.likedByMe;
                    prevCount = t?.likesCount ?? 0;

                    const nextLiked = !prevLiked;
                    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));

                    setComments((prev) =>
                        prev.map((c) => (c._id === nodeId ? { ...c, likedByMe: nextLiked, likesCount: nextCount } : c))
                    );
                } else {
                    const arr = childrenMap[where.parentId] ?? [];
                    const t = arr.find((r) => r._id === nodeId);
                    prevLiked = !!t?.likedByMe;
                    prevCount = t?.likesCount ?? 0;

                    const nextLiked = !prevLiked;
                    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));

                    setChildrenMap((prev) => ({
                        ...prev,
                        [where.parentId]: (prev[where.parentId] ?? []).map((r) =>
                            r._id === nodeId ? { ...r, likedByMe: nextLiked, likesCount: nextCount } : r
                        ),
                    }));
                }
            };

            const rollback = () => {
                if (where.type === "comment") {
                    setComments((prev) =>
                        prev.map((c) => (c._id === nodeId ? { ...c, likedByMe: prevLiked, likesCount: prevCount } : c))
                    );
                } else {
                    setChildrenMap((prev) => ({
                        ...prev,
                        [where.parentId]: (prev[where.parentId] ?? []).map((r) =>
                            r._id === nodeId ? { ...r, likedByMe: prevLiked, likesCount: prevCount } : r
                        ),
                    }));
                }
            };

            optimistic();

            try {
                const res = await fetch(`${API_URL}/api/comments/${nodeId}/like`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                });

                const json = await safeJson(res);
                if (!res.ok) {
                    rollback();
                    return;
                }

                const serverCount = typeof json?.likesCount === "number" ? json.likesCount : undefined;
                const serverLiked = json?.status ? json.status === "liked" : undefined;

                if (where.type === "comment") {
                    setComments((prev) =>
                        prev.map((c) =>
                            c._id === nodeId
                                ? { ...c, likedByMe: serverLiked ?? c.likedByMe, likesCount: serverCount ?? c.likesCount }
                                : c
                        )
                    );
                } else {
                    setChildrenMap((prev) => ({
                        ...prev,
                        [where.parentId]: (prev[where.parentId] ?? []).map((r) =>
                            r._id === nodeId
                                ? { ...r, likedByMe: serverLiked ?? r.likedByMe, likesCount: serverCount ?? r.likesCount }
                                : r
                        ),
                    }));
                }
            } finally {
                setLikeLoading((m) => ({ ...m, [nodeId]: false }));
            }
        },
        [comments, childrenMap, likeLoading]
    );

    // ✅ submit : la reply est ajoutée DANS childrenMap[parentId] (donc sous le parent)
    const submit = useCallback(async () => {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        const clean = text.trim();
        if (!clean) return;

        const target = replyTo; // snapshot
        setText("");

        // Reply (à un commentaire OU à une reply)
        if (target && isObject(target) && target._id) {
            const parentId = String(target._id);

            const res = await fetch(`${API_URL}/api/comments/${parentId}/replies`, {
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
                // ✅ ouvrir le parent
                setOpenMap((m) => ({ ...m, [parentId]: true }));

                // ✅ insert sous le parent (en bas)
                setChildrenMap((m) => {
                    const prev = m[parentId] ?? [];
                    const next = [...prev, created];

                    // uniq + tri ASC
                    const seen = new Set<string>();
                    const unique: ReplyType[] = [];
                    for (const it of next) {
                        const id = String(it?._id);
                        if (!id || seen.has(id)) continue;
                        seen.add(id);
                        unique.push(it);
                    }
                    unique.sort((a, b) => String(a._id).localeCompare(String(b._id)));

                    return { ...m, [parentId]: unique };
                });

                // ✅ incrémenter directRepliesCount du parent localement (si présent)
                // parent dans comments ?
                setComments((prev) =>
                    prev.map((c) =>
                        c._id === parentId
                            ? { ...c, directRepliesCount: (c.directRepliesCount || 0) + 1, repliesCount: (c.repliesCount || 0) + 1 }
                            : c
                    )
                );
                // parent dans childrenMap ? (si c’est une reply)
                setChildrenMap((prev) => {
                    const out = { ...prev };
                    for (const key of Object.keys(out)) {
                        out[key] = (out[key] ?? []).map((r) =>
                            r._id === parentId
                                ? {
                                    ...r,
                                    directRepliesCount: (r.directRepliesCount || 0) + 1,
                                    repliesCount: (r.repliesCount || 0) + 1,
                                }
                                : r
                        );
                    }
                    return out;
                });

                // ✅ post counter
                setPost((p) => (p ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p));

                setReplyTo(null);
            }
            return;
        }

        // Top-level comment
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

    // ✅ rendu récursif des replies d’un parent
    const renderChildren = (parentId: string, depthBase: number) => {
        const open = !!openMap[parentId];
        if (!open) return null;

        const loading = !!loadingMap[parentId];
        const list = childrenMap[parentId] ?? [];
        const hasMore = !!hasMoreMap[parentId];

        return (
            <View style={styles.threadBox}>
                {loading ? (
                    <ActivityIndicator color="#9B5CFF" style={{ paddingVertical: 10 }} />
                ) : (
                    <>
                        {list.map((r) => (
                            <View key={r._id} style={[styles.replyRow, { marginLeft: Math.min(60, 12 + (depthBase + 1) * 12) }]}>
                                <UserLine u={r.userId} />

                                {r.replyToUserId?.pseudo ? (
                                    <Text style={styles.replyTo}>{"en réponse à "}@{r.replyToUserId.pseudo}</Text>
                                ) : null}

                                <Text style={styles.replyText}>{r.text}</Text>

                                <View style={styles.rowActions}>
                                    <TouchableOpacity onPress={() => setReplyTo(r)} activeOpacity={0.8}>
                                        <Text style={styles.replyBtn}>Répondre</Text>
                                    </TouchableOpacity>

                                    {(r.directRepliesCount || 0) > 0 ? (
                                        <TouchableOpacity onPress={() => toggleOpen(r._id)} activeOpacity={0.8}>
                                            <Text style={styles.threadBtn}>
                                                {openMap[r._id] ? "Masquer" : `Voir ${r.directRepliesCount} réponse(s)`}
                                            </Text>
                                        </TouchableOpacity>
                                    ) : null}

                                    <LikeChip
                                        liked={!!r.likedByMe}
                                        count={r.likesCount ?? 0}
                                        disabled={!!likeLoading[r._id]}
                                        onPress={() => toggleLike(r._id, { type: "reply", parentId })}
                                    />
                                </View>

                                {/* ✅ replies des replies */}
                                {renderChildren(r._id, depthBase + 1)}
                            </View>
                        ))}

                        {hasMore ? (
                            <TouchableOpacity
                                onPress={() => fetchReplies(parentId, "more")}
                                activeOpacity={0.85}
                                style={styles.moreBtn}
                            >
                                <Text style={styles.moreText}>Voir plus</Text>
                            </TouchableOpacity>
                        ) : null}
                    </>
                )}
            </View>
        );
    };

    const renderComment = ({ item }: { item: CommentType }) => {
        const open = !!openMap[item._id];

        return (
            <View style={styles.commentRow}>
                <UserLine u={item.userId} />

                <Text style={styles.commentText}>{item.text}</Text>

                <View style={styles.rowActions}>
                    <TouchableOpacity onPress={() => setReplyTo(item)} activeOpacity={0.8}>
                        <Text style={styles.replyBtn}>Répondre</Text>
                    </TouchableOpacity>

                    {(item.directRepliesCount || item.repliesCount || 0) > 0 ? (
                        <TouchableOpacity onPress={() => toggleOpen(item._id)} activeOpacity={0.8}>
                            <Text style={styles.threadBtn}>
                                {open ? "Masquer" : `Voir ${(item.directRepliesCount ?? item.repliesCount) || 0} réponse(s)`}
                            </Text>
                        </TouchableOpacity>
                    ) : null}

                    <LikeChip
                        liked={!!item.likedByMe}
                        count={item.likesCount ?? 0}
                        disabled={!!likeLoading[item._id]}
                        onPress={() => toggleLike(item._id, { type: "comment" })}
                    />
                </View>

                {/* ✅ replies du commentaire */}
                {renderChildren(item._id, 0)}
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

                    <TouchableOpacity onPress={openShare} style={{ padding: 8 }} activeOpacity={0.85}>
                        <Ionicons name="paper-plane-outline" size={22} color="#fff" />
                    </TouchableOpacity>
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