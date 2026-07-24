import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../lib/config";
import { getStoredToken } from "./authStorage";

const ENGAGEMENT_REMINDERS_ENABLED_KEY = "truebpm:engagement-reminders:enabled";
const ENGAGEMENT_REMINDERS_IDS_KEY = "truebpm:engagement-reminders:ids";
const ENGAGEMENT_REMINDERS_CHANNEL_ID = "engagement-reminders";

type EngagementReminder = {
    id: string;
    title: string;
    body: string;
    weekday: number;
    hour: number;
    minute: number;
};

const ENGAGEMENT_REMINDERS: EngagementReminder[] = [
    {
        id: "wednesday-note",
        title: "Le son du moment mérite une note.",
        body: "Même une phrase courte suffit.",
        weekday: 4,
        hour: 19,
        minute: 45,
    },
    {
        id: "feed-check",
        title: "Tes potes ont peut-être trouvé une pépite.",
        body: "Passe voir ce qui tourne sur TrueBPM.",
        weekday: 5,
        hour: 19,
        minute: 45,
    },
    {
        id: "friday-release",
        title: "Les sorties du vendredi sont là.",
        body: "Va voir les nouveautés et note le son qui tourne déjà.",
        weekday: 6,
        hour: 10,
        minute: 15,
    },
    {
        id: "sunday-note",
        title: "Le mood du week-end mérite une note.",
        body: "Ajoute un avis, même court.",
        weekday: 1,
        hour: 18,
        minute: 30,
    },
];

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

async function ensureEngagementReminderChannel() {
    if (Platform.OS !== "android") return;

    await Notifications.setNotificationChannelAsync(ENGAGEMENT_REMINDERS_CHANNEL_ID, {
        name: "Rappels TrueBPM",
        importance: Notifications.AndroidImportance.DEFAULT,
    });
}

async function hasNotificationPermission(requestIfNeeded = false) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === "granted") return true;
    if (!requestIfNeeded) return false;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
}

async function getStoredReminderIds() {
    const raw = await AsyncStorage.getItem(ENGAGEMENT_REMINDERS_IDS_KEY);
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
    } catch {
        return [];
    }
}

export async function registerForPushNotificationsAsync() {
    if (!Device.isDevice) return null;

    const granted = await hasNotificationPermission(true);
    if (!granted) return null;

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

export async function getEngagementRemindersEnabled() {
    const stored = await AsyncStorage.getItem(ENGAGEMENT_REMINDERS_ENABLED_KEY);
    return stored !== "false";
}

export async function cancelEngagementReminderNotifications() {
    const storedIds = await getStoredReminderIds();
    const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
    const discoveredIds = scheduled
        .filter((notification) => notification.content.data?.truebpmReminder === true)
        .map((notification) => notification.identifier);
    const ids = Array.from(new Set([...storedIds, ...discoveredIds]));

    await Promise.all(
        ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
    );
    await AsyncStorage.removeItem(ENGAGEMENT_REMINDERS_IDS_KEY);
}

export async function syncEngagementReminderNotifications(options?: { requestPermission?: boolean }) {
    const enabled = await getEngagementRemindersEnabled();

    if (!enabled) {
        await cancelEngagementReminderNotifications();
        return { enabled: false, scheduled: 0 };
    }

    const granted = await hasNotificationPermission(options?.requestPermission === true);
    if (!granted) {
        await cancelEngagementReminderNotifications();
        return { enabled: true, scheduled: 0, permission: "denied" as const };
    }

    await ensureEngagementReminderChannel();
    await cancelEngagementReminderNotifications();

    const ids: string[] = [];
    for (const reminder of ENGAGEMENT_REMINDERS) {
        const identifier = await Notifications.scheduleNotificationAsync({
            content: {
                title: reminder.title,
                body: reminder.body,
                sound: true,
                data: {
                    type: "engagement_reminder",
                    truebpmReminder: true,
                    reminderId: reminder.id,
                },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                weekday: reminder.weekday,
                hour: reminder.hour,
                minute: reminder.minute,
                channelId: ENGAGEMENT_REMINDERS_CHANNEL_ID,
            },
        });
        ids.push(identifier);
    }

    await AsyncStorage.setItem(ENGAGEMENT_REMINDERS_IDS_KEY, JSON.stringify(ids));
    return { enabled: true, scheduled: ids.length };
}

export async function setEngagementRemindersEnabled(enabled: boolean) {
    await AsyncStorage.setItem(
        ENGAGEMENT_REMINDERS_ENABLED_KEY,
        enabled ? "true" : "false"
    );

    if (!enabled) {
        await cancelEngagementReminderNotifications();
        return { enabled: false, scheduled: 0 };
    }

    return syncEngagementReminderNotifications({ requestPermission: true });
}

export async function registerPushTokenOnBackend() {
    const token = await registerForPushNotificationsAsync();
    if (!token) return null;

    const authToken = await getStoredToken();
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
