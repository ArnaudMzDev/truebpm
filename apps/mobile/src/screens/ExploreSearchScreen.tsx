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
import AppScreen from "../components/ui/AppScreen";
import AppHeader from "../components/ui/AppHeader";
import AppEmptyState from "../components/ui/AppEmptyState";
import AppSectionLoader from "../components/ui/AppSectionLoader";
import { colors, radius, spacing, typography, fontWeights } from "../theme";
import { getStoredToken } from "../lib/authStorage";


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
        if (__DEV__) console.log("Non-JSON response:", text.slice(0, 200));
        return null;
    }
}

export default function ExploreSearchScreen({ navigation }: Props) {
    const [connectedUser, setConnectedUser] = useState<any>(null);

    const [query, setQuery] = useState("");
    const debouncedQuery = useDebouncedValue(query, 300);

    const [filter, setFilter] = useState<Filter>("all");

    const [items, setItems] = useState<SearchItem[]>([]);
    const [discoverItems, setDiscoverItems] = useState<SearchItem[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);

    const [loadingInitial, setLoadingInitial] = useState(false);
    const [loadingDiscover, setLoadingDiscover] = useState(false);
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

    const fetchDiscover = useCallback(async () => {
        const key = `discover:${filter}`;
        lastRequestKey.current = key;
        setLoadingDiscover(true);

        try {
            const token = await getStoredToken();
            const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

            const [postsRes, usersRes] = await Promise.all([
                filter !== "users"
                    ? fetch(`${API_URL}/api/posts?feed=forYou&limit=8`, { headers })
                    : Promise.resolve(null),
                filter !== "posts" && token
                    ? fetch(`${API_URL}/api/user/suggestions?limit=8`, { headers })
                    : Promise.resolve(null),
            ]);

            const [postsJson, usersJson] = await Promise.all([
                postsRes ? safeJson(postsRes) : Promise.resolve(null),
                usersRes ? safeJson(usersRes) : Promise.resolve(null),
            ]);

            if (lastRequestKey.current !== key) return;

            const postItems: SearchItem[] =
                postsRes?.ok && Array.isArray(postsJson?.posts)
                    ? postsJson.posts.map((post: PostType) => ({ type: "post" as const, post }))
                    : [];

            const userItems: SearchItem[] =
                usersRes?.ok && Array.isArray(usersJson?.users)
                    ? usersJson.users.map((user: SearchUser) => ({ type: "user" as const, user }))
                    : [];

            if (filter === "posts") {
                setDiscoverItems(postItems);
                return;
            }

            if (filter === "users") {
                setDiscoverItems(userItems);
                return;
            }

            const merged: SearchItem[] = [];
            const max = Math.max(postItems.length, userItems.length);
            for (let i = 0; i < max; i += 1) {
                if (i < postItems.length) merged.push(postItems[i]);
                if (i < userItems.length) merged.push(userItems[i]);
            }
            setDiscoverItems(merged);
        } catch (e) {
            console.log("Explore discover fetch error:", e);
            if (lastRequestKey.current === key) setDiscoverItems([]);
        } finally {
            if (lastRequestKey.current === key) setLoadingDiscover(false);
        }
    }, [filter]);

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

    useEffect(() => {
        if (debouncedQuery.trim().length < 2) {
            fetchDiscover();
        }
    }, [debouncedQuery, fetchDiscover]);

    const FilterButton = useMemo(
        () =>
            function Btn({
                value,
                label,
                icon,
            }: {
                value: Filter;
                label: string;
                icon: keyof typeof Ionicons.glyphMap;
            }) {
                const active = filter === value;
                return (
                    <TouchableOpacity
                        style={[styles.chip, active && styles.chipActive]}
                        activeOpacity={0.86}
                        onPress={() => setFilter(value)}
                    >
                        <Ionicons
                            name={icon}
                            size={15}
                            color={active ? colors.text : colors.textFaint}
                        />
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

    const isSearching = debouncedQuery.trim().length >= 2;
    const visibleItems = isSearching ? items : discoverItems;
    const showInitialLoader = isSearching ? loadingInitial : loadingDiscover;

    return (
        <AppScreen>
            <AppHeader
                title="Recherche"
                compact
            />

            <View style={styles.searchRow}>
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                    style={styles.input}
                    placeholder="Rechercher posts et utilisateurs..."
                    placeholderTextColor={colors.textFaint}
                    value={query}
                    onChangeText={setQuery}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                />
            </View>

            <View style={styles.chipsRow}>
                <FilterButton value="all" label="Tout" icon="sparkles-outline" />
                <FilterButton value="posts" label="Avis" icon="albums-outline" />
                <FilterButton value="users" label="Profils" icon="person-outline" />
            </View>

            <View style={styles.sectionHead}>
                <Text style={styles.sectionEyebrow}>{isSearching ? "Résultats" : "Suggestions"}</Text>
                <Text style={styles.sectionTitle}>
                    {isSearching ? `“${debouncedQuery.trim()}”` : "À découvrir"}
                </Text>
            </View>

            {showInitialLoader ? (
                <AppSectionLoader />
            ) : (
                <FlatList
                    data={visibleItems}
                    keyExtractor={(it, idx) => {
                        // ✅ super safe
                        if (!it) return `x:${idx}`;

                        if (it.type === "post") {
                            return it.post?._id ? `p:${it.post._id}` : `p:${idx}`;
                        }

                        return it.user?._id ? `u:${it.user._id}` : `u:${idx}`;
                    }}
                    renderItem={renderItem}
                    contentContainerStyle={styles.resultsContent}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    ListEmptyComponent={
                        isSearching ? (
                            <AppEmptyState
                                icon="search-outline"
                                title="Aucun résultat"
                                text="Essaie moins de mots."
                            />
                        ) : (
                            <AppEmptyState
                                icon="sparkles-outline"
                                title="Suggestions indisponibles"
                                text="Lance une recherche."
                            />
                        )
                    }
                    ListFooterComponent={
                        isSearching && loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 14 }} /> : null
                    }
                    keyboardShouldPersistTaps="handled"
                />
            )}
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    searchRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        backgroundColor: "rgba(12, 15, 21, 0.78)",
        borderRadius: 24,
        paddingHorizontal: spacing.md,
        minHeight: 50,
    },
    input: {
        flex: 1,
        height: 48,
        color: colors.text,
        fontSize: 15,
        fontWeight: fontWeights.bold,
    },
    chipsRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        marginTop: spacing.md,
        marginBottom: spacing.lg,
        padding: 4,
        borderRadius: radius.pill,
        backgroundColor: "rgba(20, 24, 33, 0.42)",
    },
    chip: {
        flex: 1,
        minHeight: 38,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: radius.pill,
        backgroundColor: "transparent",
    },
    chipActive: {
        backgroundColor: "rgba(151, 89, 255, 0.2)",
    },
    chipText: {
        color: colors.textMuted,
        fontWeight: fontWeights.extraBold,
        fontSize: typography.caption,
    },
    chipTextActive: {
        color: colors.text,
        fontWeight: fontWeights.black,
    },
    sectionHead: {
        marginBottom: spacing.md,
        paddingHorizontal: spacing.xs,
    },
    sectionEyebrow: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        letterSpacing: 3,
        textTransform: "uppercase",
        marginBottom: 4,
    },
    sectionTitle: {
        color: colors.text,
        fontSize: 21,
        fontWeight: fontWeights.black,
    },
    resultsContent: {
        paddingBottom: 160,
    },
});
