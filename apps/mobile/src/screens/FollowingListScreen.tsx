// apps/mobile/src/screens/FollowingListScreen.tsx
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
import { useFocusEffect } from "@react-navigation/native";
import UserListItem from "../components/UserListItem";

const localIP = Constants.expoConfig?.hostUri?.split(":")[0];
const API_URL = `http://${localIP}:3000`;

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

function useDebouncedValue(value: string, delay = 250) {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);

    return debounced;
}

export default function FollowingListScreen({ route, navigation }: any) {
    const { userId } = route.params;

    const [connectedUser, setConnectedUser] = useState<any>(null);

    const [users, setUsers] = useState<any[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const debouncedSearch = useDebouncedValue(search, 250);

    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const LIMIT = 20;

    const loadConnectedUser = useCallback(async () => {
        const raw = await AsyncStorage.getItem("user");
        if (!raw) {
            setConnectedUser(null);
            return;
        }
        try {
            setConnectedUser(JSON.parse(raw));
        } catch {
            setConnectedUser(null);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadConnectedUser();
        }, [loadConnectedUser])
    );

    const fetchFollowing = useCallback(
        async (opts?: { append?: boolean; cursorOverride?: string | null }) => {
            const append = !!opts?.append;
            const c = opts?.cursorOverride ?? null;

            if (!append) setLoading(true);

            const url =
                `${API_URL}/api/user/${userId}/following` +
                `?limit=${LIMIT}` +
                `&search=${encodeURIComponent(debouncedSearch || "")}` +
                (c ? `&cursor=${encodeURIComponent(c)}` : "");

            const res = await fetch(url);
            const json = await safeJson(res);

            if (!res.ok) {
                console.log("fetchFollowing error:", res.status, json);
                if (!append) setUsers([]);
                setCursor(null);
                setHasMore(false);
                setLoading(false);
                return;
            }

            const newUsers = json?.users || [];
            const next = json?.nextCursor || null;

            setUsers((prev) => (append ? [...prev, ...newUsers] : newUsers));
            setCursor(next);
            setHasMore(!!next);

            if (!append) setLoading(false);
        },
        [userId, debouncedSearch]
    );

    useEffect(() => {
        fetchFollowing({ append: false, cursorOverride: null });
    }, [fetchFollowing]);

    const loadMore = useCallback(async () => {
        if (!cursor || loadingMore || !hasMore) return;

        setLoadingMore(true);
        try {
            await fetchFollowing({ append: true, cursorOverride: cursor });
        } finally {
            setLoadingMore(false);
        }
    }, [cursor, loadingMore, hasMore, fetchFollowing]);

    const handleConnectedUserChange = useCallback(async (nextMe: any) => {
        setConnectedUser(nextMe);
        await AsyncStorage.setItem("user", JSON.stringify(nextMe));
    }, []);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Abonnements</Text>

            <TextInput
                style={styles.search}
                placeholder="Rechercher..."
                placeholderTextColor="#666"
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
            />

            {loading ? (
                <ActivityIndicator color="#9B5CFF" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={users}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <UserListItem user={item} navigation={navigation} />
                    )}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.4}
                    ListFooterComponent={
                        loadingMore ? (
                            <ActivityIndicator color="#9B5CFF" style={{ marginVertical: 14 }} />
                        ) : null
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#000", paddingTop: 50, paddingHorizontal: 16 },
    title: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 16 },
    search: {
        backgroundColor: "#111",
        borderRadius: 10,
        padding: 12,
        marginBottom: 20,
        color: "#fff",
    },
});