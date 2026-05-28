import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "truebpm.auth.token";
const LEGACY_TOKEN_KEY = "token";
const USER_KEY = "user";

const secureOptions: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function normalizeToken(token: string | null | undefined) {
    const clean = token?.trim();
    if (!clean) return null;
    return clean.startsWith("Bearer ") ? clean.slice(7).trim() : clean;
}

export function toBearer(token: string | null | undefined) {
    const clean = normalizeToken(token);
    return clean ? `Bearer ${clean}` : null;
}

export async function getStoredToken() {
    const secureToken = normalizeToken(await SecureStore.getItemAsync(TOKEN_KEY));
    if (secureToken) return secureToken;

    const legacyToken = normalizeToken(await AsyncStorage.getItem(LEGACY_TOKEN_KEY));
    if (!legacyToken) return null;

    await SecureStore.setItemAsync(TOKEN_KEY, legacyToken, secureOptions);
    await AsyncStorage.removeItem(LEGACY_TOKEN_KEY).catch(() => {});
    return legacyToken;
}

export async function setStoredToken(token: string) {
    const clean = normalizeToken(token);
    if (!clean) {
        await removeStoredToken();
        return;
    }

    await SecureStore.setItemAsync(TOKEN_KEY, clean, secureOptions);
    await AsyncStorage.removeItem(LEGACY_TOKEN_KEY).catch(() => {});
}

export async function removeStoredToken() {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    await AsyncStorage.removeItem(LEGACY_TOKEN_KEY).catch(() => {});
}

export async function getStoredUser<T = any>() {
    const raw = await AsyncStorage.getItem(USER_KEY);
    if (!raw) return null;

    try {
        return JSON.parse(raw) as T;
    } catch {
        await AsyncStorage.removeItem(USER_KEY).catch(() => {});
        return null;
    }
}

export async function setStoredUser(user: unknown) {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function clearStoredSession() {
    await removeStoredToken();
    await AsyncStorage.removeItem(USER_KEY).catch(() => {});
}
