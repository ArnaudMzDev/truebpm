import React, { useCallback, useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ScrollView,
    Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL } from "../lib/config";
import { colors, spacing, radius, typography, fontWeights } from "../theme";
import { getStoredToken, clearStoredSession } from "../lib/authStorage";
import {
    getEngagementRemindersEnabled,
    setEngagementRemindersEnabled,
} from "../lib/pushNotifications";

type NotificationSettings = {
    enabled: boolean;
    follows: boolean;
    likes: boolean;
    comments: boolean;
    reposts: boolean;
    postsFromFollowing: boolean;
    notesFromFollowing: boolean;
    sameMusic: boolean;
    artistReleases: boolean;
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
    enabled: true,
    follows: true,
    likes: true,
    comments: true,
    reposts: true,
    postsFromFollowing: true,
    notesFromFollowing: true,
    sameMusic: true,
    artistReleases: true,
};

function authHeaders(token: string | null, json = false) {
    const headers: Record<string, string> = {};
    if (token) {
        headers.Authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
    }
    if (json) headers["Content-Type"] = "application/json";
    return headers;
}

function SettingsRow({
                         icon,
                         title,
                         subtitle,
                         danger = false,
                         onPress,
                     }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle?: string;
    danger?: boolean;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity style={styles.row} activeOpacity={0.85} onPress={onPress}>
            <View style={[styles.rowIconWrap, danger && styles.rowIconWrapDanger]}>
                <Ionicons name={icon} size={18} color={danger ? "#FF7C7C" : "#fff"} />
            </View>

            <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, danger && styles.rowTitleDanger]}>{title}</Text>
                {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
            </View>

            <Ionicons name="chevron-forward" size={18} color="#666" />
        </TouchableOpacity>
    );
}

