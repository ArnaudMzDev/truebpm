import React, { useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL } from "../lib/config";
import { colors, spacing, radius, typography, fontWeights } from "../theme";
import { getStoredToken, clearStoredSession } from "../lib/authStorage";

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

function SettingsSection({
                             title,
                             children,
                         }: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
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

            <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 12) + 32 }}>
                <SettingsSection title="Profil">
                    <SettingsRow
                        icon="create-outline"
                        title="Modifier mon profil"
                        onPress={() => navigation.navigate("EditProfile")}
                    />
                </SettingsSection>

                <SettingsSection title="Compte">
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

                <SettingsSection title="Confidentialité">
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

                <SettingsSection title="Sécurité">
                    <SettingsRow
                        icon="trash-outline"
                        title="Supprimer mon compte"
                        danger
                        onPress={() => navigation.navigate("DeleteAccount")}
                    />
                </SettingsSection>

                <SettingsSection title="Aide">
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

                <SettingsSection title="Légal">
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

                <SettingsSection title="Session">
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
        backgroundColor: "#000",
        paddingHorizontal: 16,
    },
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
    },
    title: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "800",
    },

    section: {
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        color: colors.textMuted,
        fontSize: typography.caption,
        fontWeight: fontWeights.black,
        marginBottom: spacing.sm,
        marginLeft: 2,
        textTransform: "uppercase",
    },
    sectionCard: {
        width: "100%",
        backgroundColor: colors.surface2,
        borderWidth: 1,
        borderColor: colors.borderSoft,
        borderRadius: radius.xl,
        overflow: "hidden",
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    rowIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: "#171717",
        alignItems: "center",
        justifyContent: "center",
    },
    rowIconWrapDanger: {
        backgroundColor: "#221212",
    },
    rowTitle: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "800",
    },
    rowTitleDanger: {
        color: "#FF8A8A",
    },
    rowSubtitle: {
        color: "#888",
        fontSize: 12,
        marginTop: 4,
        lineHeight: 17,
    },
    divider: {
        height: 1,
        backgroundColor: "#1E1E1E",
        marginLeft: 62,
    },
});
