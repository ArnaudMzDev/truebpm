import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../lib/config";


Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export async function registerForPushNotificationsAsync() {
    if (!Device.isDevice) return null;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== "granted") return null;

    if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.MAX,
        });
    }

    const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ||
        (Constants as any)?.easConfig?.projectId;

    if (!projectId) {
        throw new Error('Missing Expo EAS projectId in app config');
    }

    const token = (
        await Notifications.getExpoPushTokenAsync({ projectId })
    ).data;

    return token;
}

export async function registerPushTokenOnBackend() {
    const token = await registerForPushNotificationsAsync();
    if (!token) return null;

    const authToken = await AsyncStorage.getItem("token");
    if (!authToken) return token;

    const deviceName = Device.deviceName || "";
    const platform =
        Platform.OS === "ios"
            ? "ios"
            : Platform.OS === "android"
                ? "android"
                : "unknown";

    await fetch(`${API_URL}/api/push-tokens/register`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
            token,
            platform,
            deviceName,
        }),
    }).catch(() => {});

    return token;
}