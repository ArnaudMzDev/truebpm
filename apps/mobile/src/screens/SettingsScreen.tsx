import React, { useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "../lib/config";

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

export default function SettingsScreen({ navigation }: any) {
    const handleLogout = useCallback(async () => {
        Alert.alert("Déconnexion", "Tu veux vraiment te déconnecter ?", [
            { text: "Annuler", style: "cancel" },
            {
                text: "Se déconnecter",
                style: "destructive",
                onPress: async () => {
                    const stored = await AsyncStorage.getItem("token");
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

                    await AsyncStorage.multiRemove(["token", "user"]);
                    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
                },
            },
        ]);
    }, [navigation]);

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.85}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>

                <Text style={styles.title}>Paramètres</Text>

                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                <SettingsSection title="Profil">
                    <SettingsRow
                        icon="create-outline"
                        title="Modifier mon profil"
                        subtitle="Bio, avatar, bannière, musique de profil"
                        onPress={() => navigation.navigate("EditProfile")}
                    />
                </SettingsSection>

                <SettingsSection title="Compte">
                    <SettingsRow
                        icon="mail-outline"
                        title="Adresse e-mail"
                        subtitle="Modifier ton adresse e-mail"
                        onPress={() => navigation.navigate("ChangeEmail")}
                    />

                    <View style={styles.divider} />

                    <SettingsRow
                        icon="lock-closed-outline"
                        title="Mot de passe"
                        subtitle="Modifier ton mot de passe"
                        onPress={() => navigation.navigate("ChangePassword")}
                    />
                </SettingsSection>

                <SettingsSection title="Confidentialité">
                    <SettingsRow
                        icon="shield-checkmark-outline"
                        title="Confidentialité"
                        subtitle="Compte privé, messages, visibilité"
                        onPress={() => navigation.navigate("PrivacySettings")}
                    />

                    <View style={styles.divider} />

                    <SettingsRow
                        icon="person-add-outline"
                        title="Demandes d’abonnement"
                        subtitle="Accepter ou refuser les demandes"
                        onPress={() => navigation.navigate("FollowRequests")}
                    />
                </SettingsSection>

                <SettingsSection title="Session">
                    <SettingsRow
                        icon="log-out-outline"
                        title="Se déconnecter"
                        subtitle="Fermer la session sur cet appareil"
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
        paddingTop: 54,
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
        marginBottom: 22,
    },
    sectionTitle: {
        color: "#9A9A9A",
        fontSize: 13,
        fontWeight: "800",
        marginBottom: 10,
        marginLeft: 2,
        textTransform: "uppercase",
    },
    sectionCard: {
        backgroundColor: "#0F0F0F",
        borderWidth: 1,
        borderColor: "#1F1F1F",
        borderRadius: 18,
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