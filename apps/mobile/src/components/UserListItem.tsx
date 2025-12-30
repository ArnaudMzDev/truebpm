import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const localIP = Constants.expoConfig?.hostUri?.split(":")[0];
const API_URL = `http://${localIP}:3000`;

type Props = {
    user: {
        _id: string;
        pseudo: string;
        avatarUrl?: string;
    };
    connectedUser: any;
    navigation: any;
};

export default function UserListItem({ user, connectedUser, navigation }: Props) {
    const [isFollowing, setIsFollowing] = useState(false);

    useEffect(() => {
        if (connectedUser?.followingList?.includes(user._id)) {
            setIsFollowing(true);
        }
    }, [connectedUser]);

    const handleToggle = async () => {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        const res = await fetch(`${API_URL}/api/follow/${user._id}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
        });

        const json = await res.json();
        if (!res.ok) return;

        setIsFollowing(json.status === "followed");
    };

    const goToProfile = () => {
        navigation.push("UserProfile", { userId: user._id });
    };

    const isSelf = connectedUser?._id === user._id;

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.userInfo} onPress={goToProfile}>
                <Image
                    source={{ uri: user.avatarUrl || "https://picsum.photos/200" }}
                    style={styles.avatar}
                />
                <Text style={styles.pseudo}>{user.pseudo}</Text>
            </TouchableOpacity>

            {!isSelf && (
                <TouchableOpacity
                    style={[styles.followBtn, isFollowing && styles.following]}
                    onPress={handleToggle}
                >
                    <Text style={styles.followText}>
                        {isFollowing ? "Ne plus suivre" : "Suivre"}
                    </Text>
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
        backgroundColor: "#000"
    },
    userInfo: {
        flexDirection: "row",
        alignItems: "center"
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        marginRight: 12
    },
    pseudo: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600"
    },
    followBtn: {
        backgroundColor: "#5E17EB",
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 8
    },
    following: {
        backgroundColor: "#330000",
        borderWidth: 1,
        borderColor: "#FF4444"
    },
    followText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600"
    }
});