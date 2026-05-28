import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    Platform,
    Image,
    Keyboard,
    TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_URL } from "../lib/config";
import PostCard from "../components/PostCard";
import { PostType } from "../components/PostCard/types";
import AppScreenLoader from "../components/ui/AppScreenLoader";
import { colors, spacing, radius, typography, fontWeights, shadows } from "../theme";
import { getStoredToken } from "../lib/authStorage";

type CommentUser = { pseudo: string; avatarUrl?: string; _id: string };

type BaseNode = {
    _id: string;
    text: string;
    createdAt: string;
    userId: CommentUser;
    repliesCount?: number;
    directRepliesCount?: number;
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
        if (__DEV__) console.log("Non-JSON response:", txt.slice(0, 200));
        return null;
    }
}

function formatRelativeDate(dateString: string) {
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

export default function PostScreen({ route, navigation }: any) {
    const { postId } = route.params;
    const insets = useSafeAreaInsets();

    const [post, setPost] = useState<PostType | null>(null);
    const [loadingPost, setLoadingPost] = useState(true);

    const [comments, setComments] = useState<CommentType[]>([]);
    const [loadingComments, setLoadingComments] = useState(true);

    const [text, setText] = useState("");
    const [replyTo, setReplyTo] = useState<(CommentType | ReplyType) | null>(null);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [composerHeight, setComposerHeight] = useState(92);

    const placeholder = useMemo(
        () => (replyTo ? `Répondre à ${replyTo.userId.pseudo}…` : "Écrire un commentaire…"),
        [replyTo]
    );

    const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
    const [childrenMap, setChildrenMap] = useState<Record<string, ReplyType[]>>({});
    const [cursorMap, setCursorMap] = useState<Record<string, string | null>>({});
    const [hasMoreMap, setHasMoreMap] = useState<Record<string, boolean>>({});
    const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

    const cursorRef = useRef<Record<string, string | null>>({});
    useEffect(() => {
        cursorRef.current = cursorMap;
    }, [cursorMap]);

    const [likeLoading, setLikeLoading] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
        const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

        const showSub = Keyboard.addListener(showEvent, (event) => {
            setKeyboardHeight(event.endCoordinates?.height || 0);
        });
        const hideSub = Keyboard.addListener(hideEvent, () => {
            setKeyboardHeight(0);
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

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

    const handleDeleted = useCallback(() => {
        navigation.goBack();
    }, [navigation]);

    const fetchPost = useCallback(async () => {
        setLoadingPost(true);
        const token = await getStoredToken();

        const res = await fetch(`${API_URL}/api/posts/${postId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const json = await safeJson(res);
        if (res.ok) setPost(json?.post ?? null);
        setLoadingPost(false);
    }, [postId]);

    const fetchComments = useCallback(async () => {
        setLoadingComments(true);
        const token = await getStoredToken();

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

    const fetchReplies = useCallback(
        async (parentId: string, mode: "initial" | "more" = "initial") => {
            if (loadingMap[parentId]) return;

            setLoadingMap((m) => ({ ...m, [parentId]: true }));
            try {
                const cursor = mode === "more" ? cursorRef.current[parentId] : null;

                const url =
                    `${API_URL}/api/comments/${parentId}/replies?limit=10` +
                    (cursor ? `&cursor=${encodeURIComponent(cursor)}` : "");

                const token = await getStoredToken();
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

    const toggleLike = useCallback(
        async (nodeId: string, where: { type: "comment" } | { type: "reply"; parentId: string }) => {
            if (likeLoading[nodeId]) return;

            const token = await getStoredToken();
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
                        prev.map((c) =>
                            c._id === nodeId ? { ...c, likedByMe: nextLiked, likesCount: nextCount } : c
                        )
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
                        prev.map((c) =>
                            c._id === nodeId ? { ...c, likedByMe: prevLiked, likesCount: prevCount } : c
                        )
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
                                ? {
                                    ...c,
                                    likedByMe: serverLiked ?? c.likedByMe,
                                    likesCount: serverCount ?? c.likesCount,
                                }
                                : c
                        )
                    );
                } else {
                    setChildrenMap((prev) => ({
                        ...prev,
                        [where.parentId]: (prev[where.parentId] ?? []).map((r) =>
                            r._id === nodeId
                                ? {
                                    ...r,
                                    likedByMe: serverLiked ?? r.likedByMe,
                                    likesCount: serverCount ?? r.likesCount,
                                }
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

    const submit = useCallback(async () => {
        const token = await getStoredToken();
        if (!token) return;

        const clean = text.trim();
        if (!clean) return;

        const target = replyTo;
        setText("");

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
                setOpenMap((m) => ({ ...m, [parentId]: true }));

                setChildrenMap((m) => {
                    const prev = m[parentId] ?? [];
                    const next = [...prev, created];

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

                setComments((prev) =>
                    prev.map((c) =>
                        c._id === parentId
                            ? {
                                ...c,
                                directRepliesCount: (c.directRepliesCount || 0) + 1,
                                repliesCount: (c.repliesCount || 0) + 1,
                            }
                            : c
                    )
                );

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

                setPost((p) => (p ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p));
                setReplyTo(null);
            }
            return;
        }

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

    const UserLine = ({ u, createdAt }: { u: CommentUser; createdAt?: string }) => {
        const uri = u.avatarUrl || "https://picsum.photos/200";

        return (
            <View style={styles.userLine}>
                <TouchableOpacity onPress={() => openUserProfile(u._id)} activeOpacity={0.85}>
                    <Image source={{ uri }} style={styles.avatar} />
                </TouchableOpacity>

                <View style={styles.userMeta}>
                    <TouchableOpacity onPress={() => openUserProfile(u._id)} activeOpacity={0.85}>
                        <Text style={styles.pseudo}>{u.pseudo || "Utilisateur"}</Text>
                    </TouchableOpacity>

                    {createdAt ? <Text style={styles.commentDate}>{formatRelativeDate(createdAt)}</Text> : null}
                </View>
            </View>
        );
    };

    const LikeChip = ({ liked, count, onPress, disabled }: any) => (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.85}
            style={[styles.likeBtn, liked && styles.likeBtnActive]}
            disabled={disabled}
        >
            <Ionicons
                name={(liked ? "heart" : "heart-outline") as any}
                size={15}
                color={liked ? colors.danger : colors.textMuted}
            />
            <Text style={[styles.likeCount, liked && styles.likeCountActive]}>{count}</Text>
        </TouchableOpacity>
    );

    const renderChildren = (parentId: string, depthBase: number) => {
        const open = !!openMap[parentId];
        if (!open) return null;

        const loading = !!loadingMap[parentId];
        const list = childrenMap[parentId] ?? [];
        const hasMore = !!hasMoreMap[parentId];

        return (
            <View style={styles.threadBox}>
                {loading ? (
                    <View style={{ paddingVertical: 10 }}>
                        <Text style={styles.threadLoading}>Chargement...</Text>
                    </View>
                ) : (
                    <>
                        {list.map((r) => (
                            <View
                                key={r._id}
                                style={[
                                    styles.replyRow,
                                    { marginLeft: Math.min(56, 10 + (depthBase + 1) * 10) },
                                ]}
                            >
                                <UserLine u={r.userId} createdAt={r.createdAt} />

                                {r.replyToUserId?.pseudo ? (
                                    <Text style={styles.replyTo}>en réponse à @{r.replyToUserId.pseudo}</Text>
                                ) : null}

                                <Text style={styles.replyText}>{r.text}</Text>

                                <View style={styles.rowActions}>
                                    <TouchableOpacity
                                        onPress={() => setReplyTo(r)}
                                        activeOpacity={0.8}
                                        style={styles.metaAction}
                                    >
                                        <Ionicons name="arrow-undo-outline" size={13} color={colors.primary} />
                                        <Text style={styles.replyBtn}>Répondre</Text>
                                    </TouchableOpacity>

                                    {(r.directRepliesCount || 0) > 0 ? (
                                        <TouchableOpacity
                                            onPress={() => toggleOpen(r._id)}
                                            activeOpacity={0.8}
                                            style={styles.metaAction}
                                        >
                                            <Ionicons
                                                name={openMap[r._id] ? "chevron-up" : "chevron-down"}
                                                size={13}
                                                color={colors.textMuted}
                                            />
                                            <Text style={styles.threadBtn}>
                                                {openMap[r._id]
                                                    ? "Masquer"
                                                    : `Voir ${r.directRepliesCount} réponse(s)`}
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

                                {renderChildren(r._id, depthBase + 1)}
                            </View>
                        ))}

                        {hasMore ? (
                            <TouchableOpacity
                                onPress={() => fetchReplies(parentId, "more")}
                                activeOpacity={0.85}
                                style={styles.moreBtn}
                            >
                                <Ionicons name="add-circle-outline" size={14} color={colors.primary} />
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
            <View style={styles.commentCard}>
                <UserLine u={item.userId} createdAt={item.createdAt} />

                <Text style={styles.commentText}>{item.text}</Text>

                <View style={styles.rowActions}>
                    <TouchableOpacity
                        onPress={() => setReplyTo(item)}
                        activeOpacity={0.8}
                        style={styles.metaAction}
                    >
                        <Ionicons name="arrow-undo-outline" size={13} color={colors.primary} />
                        <Text style={styles.replyBtn}>Répondre</Text>
                    </TouchableOpacity>

                    {(item.directRepliesCount || item.repliesCount || 0) > 0 ? (
                        <TouchableOpacity
                            onPress={() => toggleOpen(item._id)}
                            activeOpacity={0.8}
                            style={styles.metaAction}
                        >
                            <Ionicons
                                name={open ? "chevron-up" : "chevron-down"}
                                size={13}
                                color={colors.textMuted}
                            />
                            <Text style={styles.threadBtn}>
                                {open
                                    ? "Masquer"
                                    : `Voir ${(item.directRepliesCount ?? item.repliesCount) || 0} réponse(s)`}
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

                {renderChildren(item._id, 0)}
            </View>
        );
    };

    if (loadingPost && !post) {
        return <AppScreenLoader label="Chargement du post..." />;
    }

    const topInset = insets.top + 10;
    const bottomInset = Math.max(insets.bottom, 12);
    const composerBottom = keyboardHeight > 0 ? keyboardHeight + 8 : bottomInset;
    const listBottomPadding = composerHeight + composerBottom + 18;

    return (
        <View style={styles.keyboard}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <View style={[styles.screen, { paddingTop: topInset }]}>
                <View style={styles.topBar}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBarBtn}>
                        <Ionicons name="arrow-back" size={20} color={colors.text} />
                    </TouchableOpacity>

                    <View style={styles.topBarCenter}>
                        <Text style={styles.topEyebrow}>POST</Text>
                        <Text style={styles.topTitle}>Détail du post</Text>
                    </View>

                    <TouchableOpacity onPress={openShare} style={styles.topBarBtn} activeOpacity={0.85}>
                        <Ionicons name="paper-plane-outline" size={20} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {post ? <PostCard post={post} onDeleted={handleDeleted} disableOpenDetail /> : null}

                <View style={styles.sectionHeader}>
                    <View>
                        <Text style={styles.sectionEyebrow}>Discussion</Text>
                        <Text style={styles.sectionTitle}>Commentaires</Text>
                    </View>

                    <View style={styles.sectionBadge}>
                        <Text style={styles.sectionBadgeText}>{comments.length}</Text>
                    </View>
                </View>

                {loadingComments ? (
                    <View style={{ marginTop: 14 }}>
                        <Text style={styles.threadLoading}>Chargement des commentaires...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={comments}
                        keyExtractor={(i) => i._id}
                        renderItem={renderComment}
                        style={{ flex: 1 }}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                        onScrollBeginDrag={Keyboard.dismiss}
                        contentContainerStyle={{ paddingBottom: listBottomPadding }}
                        showsVerticalScrollIndicator={false}
                    />
                )}

                <View
                    onLayout={(event) => setComposerHeight(event.nativeEvent.layout.height)}
                    style={[styles.composerDock, { bottom: composerBottom }]}
                >
                    <View style={styles.composer}>
                        {replyTo ? (
                            <View style={styles.replyingTo}>
                                <View style={styles.replyingToLeft}>
                                    <Ionicons name="return-up-forward-outline" size={14} color={colors.primary} />
                                    <Text style={styles.replyingToText}>Réponse à {replyTo.userId?.pseudo}</Text>
                                </View>

                                <TouchableOpacity onPress={() => setReplyTo(null)} style={styles.replyingClose}>
                                    <Ionicons name="close" size={16} color={colors.textMuted} />
                                </TouchableOpacity>
                            </View>
                        ) : null}

                        <View style={styles.inputRow}>
                            <TextInput
                                value={text}
                                onChangeText={setText}
                                placeholder={placeholder}
                                placeholderTextColor={colors.textFaint}
                                style={styles.input}
                                multiline
                            />

                            <TouchableOpacity
                                onPress={submit}
                                style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
                                activeOpacity={0.85}
                                disabled={!text.trim()}
                            >
                                <Ionicons name="send" size={17} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
                </View>
            </TouchableWithoutFeedback>
        </View>
    );
}

const styles = StyleSheet.create({
    keyboard: {
        flex: 1,
        backgroundColor: colors.bg,
    },

    screen: {
        flex: 1,
        backgroundColor: colors.bg,
        paddingHorizontal: 14,
    },

    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
    },

    topBarBtn: {
        width: 40,
        height: 40,
        borderRadius: radius.lg,
        backgroundColor: colors.surface3,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },

    topBarCenter: {
        flex: 1,
        alignItems: "center",
        paddingHorizontal: spacing.md,
    },

    topEyebrow: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        letterSpacing: 1,
        marginBottom: 2,
    },

    topTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: fontWeights.black,
    },

    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 8,
        marginBottom: 10,
    },

    sectionEyebrow: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 2,
    },

    sectionTitle: {
        color: colors.text,
        fontSize: 17,
        fontWeight: fontWeights.black,
    },

    sectionBadge: {
        minWidth: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: "#171122",
        borderWidth: 1,
        borderColor: colors.borderAccent,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 8,
    },

    sectionBadgeText: {
        color: colors.primary,
        fontSize: typography.caption,
        fontWeight: fontWeights.black,
    },

    commentCard: {
        padding: spacing.md,
        marginBottom: spacing.sm,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderSoft,
        borderRadius: radius.xl,
    },

    userLine: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },

    userMeta: {
        flex: 1,
        minWidth: 0,
    },

    avatar: {
        width: 34,
        height: 34,
        borderRadius: 17,
        marginRight: 10,
        backgroundColor: colors.surface4,
        borderWidth: 1,
        borderColor: colors.border,
    },

    pseudo: {
        color: colors.text,
        fontWeight: fontWeights.black,
        fontSize: typography.body,
    },

    commentDate: {
        color: colors.textMuted,
        fontSize: typography.caption,
        marginTop: 1,
    },

    commentText: {
        color: colors.textSoft,
        fontSize: 14,
        lineHeight: 21,
        marginTop: 2,
    },

    rowActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginTop: 12,
        flexWrap: "wrap",
    },

    metaAction: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
    },

    replyBtn: {
        color: colors.primary,
        fontWeight: fontWeights.extraBold,
        fontSize: typography.caption,
    },

    threadBtn: {
        color: colors.textMuted,
        fontWeight: fontWeights.bold,
        fontSize: typography.caption,
    },

    likeBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginLeft: "auto",
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: radius.pill,
        backgroundColor: colors.surface3,
        borderWidth: 1,
        borderColor: colors.border,
    },

    likeBtnActive: {
        backgroundColor: "#1D1118",
        borderColor: "#3A1C2A",
    },

    likeCount: {
        color: colors.textMuted,
        fontWeight: fontWeights.extraBold,
        fontSize: typography.caption,
    },

    likeCountActive: {
        color: colors.danger,
    },

    threadBox: {
        marginTop: 12,
        paddingLeft: 10,
        borderLeftWidth: 2,
        borderLeftColor: "#231A35",
    },

    replyRow: {
        paddingVertical: 10,
        paddingHorizontal: 10,
        marginBottom: 8,
        backgroundColor: "#0F0F12",
        borderWidth: 1,
        borderColor: "#18181C",
        borderRadius: radius.lg,
    },

    replyTo: {
        color: colors.textMuted,
        fontWeight: fontWeights.bold,
        fontSize: typography.caption,
        marginBottom: 4,
    },

    replyText: {
        color: colors.textSoft,
        fontSize: typography.bodySm,
        lineHeight: 19,
        marginTop: 2,
    },

    moreBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: 8,
        paddingLeft: 4,
    },

    moreText: {
        color: colors.primary,
        fontWeight: fontWeights.black,
        fontSize: typography.caption,
    },

    threadLoading: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        textAlign: "center",
    },

    composerDock: {
        position: "absolute",
        left: 14,
        right: 14,
        zIndex: 20,
    },

    composer: {
        backgroundColor: "#0F0F12",
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.xxl,
        padding: 10,
        ...shadows.card,
    },

    replyingTo: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#1B1B1F",
    },

    replyingToLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },

    replyingToText: {
        color: colors.textMuted,
        fontSize: typography.caption,
        fontWeight: fontWeights.bold,
    },

    replyingClose: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface3,
    },

    inputRow: {
        flexDirection: "row",
        alignItems: "flex-end",
    },

    input: {
        flex: 1,
        color: colors.text,
        minHeight: 42,
        maxHeight: 120,
        paddingRight: 10,
        fontSize: typography.body,
    },

    sendBtn: {
        backgroundColor: colors.primary,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: "center",
        alignItems: "center",
        ...shadows.glowPrimary,
    },

    sendBtnDisabled: {
        opacity: 0.45,
    },
});
