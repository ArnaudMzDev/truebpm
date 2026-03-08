import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    FlatList,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../lib/config";
import { Ionicons } from "@expo/vector-icons";

import PostCard from "../components/PostCard";
import { PostType } from "../components/PostCard/types";
import UserListItem from "../components/UserListItem";


type Filter = "all" | "posts" | "users";

type SearchUser = {
    _id: string;
    pseudo: string;
    avatarUrl?: string;
    bio?: string;
    followers?: number;
    following?: number;
};

type SearchItem =
    | { type: "post"; post: PostType }
    | { type: "user"; user: SearchUser };

type Props = { navigation: any };

function useDebouncedValue<T>(value: T, delayMs: number) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(t);
    }, [value, delayMs]);
    return debounced;
}

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

export default function ExploreSearchScreen({ navigation }: Props) {
    const [connectedUser, setConnectedUser] = useState<any>(null);

    const [query, setQuery] = useState("");
    const debouncedQuery = useDebouncedValue(query, 300);

    const [filter, setFilter] = useState<Filter>("all");

    const [items, setItems] = useState<SearchItem[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);

    const [loadingInitial, setLoadingInitial] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const lastRequestKey = useRef<string>("");

    useEffect(() => {
        (async () => {
            const raw = await AsyncStorage.getItem("user");
            if (raw) {
                try {
                    setConnectedUser(JSON.parse(raw));
                } catch {}
            }
        })();
    }, []);

    const buildUrl = useCallback(
        (q: string, nextCursor: string | null) => {
            const params = new URLSearchParams();
            params.set("q", q);
            params.set("type", filter);
            params.set("limit", "20");
            if (nextCursor) params.set("cursor", nextCursor);
            return `${API_URL}/api/search/global?${params.toString()}`;
        },
        [filter]
    );

    const fetchInitial = useCallback(async () => {
        const q = debouncedQuery.trim().replace(/\s+/g, " ");
        if (q.length < 2) {
            setItems([]);
            setCursor(null);
            setHasMore(true);
            return;
        }

        const key = `${filter}:${q}`;
        lastRequestKey.current = key;

        setLoadingInitial(true);
        setCursor(null);
        setHasMore(true);

        try {
            const res = await fetch(buildUrl(q, null));
            const json = await safeJson(res);

            if (lastRequestKey.current !== key) return;

            if (!res.ok) {
                console.log("Search global error:", res.status, json);
                setItems([]);
                setCursor(null);
                setHasMore(false);
                return;
            }

            const nextItems = (json?.items || []) as SearchItem[];
            setItems(Array.isArray(nextItems) ? nextItems : []);
            setCursor(json?.nextCursor || null);
            setHasMore(!!json?.nextCursor);
        } catch (e) {
            console.log("Search global fetch error:", e);
            setItems([]);
            setCursor(null);
            setHasMore(false);
        } finally {
            if (lastRequestKey.current === key) setLoadingInitial(false);
        }
    }, [debouncedQuery, filter, buildUrl]);

    const loadMore = useCallback(async () => {
        const q = debouncedQuery.trim().replace(/\s+/g, " ");
        if (q.length < 2) return;
        if (!cursor || loadingMore || !hasMore) return;

        setLoadingMore(true);
        try {
            const res = await fetch(buildUrl(q, cursor));
            const json = await safeJson(res);

            if (!res.ok) {
                setHasMore(false);
                return;
            }

            const nextItems = (json?.items || []) as SearchItem[];
            setItems((prev) => [...prev, ...(Array.isArray(nextItems) ? nextItems : [])]);
            setCursor(json?.nextCursor || null);
            setHasMore(!!json?.nextCursor);
        } catch (e) {
            console.log("Search global loadMore error:", e);
        } finally {
            setLoadingMore(false);
        }
    }, [debouncedQuery, cursor, hasMore, loadingMore, buildUrl]);

    useEffect(() => {
        fetchInitial();
    }, [fetchInitial]);

    const FilterButton = useMemo(
        () =>
            function Btn({ value, label }: { value: Filter; label: string }) {
                const active = filter === value;
                return (
                    <TouchableOpacity
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setFilter(value)}
                    >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                );
            },
        [filter]
    );

    const renderItem = ({ item }: { item: SearchItem }) => {
        if (!item) return null;

        if (item.type === "post") {
            // ✅ guard
            if (!item.post?._id) return null;
            return <PostCard post={item.post} />;
        }

        // ✅ guard
        if (!item.user?._id) return null;

        return (
            <UserListItem
                user={item.user}
                navigation={navigation}
            />
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Recherche</Text>

            <View style={styles.searchRow}>
                <Ionicons name="search" size={18} color="#777" />
                <TextInput
                    style={styles.input}
                    placeholder="Rechercher posts et utilisateurs..."
                    placeholderTextColor="#666"
                    value={query}
                    onChangeText={setQuery}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                />
            </View>

            <View style={styles.chipsRow}>
                <FilterButton value="all" label="Tout" />
                <FilterButton value="posts" label="Posts" />
                <FilterButton value="users" label="Utilisateurs" />
            </View>

            {loadingInitial ? (
                <ActivityIndicator color="#9B5CFF" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(it, idx) => {
                        // ✅ super safe
                        if (!it) return `x:${idx}`;

                        if (it.type === "post") {
                            return it.post?._id ? `p:${it.post._id}` : `p:${idx}`;
                        }

                        return it.user?._id ? `u:${it.user._id}` : `u:${idx}`;
                    }}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 160 }}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    ListEmptyComponent={
                        debouncedQuery.trim().length >= 2 ? (
                            <Text style={styles.empty}>Aucun résultat</Text>
                        ) : (
                            <Text style={styles.empty}>Tape au moins 2 caractères</Text>
                        )
                    }
                    ListFooterComponent={
                        loadingMore ? <ActivityIndicator color="#9B5CFF" style={{ marginVertical: 14 }} /> : null
                    }
                    keyboardShouldPersistTaps="handled"
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#000", paddingTop: 50, paddingHorizontal: 16 },
    title: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 14 },
    searchRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: "#111",
        borderRadius: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: "#222",
    },
    input: { flex: 1, height: 46, color: "#fff", fontSize: 15 },
    chipsRow: { flexDirection: "row", gap: 10, marginTop: 12, marginBottom: 10 },
    chip: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: "#111",
        borderWidth: 1,
        borderColor: "#222",
    },
    chipActive: { backgroundColor: "#5E17EB", borderColor: "#5E17EB" },
    chipText: { color: "#bbb", fontWeight: "700", fontSize: 13 },
    chipTextActive: { color: "#fff" },
    empty: { color: "#777", textAlign: "center", marginTop: 30 },
});