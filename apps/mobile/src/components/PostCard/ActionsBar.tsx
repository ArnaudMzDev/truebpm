import React from "react";
import { View, Pressable, Text, StyleSheet, ActivityIndicator, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { PostType } from "./types";
import { API_URL } from "../../lib/config";
import { colors, spacing, typography, fontWeights, radius } from "../../theme";
import { getStoredToken } from "../../lib/authStorage";

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

type Props = {
    post: PostType;
    onLocalUpdate: (patch: Partial<PostType>) => void;
    onOpenComments: () => void;
    onShare?: () => void;
};

type ActionButtonProps = {
    icon: keyof typeof Ionicons.glyphMap;
    activeIcon?: keyof typeof Ionicons.glyphMap;
    active?: boolean;
    count?: number;
    loading?: boolean;
    activeColor?: string;
    onPress?: () => void;
    onlyIcon?: boolean;
};

const ActionButton = React.memo(function ActionButton({
                                                         icon,
                                                         activeIcon,
                                                         active = false,
                                                         count,
                                                         loading = false,
                                                         activeColor = colors.primary,
                                                         onPress,
                                                         onlyIcon = false,
                                                     }: ActionButtonProps) {
    const scale = React.useRef(new Animated.Value(1)).current;
    const iconColor = active ? activeColor : colors.textMuted;
    const textColor = active ? activeColor : colors.textMuted;
    const activeBg = activeColor === colors.danger ? colors.dangerSoft : colors.primarySoft;
    const activeBorder = activeColor === colors.danger ? "rgba(255, 77, 109, 0.26)" : colors.borderAccent;

    const animateTo = React.useCallback(
        (value: number) => {
            Animated.spring(scale, {
                toValue: value,
                useNativeDriver: true,
                speed: 26,
                bounciness: 2,
            }).start();
        },
        [scale]
    );

    return (
        <Pressable
            onPress={onPress}
            onPressIn={() => animateTo(0.96)}
            onPressOut={() => animateTo(1)}
            disabled={loading}
            hitSlop={6}
        >
            <Animated.View
                style={[
                    styles.actionBtn,
                    onlyIcon && styles.actionBtnIconOnly,
                    active && { backgroundColor: activeBg, borderColor: activeBorder },
                    { transform: [{ scale }] },
                ]}
            >
                {loading ? (
                    <ActivityIndicator size="small" color={iconColor} />
                ) : (
                    <Ionicons
                        name={active && activeIcon ? activeIcon : icon}
                        size={20}
                        color={iconColor}
                    />
                )}

                {!onlyIcon && typeof count === "number" ? (
                    <Text style={[styles.actionCount, { color: textColor }]}>
                        {count}
                    </Text>
                ) : null}
            </Animated.View>
        </Pressable>
    );
});

function ActionsBar({
                        post,
                        onLocalUpdate,
                        onOpenComments,
                        onShare,
                    }: Props) {
    const [liking, setLiking] = React.useState(false);
    const [reposting, setReposting] = React.useState(false);

    const toggleLike = React.useCallback(async () => {
        if (liking) return;

        const token = await getStoredToken();
        if (!token) return;

        setLiking(true);

        const prevLiked = !!post.likedByMe;
        const prevCount = post.likesCount ?? 0;

        onLocalUpdate({
            likedByMe: !prevLiked,
            likesCount: Math.max(0, prevCount + (!prevLiked ? 1 : -1)),
        });

        try {
            const res = await fetch(`${API_URL}/api/posts/${post._id}/like`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            const json = await safeJson(res);

            if (!res.ok) {
                onLocalUpdate({
                    likedByMe: prevLiked,
                    likesCount: prevCount,
                });
                return;
            }

            if (typeof json?.likesCount === "number") {
                onLocalUpdate({
                    likesCount: json.likesCount,
                    likedByMe: json?.status === "liked",
                });
            }
        } finally {
            setLiking(false);
        }
    }, [liking, onLocalUpdate, post._id, post.likedByMe, post.likesCount]);

    const toggleRepost = React.useCallback(async () => {
        if (reposting) return;

        const token = await getStoredToken();
        if (!token) return;

        setReposting(true);

        const prevReposted = !!post.repostedByMe;
        const prevCount = post.repostsCount ?? 0;

        onLocalUpdate({
            repostedByMe: !prevReposted,
            repostsCount: Math.max(0, prevCount + (!prevReposted ? 1 : -1)),
        });

        try {
            const res = await fetch(`${API_URL}/api/posts/${post._id}/repost`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            const json = await safeJson(res);

            if (!res.ok) {
                onLocalUpdate({
                    repostedByMe: prevReposted,
                    repostsCount: prevCount,
                });
                return;
            }

            if (typeof json?.repostsCount === "number") {
                onLocalUpdate({
                    repostsCount: json.repostsCount,
                    repostedByMe: json?.status === "reposted",
                });
            }
        } finally {
            setReposting(false);
        }
    }, [reposting, onLocalUpdate, post._id, post.repostedByMe, post.repostsCount]);

    return (
        <View style={styles.row}>
            <View style={styles.leftGroup}>
                <ActionButton
                    icon="heart-outline"
                    activeIcon="heart"
                    active={!!post.likedByMe}
                    count={post.likesCount ?? 0}
                    loading={liking}
                    activeColor={colors.danger}
                    onPress={toggleLike}
                />

                <ActionButton
                    icon="chatbubble-outline"
                    count={post.commentsCount ?? 0}
                    onPress={onOpenComments}
                />

                <ActionButton
                    icon="repeat-outline"
                    activeIcon="repeat"
                    active={!!post.repostedByMe}
                    count={post.repostsCount ?? 0}
                    loading={reposting}
                    activeColor={colors.primary}
                    onPress={toggleRepost}
                />
            </View>

            <ActionButton
                icon="paper-plane-outline"
                onPress={onShare}
                onlyIcon
            />
        </View>
    );
}

export default React.memo(ActionsBar);

const styles = StyleSheet.create({
    row: {
        width: "100%",
        marginTop: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    leftGroup: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },

    actionBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        minHeight: 42,
        minWidth: 48,
        paddingVertical: 8,
        paddingHorizontal: 11,
        borderRadius: radius.pill,
        backgroundColor: "rgba(8, 10, 14, 0.78)",
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },

    actionBtnIconOnly: {
        minWidth: 42,
        paddingHorizontal: 10,
    },

    actionCount: {
        fontSize: typography.bodySm,
        fontWeight: fontWeights.extraBold,
        fontVariant: ["tabular-nums"],
    },
});
