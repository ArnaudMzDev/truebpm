import React from "react";
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { PostType } from "./types";
import { API_URL } from "../../lib/config";
import { colors, spacing, typography, fontWeights } from "../../theme";

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

function ActionButton({
                          icon,
                          activeIcon,
                          active = false,
                          count,
                          loading = false,
                          activeColor = colors.primary,
                          onPress,
                          onlyIcon = false,
                      }: ActionButtonProps) {
    const iconColor = active ? activeColor : colors.textMuted;
    const textColor = active ? colors.text : colors.textMuted;

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={styles.actionBtn}
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
        </TouchableOpacity>
    );
}

export default function ActionsBar({
                                       post,
                                       onLocalUpdate,
                                       onOpenComments,
                                       onShare,
                                   }: Props) {
    const [liking, setLiking] = React.useState(false);
    const [reposting, setReposting] = React.useState(false);

    const toggleLike = async () => {
        if (liking) return;

        const token = await AsyncStorage.getItem("token");
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
    };

    const toggleRepost = async () => {
        if (reposting) return;

        const token = await AsyncStorage.getItem("token");
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
    };

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

const styles = StyleSheet.create({
    row: {
        marginTop: spacing.lg,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    leftGroup: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.lg,
    },

    actionBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: 4,
    },

    actionCount: {
        fontSize: typography.bodySm,
        fontWeight: fontWeights.extraBold,
    },
});