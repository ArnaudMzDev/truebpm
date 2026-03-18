import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Switch,
    ActivityIndicator,
    Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "../lib/config";

type MessagePrivacy = "everyone" | "following";

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

function OptionRow({
                       title,
                       subtitle,
                       active,
                       onPress,
                   }: {
    title: string;
    subtitle: string;
    active: boolean;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            style={[styles.optionRow, active && styles.optionRowActive]}
            activeOpacity={0.85}
            onPress={onPress}
        >
            <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>{title}</Text>
                <Text style={styles.optionSubtitle}>{subtitle}</Text>
            </View>

            {active ? <Ionicons name="checkmark-circle" size={22} color="#9B5CFF" /> : null}
        </TouchableOpacity>
    );
}

export default function PrivacySettingsScreen({ navigation }: any) {
    const [isPrivate, setIsPrivate] = useState(false);
    const [messagePrivacy, setMessagePrivacy] = useState<MessagePrivacy>("everyone");

    const [initialPrivate, setInitialPrivate] = useState(false);
    const [initialMessagePrivacy, setInitialMessagePrivacy] = useState<MessagePrivacy>("everyone");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const hasChanges = useMemo(() => {
        return (
            isPrivate !== initialPrivate ||
            messagePrivacy !== initialMessagePrivacy
        );
    }, [isPrivate, initialPrivate, messagePrivacy, initialMessagePrivacy]);

    const loadPrivacy = useCallback(async () => {
        const token = await AsyncStorage.getItem("token");
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/user/privacy`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const json = await safeJson(res);
            if (!res.ok) {
                Alert.alert("Erreur", json?.error || "Impossible de charger la confidentialité.");
                setLoading(false);
                return;
            }

            const nextPrivate = !!json?.privacy?.isPrivate;
            const nextMessagePrivacy =
                json?.privacy?.messagePrivacy === "following" ? "following" : "everyone";

            setIsPrivate(nextPrivate);
            setMessagePrivacy(nextMessagePrivacy);

            setInitialPrivate(nextPrivate);
            setInitialMessagePrivacy(nextMessagePrivacy);
        } catch (e) {
            console.log("load privacy error:", e);
            Alert.alert("Erreur", "Impossible de charger la confidentialité.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPrivacy();
    }, [loadPrivacy]);

    const handleSave = async () => {
        if (!hasChanges || saving) return;

        const token = await AsyncStorage.getItem("token");
        if (!token) {
            Alert.alert("Erreur", "Tu n'es pas connecté.");
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/user/privacy`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    isPrivate,
                    messagePrivacy,
                }),
            });

            const json = await safeJson(res);

            if (!res.ok) {
                Alert.alert("Erreur", json?.error || "Impossible d’enregistrer.");
                return;
            }

            const nextPrivate = !!json?.privacy?.isPrivate;
            const nextMessagePrivacy =
                json?.privacy?.messagePrivacy === "following" ? "following" : "everyone";

            setInitialPrivate(nextPrivate);
            setInitialMessagePrivacy(nextMessagePrivacy);

            const rawUser = await AsyncStorage.getItem("user");
            if (rawUser) {
                try {
                    const parsed = JSON.parse(rawUser);
                    parsed.isPrivate = nextPrivate;
                    parsed.messagePrivacy = nextMessagePrivacy;
                    await AsyncStorage.setItem("user", JSON.stringify(parsed));
                } catch {}
            }

            Alert.alert("Succès", "Tes paramètres de confidentialité ont été mis à jour.");
            navigation.goBack();
        } catch (e) {
            console.log("save privacy error:", e);
            Alert.alert("Erreur", "Impossible d’enregistrer.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loader}>
                <ActivityIndicator size="large" color="#9B5CFF" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.85}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>

                <Text style={styles.title}>Confidentialité</Text>

                <View style={{ width: 24 }} />
            </View>

            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.iconWrap}>
                        <Ionicons name="lock-closed-outline" size={18} color="#fff" />
                    </View>

                    <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>Compte privé</Text>
                        <Text style={styles.cardSubtitle}>
                            Affiche que ton compte est privé. La restriction complète des profils/posts viendra ensuite.
                        </Text>
                    </View>

                    <Switch
                        value={isPrivate}
                        onValueChange={setIsPrivate}
                        trackColor={{ false: "#2A2A2A", true: "#6A31F5" }}
                        thumbColor="#fff"
                    />
                </View>
            </View>

            <View style={styles.card}>
                <View style={styles.sectionTitleRow}>
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#9B5CFF" />
                    <Text style={styles.sectionTitle}>Qui peut t’envoyer un message</Text>
                </View>

                <OptionRow
                    title="Tout le monde"
                    subtitle="N’importe quel utilisateur peut démarrer une conversation."
                    active={messagePrivacy === "everyone"}
                    onPress={() => setMessagePrivacy("everyone")}
                />

                <OptionRow
                    title="Seulement les abonnements"
                    subtitle="Seuls les comptes que tu suis peuvent t’écrire."
                    active={messagePrivacy === "following"}
                    onPress={() => setMessagePrivacy("following")}
                />
            </View>

            <TouchableOpacity
                style={[styles.saveBtn, (!hasChanges || saving) && { opacity: 0.6 }]}
                activeOpacity={0.85}
                disabled={!hasChanges || saving}
                onPress={handleSave}
            >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Enregistrer</Text>}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    loader: {
        flex: 1,
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
    },
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
        marginBottom: 18,
    },
    title: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "800",
    },
    card: {
        backgroundColor: "#0F0F0F",
        borderWidth: 1,
        borderColor: "#1F1F1F",
        borderRadius: 18,
        padding: 14,
        marginBottom: 14,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: "#171717",
        alignItems: "center",
        justifyContent: "center",
    },
    cardTitle: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "800",
    },
    cardSubtitle: {
        color: "#8D8D8D",
        fontSize: 12,
        lineHeight: 18,
        marginTop: 4,
    },
    sectionTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
    },
    sectionTitle: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "800",
    },
    optionRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderWidth: 1,
        borderColor: "#232323",
        backgroundColor: "#141414",
        borderRadius: 14,
        padding: 12,
        marginTop: 10,
    },
    optionRowActive: {
        borderColor: "#5E17EB",
        backgroundColor: "#171126",
    },
    optionTitle: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "800",
    },
    optionTitleActive: {
        color: "#fff",
    },
    optionSubtitle: {
        color: "#8D8D8D",
        fontSize: 12,
        lineHeight: 17,
        marginTop: 4,
    },
    saveBtn: {
        marginTop: 6,
        backgroundColor: "#5E17EB",
        borderRadius: 14,
        minHeight: 52,
        alignItems: "center",
        justifyContent: "center",
    },
    saveText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "800",
    },
});