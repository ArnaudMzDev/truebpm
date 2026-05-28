import React, { useMemo, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL } from "../lib/config";
import { clearStoredSession, getStoredToken } from "../lib/authStorage";
import { colors, fontWeights, radius, spacing, typography } from "../theme";

async function safeJson(res: Response): Promise<any | null> {
    const text = await res.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        if (__DEV__) console.log("Non-JSON response:", text.slice(0, 200));
        return null;
    }
}

function resetToLogin(navigation: any) {
    let rootNavigation = navigation;
    while (rootNavigation?.getParent?.()) {
        rootNavigation = rootNavigation.getParent();
    }
    rootNavigation.reset({ index: 0, routes: [{ name: "Login" }] });
}

export default function DeleteAccountScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [loading, setLoading] = useState(false);

    const canDelete = useMemo(
        () => password.trim().length > 0 && confirmation.trim() === "SUPPRIMER" && !loading,
        [password, confirmation, loading]
    );

    const deleteAccount = async () => {
        if (!canDelete) return;

        Alert.alert(
            "Supprimer définitivement ?",
            "Cette action supprimera ton compte, tes posts, notes, messages, notifications et jetons de notification. Elle est irréversible.",
            [
                { text: "Annuler", style: "cancel" },
                {
                    text: "Supprimer",
                    style: "destructive",
                    onPress: async () => {
                        const token = await getStoredToken();
                        if (!token) {
                            Alert.alert("Erreur", "Tu n'es pas connecté.");
                            return;
                        }

                        setLoading(true);
                        try {
                            const res = await fetch(`${API_URL}/api/user/me`, {
                                method: "DELETE",
                                headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({
                                    password,
                                    confirmation: confirmation.trim(),
                                }),
                            });
                            const json = await safeJson(res);

                            if (!res.ok) {
                                Alert.alert("Erreur", json?.error || "Impossible de supprimer le compte.");
                                return;
                            }

                            await clearStoredSession();
                            resetToLogin(navigation);
                        } catch (e) {
                            console.log("delete account error:", e);
                            Alert.alert("Erreur", "Impossible de supprimer le compte.");
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    return (
        <KeyboardAvoidingView
            style={[styles.screen, { paddingTop: insets.top + 10 }]}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <View style={styles.topBar}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.85}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>

                <Text style={styles.title}>Supprimer le compte</Text>

                <View style={styles.sideSpacer} />
            </View>

            <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 12) + 28 }}
            >
                <View style={styles.warningCard}>
                    <Ionicons name="warning-outline" size={24} color={colors.danger} />
                    <Text style={styles.warningTitle}>Action irréversible</Text>
                    <Text style={styles.warningText}>
                        La suppression retire ton compte et les données associées à ton activité. Tes contenus ne seront plus accessibles dans TrueBPM.
                    </Text>
                </View>

                <Text style={styles.label}>Mot de passe</Text>
                <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Ton mot de passe"
                    placeholderTextColor={colors.textFaint}
                    secureTextEntry
                    autoCapitalize="none"
                />

                <Text style={styles.label}>Tape SUPPRIMER</Text>
                <TextInput
                    style={styles.input}
                    value={confirmation}
                    onChangeText={setConfirmation}
                    placeholder="SUPPRIMER"
                    placeholderTextColor={colors.textFaint}
                    autoCapitalize="characters"
                />

                <TouchableOpacity
                    style={[styles.deleteButton, !canDelete && styles.deleteButtonDisabled]}
                    disabled={!canDelete}
                    onPress={deleteAccount}
                    activeOpacity={0.85}
                >
                    <Text style={styles.deleteButtonText}>
                        {loading ? "Suppression..." : "Supprimer définitivement"}
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.bg,
        paddingHorizontal: spacing.lg,
    },
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.lg,
    },
    backButton: {
        width: 42,
        height: 42,
        borderRadius: radius.lg,
        backgroundColor: colors.surface3,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },
    sideSpacer: {
        width: 42,
    },
    title: {
        flex: 1,
        textAlign: "center",
        color: colors.text,
        fontSize: 18,
        fontWeight: fontWeights.black,
    },
    warningCard: {
        backgroundColor: "#1D1012",
        borderWidth: 1,
        borderColor: "#4A1A20",
        borderRadius: radius.xl,
        padding: spacing.lg,
        marginBottom: spacing.xl,
    },
    warningTitle: {
        color: colors.text,
        fontSize: 20,
        fontWeight: fontWeights.black,
        marginTop: spacing.sm,
        marginBottom: spacing.sm,
    },
    warningText: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        lineHeight: 20,
        fontWeight: fontWeights.medium,
    },
    label: {
        color: colors.text,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.extraBold,
        marginBottom: spacing.sm,
        marginTop: spacing.md,
    },
    input: {
        height: 52,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface2,
        color: colors.text,
        paddingHorizontal: spacing.md,
        fontSize: typography.body,
    },
    deleteButton: {
        marginTop: spacing.xl,
        borderRadius: radius.lg,
        paddingVertical: 15,
        backgroundColor: colors.danger,
        alignItems: "center",
    },
    deleteButtonDisabled: {
        opacity: 0.45,
    },
    deleteButtonText: {
        color: "#fff",
        fontSize: typography.body,
        fontWeight: fontWeights.black,
    },
});
