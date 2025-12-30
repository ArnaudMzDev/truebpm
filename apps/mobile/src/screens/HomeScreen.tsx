// apps/mobile/src/screens/HomeScreen.tsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    FlatList,
    RefreshControl,
} from "react-native";
import Constants from "expo-constants";
import PostCard from "../components/PostCard";
import { PostType } from "../components/PostCard/types";

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

export default function HomeScreen() {
    const [posts, setPosts] = useState<PostType[]>([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);

    const LIMIT = 15;

    // évite les double fetch (React 18 strict mode / remount)
    const didInit = useRef(false);

    const fetchInitial = useCallback(async () => {
        try {
            setInitialLoading(true);
            setCursor(null);
            setHasMore(true);

            const res = await fetch(`${API_URL}/api/posts?limit=${LIMIT}`);
            const json = await safeJson(res);

            if (!res.ok) {
                console.log("Home fetchInitial error:", res.status, json);
                setPosts([]);
                setCursor(null);
                setHasMore(false);
                return;
            }

            setPosts(json?.posts || []);
            setCursor(json?.nextCursor || null);
            setHasMore(!!json?.nextCursor);
        } catch (err) {
            console.log("Home fetchInitial error:", err);
        } finally {
            setInitialLoading(false);
        }
    }, []);

    const loadMore = useCallback(async () => {
        if (!cursor || loadingMore || !hasMore) return;

        try {
            setLoadingMore(true);

            const res = await fetch(
                `${API_URL}/api/posts?limit=${LIMIT}&cursor=${encodeURIComponent(cursor)}`
            );
            const json = await safeJson(res);

            if (!res.ok) {
                console.log("Home loadMore error:", res.status, json);
                return;
            }

            const newPosts: PostType[] = json?.posts || [];
            setPosts((prev) => [...prev, ...newPosts]);

            setCursor(json?.nextCursor || null);
            setHasMore(!!json?.nextCursor);
        } catch (err) {
            console.log("Home loadMore error:", err);
        } finally {
            setLoadingMore(false);
        }
    }, [cursor, loadingMore, hasMore]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchInitial();
        setRefreshing(false);
    };

    useEffect(() => {
        if (didInit.current) return;
        didInit.current = true;
        fetchInitial();
    }, [fetchInitial]);

    if (initialLoading && posts.length === 0) {
        return (
            <View style={styles.loader}>
                <ActivityIndicator size="large" color="#9B5CFF" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Accueil</Text>

            <FlatList
                data={posts}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => <PostCard post={item} />}
                contentContainerStyle={{ paddingBottom: 40 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#9B5CFF"
                    />
                }
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                    loadingMore ? (
                        <ActivityIndicator
                            size="small"
                            color="#9B5CFF"
                            style={{ marginVertical: 14 }}
                        />
                    ) : null
                }
            />
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
    loader: {
        flex: 1,
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
    },
});