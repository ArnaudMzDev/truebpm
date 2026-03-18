import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../lib/config";

type FollowStatus = "none" | "requested" | "following";

type FollowToggleResult = {
    ok: boolean;
    status?: FollowStatus;
    error?: string;
};

type UserEvent =
    | {
    type: "FOLLOW_TOGGLED";
    targetId: string;
    following: boolean;
};

type UserContextType = {
    me: any;
    refreshMe: () => Promise<void>;
    toggleFollow: (targetUserId: string) => Promise<FollowToggleResult>;
    subscribe: (listener: (event: UserEvent) => void) => () => void;
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
    const [me, setMe] = useState<any>(null);
    const listenersRef = useRef<Array<(event: UserEvent) => void>>([]);

    const emit = useCallback((event: UserEvent) => {
        for (const listener of listenersRef.current) {
            try {
                listener(event);
            } catch {}
        }
    }, []);

    const refreshMe = useCallback(async () => {
        const token = await AsyncStorage.getItem("token");
        if (!token) {
            setMe(null);
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/user/me`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const json = await safeJson(res);
            if (!res.ok || !json?.user?._id) {
                setMe(null);
                return;
            }

            setMe(json.user);
            await AsyncStorage.setItem("user", JSON.stringify(json.user));
        } catch (e) {
            console.log("refreshMe error:", e);
        }
    }, []);

    useEffect(() => {
        refreshMe();
    }, [refreshMe]);

    const toggleFollow = useCallback(
        async (targetUserId: string): Promise<FollowToggleResult> => {
            const token = await AsyncStorage.getItem("token");
            if (!token) {
                return { ok: false, error: "Non authentifié." };
            }

            const wasFollowing =
                Array.isArray(me?.followingList) &&
                me.followingList.some((id: any) => String(id) === String(targetUserId));

            try {
                const res = await fetch(`${API_URL}/api/follow/toggle`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ targetUserId }),
                });

                const json = await safeJson(res);
                if (!res.ok) {
                    return { ok: false, error: json?.error || "Impossible de modifier le suivi." };
                }

                const status = (json?.status || "none") as FollowStatus;
                const nowFollowing = status === "following";

                setMe((prev: any) => {
                    if (!prev?._id) return prev;

                    const currentList = Array.isArray(prev.followingList) ? prev.followingList : [];
                    let nextList = currentList;

                    if (status === "following") {
                        const already = currentList.some((id: any) => String(id) === String(targetUserId));
                        nextList = already ? currentList : [...currentList, targetUserId];
                    } else {
                        nextList = currentList.filter((id: any) => String(id) !== String(targetUserId));
                    }

                    return {
                        ...prev,
                        followingList: nextList,
                        following: nextList.length,
                    };
                });

                if (wasFollowing !== nowFollowing) {
                    emit({
                        type: "FOLLOW_TOGGLED",
                        targetId: targetUserId,
                        following: nowFollowing,
                    });
                }

                return { ok: true, status };
            } catch (e) {
                console.log("toggleFollow error:", e);
                return { ok: false, error: "Erreur réseau." };
            }
        },
        [emit, me?.followingList]
    );

    const subscribe = useCallback((listener: (event: UserEvent) => void) => {
        listenersRef.current.push(listener);

        return () => {
            listenersRef.current = listenersRef.current.filter((l) => l !== listener);
        };
    }, []);

    const value = useMemo(
        () => ({
            me,
            refreshMe,
            toggleFollow,
            subscribe,
        }),
        [me, refreshMe, toggleFollow, subscribe]
    );

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
    const ctx = useContext(UserContext);
    if (!ctx) {
        throw new Error("useUser must be used inside UserProvider");
    }
    return ctx;
}