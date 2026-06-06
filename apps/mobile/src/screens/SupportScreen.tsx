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
import { getStoredToken } from "../lib/authStorage";
import { colors, fontWeights, radius, spacing, typography } from "../theme";

type Category = "bug" | "abuse" | "account" | "legal" | "other";

const categories: Array<{ value: Category; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { value: "bug", label: "Bug", icon: "bug-outline" },
    { value: "abuse", label: "Abus", icon: "flag-outline" },
    { value: "account", label: "Compte", icon: "person-circle-outline" },
    { value: "legal", label: "Légal", icon: "document-text-outline" },
    { value: "other", label: "Autre", icon: "help-circle-outline" },
];

async function readJson(res: Response): Promise<any | null> {
    const text = await res.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        if (__DEV__) console.log("Non-JSON response:", text.slice(0, 200));
        return null;
    }
}

export default function SupportScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const [category, setCategory] = useState<Category>("bug");
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const canSubmit = useMemo(
        () => subject.trim().length >= 4 && message.trim().length >= 10 && !loading,
        [subject, message, loading]
    );

    const submit = async () => {
        if (!canSubmit) return;

        const token = await getStoredToken();
        if (!token) {
            Alert.alert("Erreur", "Tu dois être connecté pour contacter le support.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/support`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    category,
                    subject: subject.trim(),
                    message: message.trim(),
                }),
            });
            const json = await readJson(res);

            if (!res.ok) {
                Alert.alert("Erreur", json?.error || "Impossible d'envoyer la demande.");
                return;
            }

            Alert.alert(
                "Demande envoyée",
                "Merci.",
                [{ text: "OK", onPress: () => navigation.goBack() }]
            );
            setSubject("");
            setMessage("");
        } catch (e) {
            console.log("support submit error:", e);
            Alert.alert("Erreur", "Impossible d'envoyer la demande.");
        } finally {
            setLoading(false);
        }
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

                <Text style={styles.title}>Support</Text>

                <View style={styles.sideSpacer} />
            </View>

            <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 12) + 28 }}
            >
                <Text style={styles.label}>Catégorie</Text>
                <View style={styles.categoryGrid}>
                    {categories.map((item) => {
                        const selected = category === item.value;
                        return (
                            <TouchableOpacity
                                key={item.value}
                                style={[styles.categoryChip, selected && styles.categoryChipActive]}
                                onPress={() => setCategory(item.value)}
                                activeOpacity={0.85}
                            >
                                <Ionicons name={item.icon} size={17} color={selected ? colors.text : colors.textMuted} />
                                <Text style={[styles.categoryText, selected && styles.categoryTextActive]}>{item.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <Text style={styles.label}>Sujet</Text>
                <TextInput
                    style={styles.input}
                    value={subject}
                    onChangeText={setSubject}
                    placeholder="Sujet"
                    placeholderTextColor={colors.textFaint}
                    maxLength={140}
                />

                <Text style={styles.label}>Message</Text>
                <TextInput
                    style={[styles.input, styles.textarea]}
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Décris le problème."
                    placeholderTextColor={colors.textFaint}
                    multiline
                    textAlignVertical="top"
                    maxLength={4000}
                />

                <TouchableOpacity
                    style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
                    onPress={submit}
                    disabled={!canSubmit}
                    activeOpacity={0.85}
                >
                    <Text style={styles.submitButtonText}>
                        {loading ? "Envoi..." : "Envoyer"}
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
    hero: {
        padding: spacing.lg,
        borderRadius: radius.xxl,
        backgroundColor: "rgba(15, 18, 24, 0.72)",
        marginBottom: spacing.xl,
    },
    heroTitle: {
        color: colors.text,
        fontSize: 22,
        fontWeight: fontWeights.black,
        marginTop: spacing.md,
        marginBottom: spacing.sm,
    },
    heroText: {
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
    categoryGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
    },
    categoryChip: {
        minHeight: 42,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: spacing.md,
        borderRadius: radius.xl,
        backgroundColor: "rgba(15, 18, 24, 0.72)",
    },
    categoryChipActive: {
        backgroundColor: colors.surface3,
    },
    categoryText: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.extraBold,
    },
    categoryTextActive: {
        color: colors.text,
    },
    input: {
        minHeight: 52,
        borderRadius: radius.xl,
        backgroundColor: "rgba(15, 18, 24, 0.72)",
        color: colors.text,
        paddingHorizontal: spacing.md,
        fontSize: typography.body,
    },
    textarea: {
        minHeight: 150,
        paddingTop: spacing.md,
        paddingBottom: spacing.md,
        lineHeight: 22,
    },
    submitButton: {
        marginTop: spacing.xl,
        borderRadius: radius.lg,
        paddingVertical: 15,
        alignItems: "center",
        backgroundColor: colors.primaryDark,
    },
    submitButtonDisabled: {
        opacity: 0.45,
    },
    submitButtonText: {
        color: colors.text,
        fontSize: typography.body,
        fontWeight: fontWeights.black,
    },
});
