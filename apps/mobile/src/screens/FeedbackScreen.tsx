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

type Area = "home" | "posting" | "search" | "profile" | "messages" | "overall";
type Sentiment = "love" | "good" | "mixed" | "frustrated";

const areas: Array<{ value: Area; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { value: "overall", label: "Global", icon: "sparkles-outline" },
    { value: "home", label: "Accueil", icon: "home-outline" },
    { value: "posting", label: "Création", icon: "add-circle-outline" },
    { value: "search", label: "Recherche", icon: "search-outline" },
    { value: "profile", label: "Profil", icon: "person-outline" },
    { value: "messages", label: "Messages", icon: "chatbubble-ellipses-outline" },
];

const sentiments: Array<{ value: Sentiment; label: string }> = [
    { value: "love", label: "J'adore" },
    { value: "good", label: "Bien" },
    { value: "mixed", label: "Mitigé" },
    { value: "frustrated", label: "Frustrant" },
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

export default function FeedbackScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const [area, setArea] = useState<Area>("overall");
    const [sentiment, setSentiment] = useState<Sentiment>("good");
    const [rating, setRating] = useState(4);
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [improvement, setImprovement] = useState("");
    const [contactAllowed, setContactAllowed] = useState(true);
    const [loading, setLoading] = useState(false);

    const canSubmit = useMemo(
        () => subject.trim().length >= 4 && message.trim().length >= 10 && !loading,
        [subject, message, loading]
    );

    const submit = async () => {
        if (!canSubmit) return;

        const token = await getStoredToken();
        if (!token) {
            Alert.alert("Erreur", "Tu dois être connecté pour envoyer un feedback.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/feedback`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    area,
                    sentiment,
                    rating,
                    subject: subject.trim(),
                    message: message.trim(),
                    improvement: improvement.trim(),
                    contactAllowed,
                }),
            });
            const json = await readJson(res);

            if (!res.ok) {
                Alert.alert("Erreur", json?.error || "Impossible d'envoyer le feedback.");
                return;
            }

            Alert.alert(
                "Feedback envoyé",
                "Merci.",
                [{ text: "OK", onPress: () => navigation.goBack() }]
            );
            setSubject("");
            setMessage("");
            setImprovement("");
        } catch (e) {
            console.log("feedback submit error:", e);
            Alert.alert("Erreur", "Impossible d'envoyer le feedback.");
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

                <Text style={styles.title}>Feedback</Text>

                <View style={styles.sideSpacer} />
            </View>

            <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 12) + 28 }}
            >
                <Text style={styles.label}>Note</Text>
                <View style={styles.ratingRow}>
                    {[1, 2, 3, 4, 5].map((value) => (
                        <TouchableOpacity key={value} onPress={() => setRating(value)} activeOpacity={0.8}>
                            <Ionicons
                                name={value <= rating ? "star" : "star-outline"}
                                size={34}
                                color={value <= rating ? colors.primary : colors.textFaint}
                            />
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.label}>Zone</Text>
                <View style={styles.chipGrid}>
                    {areas.map((item) => {
                        const selected = area === item.value;
                        return (
                            <TouchableOpacity
                                key={item.value}
                                style={[styles.chip, selected && styles.chipActive]}
                                onPress={() => setArea(item.value)}
                                activeOpacity={0.85}
                            >
                                <Ionicons name={item.icon} size={17} color={selected ? colors.text : colors.textMuted} />
                                <Text style={[styles.chipText, selected && styles.chipTextActive]}>{item.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <Text style={styles.label}>Ressenti</Text>
                <View style={styles.chipGrid}>
                    {sentiments.map((item) => {
                        const selected = sentiment === item.value;
                        return (
                            <TouchableOpacity
                                key={item.value}
                                style={[styles.chip, selected && styles.chipActive]}
                                onPress={() => setSentiment(item.value)}
                                activeOpacity={0.85}
                            >
                                <Text style={[styles.chipText, selected && styles.chipTextActive]}>{item.label}</Text>
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

                <Text style={styles.label}>Ton avis</Text>
                <TextInput
                    style={[styles.input, styles.textarea]}
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Ton avis."
                    placeholderTextColor={colors.textFaint}
                    multiline
                    textAlignVertical="top"
                    maxLength={4000}
                />

                <Text style={styles.label}>Idée</Text>
                <TextInput
                    style={[styles.input, styles.textareaSmall]}
                    value={improvement}
                    onChangeText={setImprovement}
                    placeholder="Optionnel"
                    placeholderTextColor={colors.textFaint}
                    multiline
                    textAlignVertical="top"
                    maxLength={4000}
                />

                <TouchableOpacity
                    style={styles.toggleRow}
                    onPress={() => setContactAllowed((value) => !value)}
                    activeOpacity={0.85}
                >
                    <View style={[styles.checkbox, contactAllowed && styles.checkboxActive]}>
                        {contactAllowed ? <Ionicons name="checkmark" size={16} color={colors.bg} /> : null}
                    </View>
                    <Text style={styles.toggleText}>Me recontacter si besoin.</Text>
                </TouchableOpacity>

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
    ratingRow: {
        flexDirection: "row",
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    chipGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
    },
    chip: {
        minHeight: 42,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: spacing.md,
        borderRadius: radius.xl,
        backgroundColor: "rgba(15, 18, 24, 0.72)",
    },
    chipActive: {
        backgroundColor: colors.surface3,
    },
    chipText: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.extraBold,
    },
    chipTextActive: {
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
    textareaSmall: {
        minHeight: 110,
        paddingTop: spacing.md,
        paddingBottom: spacing.md,
        lineHeight: 22,
    },
    toggleRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
        marginTop: spacing.lg,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface2,
        alignItems: "center",
        justifyContent: "center",
    },
    checkboxActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    toggleText: {
        flex: 1,
        color: colors.textMuted,
        fontSize: typography.bodySm,
        lineHeight: 20,
        fontWeight: fontWeights.medium,
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
