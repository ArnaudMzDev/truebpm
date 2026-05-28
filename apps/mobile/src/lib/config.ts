import Constants from "expo-constants";

declare const process: {
    env?: Record<string, string | undefined>;
};

const extra = (Constants.expoConfig?.extra || {}) as Record<string, string | undefined>;

export const API_URL =
    process.env?.EXPO_PUBLIC_API_URL ||
    extra.apiUrl ||
    "http://192.168.1.25:3000";

export const SOCKET_URL =
    process.env?.EXPO_PUBLIC_SOCKET_URL ||
    extra.socketUrl ||
    "http://192.168.1.25:3001";
