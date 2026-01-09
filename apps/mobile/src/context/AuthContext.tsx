// apps/mobile/src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { emit } from "../lib/userEvents";

const localIP = Constants.expoConfig?.hostUri?.split(":")[0];
const API_URL = `http://${localIP}:3000`;

type User = {
    _id: string;
    pseudo: string;
    email: string;
    bio?: string;
    avatarUrl?: string;
    bannerUrl?: string;
    followers?: number;
    following?: number;
    followersList?: string[];
    followingList?: string[];
    notesCount?: number;
};

type AuthContextType = {
    token: string | null;
    user: User | null;
    bootstrapped: boolean;

    setSession: (token: string, user: User) => Promise<void>;
    logout: () => Promise<void>;
    refreshMe: () => Promise<User | null>;

    applyFollowUpdate: (payload: {
        targetId: string;
        status: "followed" | "unfollowed";
        meFollowing: number;
    }) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [bootstrapped, setBootstrapped] = useState(false);

    // hydrate cache local
    useEffect(() => {
        (async () => {
            const t = await AsyncStorage.getItem("token");
            const u = await AsyncStorage.getItem("user");
            if (t) setToken(t);
            if (u) {
                try { setUser(JSON.parse(u)); } catch {}
            }
            setBootstrapped(true);
        })();
    }, []);

    const setSession = async (t: string, u: User) => {
        setToken(t);
        setUser(u);
        await AsyncStorage.setItem("token", t);
        await AsyncStorage.setItem("user", JSON.stringify(u));
        emit("meUpdated", undefined);
    };

    const logout = async () => {
        setToken(null);
        setUser(null);
        await AsyncStorage.multiRemove(["token", "user"]);
        emit("meUpdated", undefined);
    };

    const refreshMe = async () => {
        const t = token ?? (await AsyncStorage.getItem("token"));
        if (!t) {
            await logout();
            return null;
        }

        const res = await fetch(`${API_URL}/api/user/me`, {
            method: "GET",
            headers: { Authorization: `Bearer ${t}` },
        });

        const json = await safeJson(res);

        if (!res.ok || !json?.user?._id) {
            await logout();
            return null;
        }

        setToken(t);
        setUser(json.user);
        await AsyncStorage.setItem("token", t);
        await AsyncStorage.setItem("user", JSON.stringify(json.user));
        emit("meUpdated", undefined);
        return json.user;
    };

    // update immédiat (optimistic)
    const applyFollowUpdate = async ({
                                         targetId,
                                         status,
                                         meFollowing,
                                     }: {
        targetId: string;
        status: "followed" | "unfollowed";
        meFollowing: number;
    }) => {
        setUser((prev) => {
            if (!prev) return prev;

            const currentList = Array.isArray(prev.followingList) ? prev.followingList : [];
            let nextList = currentList;

            if (status === "followed") {
                if (!currentList.includes(targetId)) nextList = [...currentList, targetId];
            } else {
                nextList = currentList.filter((id) => id !== targetId);
            }

            const next = {
                ...prev,
                following: meFollowing,
                followingList: nextList,
            };

            AsyncStorage.setItem("user", JSON.stringify(next)).catch(() => {});
            emit("meUpdated", undefined);
            return next;
        });
    };

    const value = useMemo<AuthContextType>(
        () => ({ token, user, bootstrapped, setSession, logout, refreshMe, applyFollowUpdate }),
        [token, user, bootstrapped]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}