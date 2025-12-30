import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    TextInput,
    FlatList,
    ActivityIndicator,
    StyleSheet,
    Text,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import UserListItem from "../components/UserListItem";

const localIP = Constants.expoConfig?.hostUri?.split(":")[0];
const API_URL = `http://${localIP}:3000`;

export default function FollowersListScreen({ route, navigation }: any) {
    const { userId } = route.params;

    const [connectedUser, setConnectedUser] = useState<any>(null);

    const [users, setUsers] = useState<any[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const LIMIT = 20;

    useEffect(() => {
        const load = async () => {
            const raw = await AsyncStorage.getItem("user");
            if (raw) setConnectedUser(JSON.parse(raw));
        };
        load();
    }, []);

    const fetchFollowers = useCallback(async () => {
        setLoading(true);

        const res = await fetch(
            `${API_URL}/api/user/${userId}/followers?limit=${LIMIT}&search=${search}`
        );
        const json = await res.json();

        setUsers(json.users || []);
        setCursor(json.nextCursor || null);
        setHasMore(!!json.nextCursor);
        setLoading(false);
    }, [search]);

    useEffect(() => {
        fetchFollowers();
    }, [fetchFollowers]);

    const loadMore = async () => {
        if (!cursor || loadingMore || !hasMore) return;

        setLoadingMore(true);

        const res = await fetch(
            `${API_URL}/api/user/${userId}/followers?limit=${LIMIT}&cursor=${cursor}&search=${search}`
        );
        const json = await res.json();

        setUsers(prev => [...prev, ...json.users]);
        setCursor(json.nextCursor || null);
        setHasMore(!!json.nextCursor);
        setLoadingMore(false);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Followers</Text>

            <TextInput
                style={styles.search}
                placeholder="Rechercher..."
                placeholderTextColor="#666"
                value={search}
                onChangeText={setSearch}
            />

            {loading ? (
                <ActivityIndicator color="#9B5CFF" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={users}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <UserListItem
                            user={item}
                            connectedUser={connectedUser}
                            navigation={navigation}
                        />
                    )}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.4}
                    ListFooterComponent={
                        loadingMore ? (
                            <ActivityIndicator
                                color="#9B5CFF"
                                style={{ marginVertical: 14 }}
                            />
                        ) : null
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
        paddingTop: 50,
        paddingHorizontal: 16,
    },
    title: {
        color: "#fff",
        fontSize: 22,
        fontWeight: "700",
        marginBottom: 16,
    },
    search: {
        backgroundColor: "#111",
        borderRadius: 10,
        padding: 12,
        marginBottom: 20,
        color: "#fff",
    },
});