function SettingsToggleRow({
                               icon,
                               title,
                               subtitle,
                               value,
                               disabled = false,
                               onValueChange,
                           }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle?: string;
    value: boolean;
    disabled?: boolean;
    onValueChange: (value: boolean) => void;
}) {
    return (
        <View style={[styles.row, disabled && styles.rowDisabled]}>
            <View style={styles.rowIconWrap}>
                <Ionicons name={icon} size={18} color="#fff" />
            </View>

            <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{title}</Text>
                {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
            </View>

            <Switch
                value={value}
                disabled={disabled}
                onValueChange={onValueChange}
                trackColor={{
                    false: "rgba(255,255,255,0.14)",
                    true: "rgba(151, 89, 255, 0.45)",
                }}
                thumbColor={value ? colors.primary : "#727782"}
                ios_backgroundColor="rgba(255,255,255,0.14)"
            />
        </View>
    );
}

function SettingsSection({
                             title,
                             hint,
                             children,
                         }: {
    title: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{title}</Text>
                {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
            </View>
            <View style={styles.sectionCard}>{children}</View>
        </View>
    );
}

function resetToLogin(navigation: any) {
    let rootNavigation = navigation;
    while (rootNavigation?.getParent?.()) {
        rootNavigation = rootNavigation.getParent();
    }
    rootNavigation.reset({ index: 0, routes: [{ name: "Login" }] });
}

export default function SettingsScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const [engagementRemindersEnabled, setEngagementRemindersEnabledState] = useState(true);
    const [savingReminders, setSavingReminders] = useState(false);
    const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
    const [savingNotificationKey, setSavingNotificationKey] = useState<keyof NotificationSettings | null>(null);

    useEffect(() => {
        let alive = true;

        getEngagementRemindersEnabled()
            .then((enabled) => {
                if (alive) setEngagementRemindersEnabledState(enabled);
            })
            .catch(() => {});

        return () => {
            alive = false;
        };
    }, []);

    const fetchNotificationSettings = useCallback(async () => {
        const token = await getStoredToken();
        if (!token) return;

        const res = await fetch(`${API_URL}/api/user/notification-settings`, {
            headers: authHeaders(token),
        });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
            console.log("fetch notification settings error:", res.status, json);
            return;
        }

        setNotificationSettings({
            ...DEFAULT_NOTIFICATION_SETTINGS,
            ...(json?.settings || {}),
        });
    }, []);

    useEffect(() => {
        fetchNotificationSettings().catch(() => {});
    }, [fetchNotificationSettings]);

    const updateNotificationSetting = useCallback(
        async (key: keyof NotificationSettings, value: boolean) => {
            if (savingNotificationKey) return;

            const previous = notificationSettings;
            const next = { ...notificationSettings, [key]: value };
            setNotificationSettings(next);
            setSavingNotificationKey(key);

            try {
                const token = await getStoredToken();
                if (!token) throw new Error("missing token");

                const res = await fetch(`${API_URL}/api/user/notification-settings`, {
                    method: "PATCH",
                    headers: authHeaders(token, true),
                    body: JSON.stringify({ [key]: value }),
                });
                const json = await res.json().catch(() => null);

                if (!res.ok) {
                    throw new Error(json?.error || "notification settings failed");
                }

                setNotificationSettings({
                    ...DEFAULT_NOTIFICATION_SETTINGS,
                    ...(json?.settings || next),
                });
            } catch (e) {
                setNotificationSettings(previous);
                Alert.alert("Réglage impossible", "Réessaie dans quelques secondes.");
            } finally {
                setSavingNotificationKey(null);
            }
        },
        [notificationSettings, savingNotificationKey]
    );

    const handleToggleEngagementReminders = useCallback(async (nextValue: boolean) => {
        if (savingReminders) return;

        const previous = engagementRemindersEnabled;
        setEngagementRemindersEnabledState(nextValue);
        setSavingReminders(true);

        try {
            const result = await setEngagementRemindersEnabled(nextValue);
            if (nextValue && result.permission === "denied") {
                setEngagementRemindersEnabledState(false);
                Alert.alert(
                    "Notifications désactivées",
                    "Active les notifications dans les réglages iOS pour recevoir les rappels TrueBPM."
                );
            }
        } catch (e) {
            setEngagementRemindersEnabledState(previous);
            Alert.alert("Impossible de modifier les rappels", "Réessaie dans quelques secondes.");
        } finally {
            setSavingReminders(false);
        }
    }, [engagementRemindersEnabled, savingReminders]);

    const handleLogout = useCallback(async () => {
        Alert.alert("Déconnexion", "Tu veux vraiment te déconnecter ?", [
            { text: "Annuler", style: "cancel" },
            {
                text: "Se déconnecter",
                style: "destructive",
                onPress: async () => {
                    const stored = await getStoredToken();
                    const bearer =
                        stored && stored.startsWith("Bearer ")
                            ? stored
                            : stored
                                ? `Bearer ${stored}`
                                : null;

                    if (bearer) {
                        await fetch(`${API_URL}/api/auth/logout`, {
                            method: "POST",
                            headers: { Authorization: bearer },
                        }).catch(() => {});
                    }

                    await clearStoredSession();
                    resetToLogin(navigation);
                },
            },
        ]);
    }, [navigation]);

    return (
        <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.85}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>

                <Text style={styles.title}>Paramètres</Text>

                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 12) + 32 }}
            >
                <View style={styles.introBlock}>
                    <Text style={styles.introEyebrow}>TrueBPM</Text>
                    <Text style={styles.introTitle}>Gère ton compte sans bruit.</Text>
                    <Text style={styles.introText}>
                        Profil, sécurité, confidentialité et aide, tout reste au même endroit.
                    </Text>
                </View>

                <SettingsSection title="Profil" hint="Ton identité musicale">
                    <SettingsRow
                        icon="create-outline"
                        title="Modifier mon profil"
                        onPress={() => navigation.navigate("EditProfile")}
                    />

                    <View style={styles.divider} />

                    <SettingsRow
                        icon="radio-outline"
                        title="Sorties à écouter"
                        subtitle="Voir les sons et albums détectés depuis tes artistes favoris."
                        onPress={() => navigation.navigate("ArtistReleases")}
                    />
                </SettingsSection>

                <SettingsSection title="Compte" hint="Connexion">
                    <SettingsRow
                        icon="mail-outline"
                        title="Adresse e-mail"
                        onPress={() => navigation.navigate("ChangeEmail")}
                    />

                    <View style={styles.divider} />

                    <SettingsRow
                        icon="lock-closed-outline"
                        title="Mot de passe"
                        onPress={() => navigation.navigate("ChangePassword")}
                    />
                </SettingsSection>

                <SettingsSection title="Confidentialité" hint="Ce que les autres voient">
                    <SettingsRow
                        icon="shield-checkmark-outline"
                        title="Confidentialité"
                        onPress={() => navigation.navigate("PrivacySettings")}
                    />

                    <View style={styles.divider} />

                    <SettingsRow
                        icon="person-add-outline"
                        title="Demandes d’abonnement"
                        onPress={() => navigation.navigate("FollowRequests")}
                    />
                </SettingsSection>

                <SettingsSection title="Notifications" hint="Social">
                    <SettingsToggleRow
                        icon="notifications-outline"
                        title="Notifications sociales"
                        subtitle="Coupe tout ce qui vient des autres comptes d’un seul geste."
                        value={notificationSettings.enabled}
                        disabled={savingNotificationKey === "enabled"}
                        onValueChange={(value) => updateNotificationSetting("enabled", value)}
                    />

                    <View style={styles.divider} />

                    <SettingsToggleRow
                        icon="albums-outline"
                        title="Posts des profils suivis"
                        subtitle="Quand quelqu’un que tu suis publie un nouvel avis."
                        value={notificationSettings.postsFromFollowing}
                        disabled={!notificationSettings.enabled || savingNotificationKey === "postsFromFollowing"}
                        onValueChange={(value) => updateNotificationSetting("postsFromFollowing", value)}
                    />

                    <View style={styles.divider} />

                    <SettingsToggleRow
                        icon="disc-outline"
                        title="Même musique notée"
                        subtitle="Quand un autre compte donne son avis sur un son que tu as noté."
                        value={notificationSettings.sameMusic}
                        disabled={!notificationSettings.enabled || savingNotificationKey === "sameMusic"}
                        onValueChange={(value) => updateNotificationSetting("sameMusic", value)}
                    />

                    <View style={styles.divider} />

                    <SettingsToggleRow
                        icon="radio-outline"
                        title="Sorties d’artistes favoris"
                        subtitle="Quand un artiste favori sort un son ou un album."
                        value={notificationSettings.artistReleases}
                        disabled={!notificationSettings.enabled || savingNotificationKey === "artistReleases"}
                        onValueChange={(value) => updateNotificationSetting("artistReleases", value)}
                    />

                    <View style={styles.divider} />

                    <SettingsToggleRow
                        icon="heart-outline"
                        title="Likes"
                        subtitle="Likes sur tes posts, commentaires ou notes."
                        value={notificationSettings.likes}
                        disabled={!notificationSettings.enabled || savingNotificationKey === "likes"}
                        onValueChange={(value) => updateNotificationSetting("likes", value)}
                    />

                    <View style={styles.divider} />

                    <SettingsToggleRow
                        icon="chatbubble-ellipses-outline"
                        title="Commentaires"
                        subtitle="Réponses et discussions sous tes posts."
                        value={notificationSettings.comments}
                        disabled={!notificationSettings.enabled || savingNotificationKey === "comments"}
                        onValueChange={(value) => updateNotificationSetting("comments", value)}
                    />

                    <View style={styles.divider} />

                    <SettingsToggleRow
                        icon="repeat-outline"
                        title="Reposts"
                        subtitle="Quand ton avis circule chez les autres."
                        value={notificationSettings.reposts}
                        disabled={!notificationSettings.enabled || savingNotificationKey === "reposts"}
                        onValueChange={(value) => updateNotificationSetting("reposts", value)}
                    />

                    <View style={styles.divider} />

                    <SettingsToggleRow
                        icon="person-add-outline"
                        title="Abonnements"
                        subtitle="Nouveaux abonnés, demandes et acceptations."
                        value={notificationSettings.follows}
                        disabled={!notificationSettings.enabled || savingNotificationKey === "follows"}
                        onValueChange={(value) => updateNotificationSetting("follows", value)}
                    />

                    <View style={styles.divider} />

                    <SettingsToggleRow
                        icon="star-outline"
                        title="Notes du moment"
                        subtitle="Quand les profils suivis changent leur note musicale."
                        value={notificationSettings.notesFromFollowing}
                        disabled={!notificationSettings.enabled || savingNotificationKey === "notesFromFollowing"}
                        onValueChange={(value) => updateNotificationSetting("notesFromFollowing", value)}
                    />
                </SettingsSection>

                <SettingsSection title="Rappels" hint="TrueBPM">
                    <SettingsToggleRow
                        icon="notifications-outline"
                        title="Rappels TrueBPM"
                        subtitle="Quelques rappels par semaine, dont les sorties musicales du vendredi matin."
                        value={engagementRemindersEnabled}
                        disabled={savingReminders}
                        onValueChange={handleToggleEngagementReminders}
                    />
                </SettingsSection>

                <SettingsSection title="Sécurité" hint="Actions sensibles">
                    <SettingsRow
                        icon="trash-outline"
                        title="Supprimer mon compte"
                        danger
                        onPress={() => navigation.navigate("DeleteAccount")}
                    />
                </SettingsSection>

                <SettingsSection title="Aide" hint="Support et retours">
                    <SettingsRow
                        icon="help-circle-outline"
                        title="Support"
                        onPress={() => navigation.navigate("Support")}
                    />

                    <View style={styles.divider} />

                    <SettingsRow
                        icon="bulb-outline"
                        title="Feedback"
                        onPress={() => navigation.navigate("Feedback")}
                    />

                    <View style={styles.divider} />

                    <SettingsRow
                        icon="flag-outline"
                        title="Règles de communauté"
                        onPress={() => navigation.navigate("Legal", { document: "community" })}
                    />
                </SettingsSection>

                <SettingsSection title="Légal" hint="Documents officiels">
                    <SettingsRow
                        icon="document-text-outline"
                        title="Conditions d'utilisation"
                        onPress={() => navigation.navigate("Legal", { document: "terms" })}
                    />

                    <View style={styles.divider} />

                    <SettingsRow
                        icon="lock-closed-outline"
                        title="Politique de confidentialité"
                        onPress={() => navigation.navigate("Legal", { document: "privacy" })}
                    />

                    <View style={styles.divider} />

                    <SettingsRow
                        icon="receipt-outline"
                        title="CGV et mentions"
                        onPress={() => navigation.navigate("Legal", { document: "sales" })}
                    />
                </SettingsSection>

                <SettingsSection title="Session" hint="Quitter l’app">
                    <SettingsRow
                        icon="log-out-outline"
                        title="Se déconnecter"
                        danger
                        onPress={handleLogout}
                    />
                </SettingsSection>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
        paddingHorizontal: 16,
    },
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.lg,
    },
    title: {
        color: colors.text,
        fontSize: 20,
        fontWeight: fontWeights.black,
    },
    introBlock: {
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.xs,
        marginBottom: spacing.md,
    },
    introEyebrow: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        letterSpacing: 4,
        textTransform: "uppercase",
        marginBottom: spacing.sm,
    },
    introTitle: {
        color: colors.text,
        fontSize: 26,
        lineHeight: 31,
        fontWeight: fontWeights.black,
    },
    introText: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        lineHeight: 20,
        fontWeight: fontWeights.bold,
        marginTop: spacing.sm,
    },

    section: {
        marginBottom: spacing.xl,
    },
    sectionHeader: {
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: spacing.md,
        marginBottom: spacing.sm,
        paddingHorizontal: spacing.xs,
    },
    sectionTitle: {
        color: colors.text,
        fontSize: typography.caption,
        fontWeight: fontWeights.black,
        textTransform: "uppercase",
        letterSpacing: 2,
    },
    sectionHint: {
        flex: 1,
        color: colors.textFaint,
        fontSize: typography.tiny,
        fontWeight: fontWeights.bold,
        textAlign: "right",
    },
    sectionCard: {
        width: "100%",
        backgroundColor: colors.surfaceFeed,
        borderRadius: 24,
        overflow: "hidden",
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: spacing.md,
        paddingVertical: 15,
    },
    rowDisabled: {
        opacity: 0.65,
    },
    rowIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.control,
        alignItems: "center",
        justifyContent: "center",
    },
    rowIconWrapDanger: {
        backgroundColor: colors.dangerSoft,
    },
    rowTitle: {
        color: colors.text,
        fontSize: 15,
        fontWeight: fontWeights.black,
    },
    rowTitleDanger: {
        color: "#FF8A8A",
    },
    rowSubtitle: {
        color: colors.textFaint,
        fontSize: 12,
        marginTop: 4,
        lineHeight: 17,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.separator,
        marginLeft: 62,
    },
});
