import React, { useMemo, useState } from "react";
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from "react-native";
import { useUser } from "../context/UserContext";

type Props = {
    user: {
        _id: string;
        pseudo: string;
        avatarUrl?: string;
    };
    navigation: any;
};

export default function UserListItem({ user, navigation }: Props) {
    const { me, toggleFollow } = useUser();
    const [loading, setLoading] = useState(false);

    const isSelf = me?._id?.toString() === user._id?.toString();

    const isFollowing = useMemo(() => {
        const list = me?.followingList || [];
        return list.some((id: any) => id?.toString?.() === user._id?.toString?.());
    }, [me, user._id]);

    const goToProfile = () => {
        navigation.push("UserProfile", { userId: user._id });
    };

    const handleToggle = async () => {
        if (loading) return;
        setLoading(true);
        try {
            await toggleFollow(user._id);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.userInfo} onPress={goToProfile} activeOpacity={0.8}>
                <Image source={{ uri: user.avatarUrl || "https://picsum.photos/200" }} style={styles.avatar} />
                <Text style={styles.pseudo}>{user.pseudo}</Text>
            </TouchableOpacity>

            {!isSelf && (
                <TouchableOpacity
                    style={[styles.followBtn, isFollowing && styles.following, loading && { opacity: 0.7 }]}
                    onPress={handleToggle}
                    disabled={loading}
                    activeOpacity={0.85}
                >
                    {loading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.followText}>{isFollowing ? "Ne plus suivre" : "Suivre"}</Text>
                    )}
                </TouchableOpacity>
            )}
        </View>
    );
}

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
    userInfo: { flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 12 },
    avatar: { width: 42, height: 42, borderRadius: 21, marginRight: 12, backgroundColor: "#111" },
    pseudo: { color: "#fff", fontSize: 16, fontWeight: "600" },
    followBtn: {
        minWidth: 120,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#5E17EB",
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
    },
    following: { backgroundColor: "#330000", borderWidth: 1, borderColor: "#FF4444" },
    followText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});