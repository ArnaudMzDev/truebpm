import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../lib/config";


type Me = any;

type UserEvent =
    | { type: "ME_UPDATED"; me: Me }
    | { type: "FOLLOW_TOGGLED"; targetId: string; following: boolean; me: Me };

type Listener = (event: UserEvent) => void;

type UserContextType = {
    me: Me | null;
    setMe: (next: Me | null) => Promise<void>;
    refreshMe: () => Promise<Me | null>;
    subscribe: (listener: Listener) => () => void;
    // helper follow/unfollow centralisé (optionnel mais pratique)
    toggleFollow: (targetId: string) => Promise<{ ok: boolean; following?: boolean }>;
};

const UserContext = createContext<UserContextType | null>(null);

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

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [me, _setMe] = useState<Me | null>(null);

    // ✅ event bus
    const listenersRef = useRef(new Set<Listener>());
    const emit = useCallback((event: UserEvent) => {
        listenersRef.current.forEach((fn) => {
            try {
                fn(event);
            } catch (e) {
                console.log("UserContext listener error:", e);
            }
        });
    }, []);

    const subscribe = useCallback((listener: Listener) => {
        listenersRef.current.add(listener);
        return () => listenersRef.current.delete(listener);
    }, []);

    const setMe = useCallback(
        async (next: Me | null) => {
            _setMe(next);
            if (next) {
                await AsyncStorage.setItem("user", JSON.stringify(next));
                emit({ type: "ME_UPDATED", me: next });
            } else {
                await AsyncStorage.removeItem("user");
            }
        },
        [emit]
    );

    const hydrateFromCache = useCallback(async () => {
        const raw = await AsyncStorage.getItem("user");
        if (!raw) return null;
        try {
            const cached = JSON.parse(raw);
            if (cached?._id) _setMe(cached);
            return cached;
        } catch {
            return null;
        }
    }, []);

    const refreshMe = useCallback(async () => {
        const token = await AsyncStorage.getItem("token");
        if (!token) return null;

        const res = await fetch(`${API_URL}/api/user/me`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
        });

        const json = await safeJson(res);
        if (!res.ok || !json?.user?._id) return null;

        await setMe(json.user);
        return json.user;
    }, [setMe]);

    // ✅ au boot : cache -> puis refresh (best UX)
    useEffect(() => {
        (async () => {
            await hydrateFromCache();
            await refreshMe();
        })();
    }, [hydrateFromCache, refreshMe]);

    // ✅ follow/unfollow centralisé + update me + emit
    const toggleFollow = useCallback(
        async (targetId: string) => {
            const token = await AsyncStorage.getItem("token");
            if (!token) return { ok: false };

            const res = await fetch(`${API_URL}/api/follow/${targetId}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            const json = await safeJson(res);
            if (!res.ok || !json) return { ok: false };

            const didFollow = json.status === "followed" || json.following === true;

            // update ME local
            const current = me || (await hydrateFromCache());
            if (current?._id) {
                const prevList: string[] = (current.followingList || []).map((x: any) => x?.toString?.());
                let nextList = prevList;

                if (didFollow) {
                    if (!prevList.includes(targetId)) nextList = [...prevList, targetId];
                } else {
                    nextList = prevList.filter((id) => id !== targetId);
                }

                const nextMe = {
                    ...current,
                    followingList: nextList,
                    following:
                        typeof json.followingCount === "number"
                            ? json.followingCount
                            : Math.max(0, (current.following || 0) + (didFollow ? 1 : -1)),
                };

                await setMe(nextMe);

                emit({
                    type: "FOLLOW_TOGGLED",
                    targetId,
                    following: didFollow,
                    me: nextMe,
                });
            }

            return { ok: true, following: didFollow };
        },
        [emit, hydrateFromCache, me, setMe]
    );

    const value = useMemo(
        () => ({ me, setMe, refreshMe, subscribe, toggleFollow }),
        [me, setMe, refreshMe, subscribe, toggleFollow]
    );

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
    const ctx = useContext(UserContext);
    if (!ctx) throw new Error("useUser must be used within UserProvider");
    return ctx;
}