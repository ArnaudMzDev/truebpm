import Constants from "expo-constants";

declare const process: {
    env?: Record<string, string | undefined>;
};

const extra = (Constants.expoConfig?.extra || {}) as Record<string, string | undefined>;

function getDevServerHost() {
    const rawHost =
        Constants.expoConfig?.hostUri ||
        (Constants as any)?.manifest?.debuggerHost ||
        (Constants as any)?.manifest2?.extra?.expoClient?.hostUri ||
        "";

    const host = String(rawHost)
        .replace(/^https?:\/\//, "")
        .replace(/^exp:\/\//, "")
        .split("/")[0]
        .split(":")[0]
        .trim();

    return host || "";
}

function getLocalUrl(port: number) {
    const host = getDevServerHost();
    if (!host || host === "localhost" || host === "127.0.0.1") return "";
    return `http://${host}:${port}`;
}

const localApiUrl = getLocalUrl(3000);
const localSocketUrl = getLocalUrl(3001);
const configuredApiUrl = process.env?.EXPO_PUBLIC_API_URL || extra.apiUrl;
const configuredSocketUrl = process.env?.EXPO_PUBLIC_SOCKET_URL || extra.socketUrl;

export const API_URL =
    (__DEV__ ? localApiUrl : "") ||
    configuredApiUrl ||
    localApiUrl ||
    "http://192.168.1.25:3000";

export const SOCKET_URL =
    (__DEV__ ? localSocketUrl : "") ||
    configuredSocketUrl ||
    localSocketUrl ||
    "http://192.168.1.25:3001";
