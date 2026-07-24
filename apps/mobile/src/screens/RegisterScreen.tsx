import React, { useState, useEffect, useRef } from "react";
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    KeyboardAvoidingView, Platform, Animated, ScrollView
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Logo from "../components/Logo";
import LoaderLogo from "../components/LoaderLogo";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_URL } from "../lib/config";
import { colors, radius, spacing, typography, fontWeights } from "../theme";
import { setStoredToken } from "../lib/authStorage";

const LEGAL_VERSION = "2026-05-26";

/* ----------------------------- ERROR MESSAGE ----------------------------- */
function ErrorMessage({ message }: { message: string }) {
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (message) {
            opacity.setValue(0);
            Animated.timing(opacity, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
            }).start();
        }
    }, [message]);

    if (!message) return null;
    return (
        <Animated.View style={{ opacity, marginTop: 5 }}>
            <Text style={styles.errorText}>{message}</Text>
        </Animated.View>
    );
}

/* ----------------------------- VALIDATIONS ----------------------------- */
function validateEmail(email: string) {
    return /\S+@\S+\.\S+/.test(email);
}

function validatePassword(pw: string) {
    return (
        pw.length >= 8 &&
        /[A-Z]/.test(pw) &&
        /[0-9]/.test(pw) &&
        /[^a-zA-Z0-9]/.test(pw)
    );
}

/* ----------------------------- SCREEN ----------------------------- */
export default function RegisterScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const [focused, setFocused] = useState<string | null>(null);

    const [pseudo, setPseudo] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [legalAccepted, setLegalAccepted] = useState(false);

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const canSubmit = !!(
        pseudo.trim() &&
        email.trim() &&
        password.trim() &&
        confirm.trim() &&
        legalAccepted
    );

    const handleRegister = async () => {
        setError("");

        if (!pseudo.trim()) return setError("Choisis un pseudo.");
        if (!validateEmail(email)) return setError("Email invalide.");
        if (!validatePassword(password))
            return setError("Mot de passe trop faible.");
        if (password !== confirm)
            return setError("Les mots de passe ne correspondent pas.");
        if (!legalAccepted)
            return setError("Tu dois accepter les conditions pour créer ton compte.");

        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pseudo,
                    email,
                    password,
                    legalAccepted,
                    termsVersion: LEGAL_VERSION,
                    privacyVersion: LEGAL_VERSION,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setLoading(false);
                return setError(data.error || "Erreur inconnue.");
            }

            // 🔥 Stockage du token & user -> AUTO LOGIN
            await setStoredToken(data.token);
            await AsyncStorage.setItem("user", JSON.stringify(data.user));

            setLoading(false);

            // 🔥 Aller direct vers la création de profil
            navigation.replace("ProfileSetup");

        } catch (err) {
            setLoading(false);
            setError("Impossible de se connecter au serveur.");
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            {loading ? (
                <View
                    style={[
                        styles.loaderCenter,
                        {
                            paddingTop: insets.top + 24,
                            paddingBottom: Math.max(insets.bottom, 12) + 24,
                        },
                    ]}
                >
                    <LoaderLogo size={50} />
                </View>
            ) : (
                <ScrollView
                    style={styles.scroll}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={[
                        styles.scrollContent,
                        {
                            paddingTop: insets.top + 24,
                            paddingBottom: Math.max(insets.bottom, 12) + 24,
                        },
                    ]}
                >
                    <View style={styles.authPanel}>
                        <View style={styles.header}>
                            <Logo size={48} />
                            <Text style={styles.subtitle}>Crée ton compte</Text>
                        </View>

                        <Text style={styles.label}>Pseudo</Text>
                        <TextInput
                            style={[styles.input, focused === "pseudo" && styles.inputFocused]}
                            placeholder="Ton pseudo"
                            placeholderTextColor={colors.textFaint}
                            onFocus={() => setFocused("pseudo")}
                            onBlur={() => setFocused(null)}
                            onChangeText={setPseudo}
                            value={pseudo}
                        />

                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            style={[styles.input, focused === "email" && styles.inputFocused]}
                            placeholder="exemple@mail.com"
                            placeholderTextColor={colors.textFaint}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            onFocus={() => setFocused("email")}
                            onBlur={() => setFocused(null)}
                            onChangeText={setEmail}
                            value={email}
                        />

                        <Text style={styles.label}>Mot de passe</Text>
                        <TextInput
                            style={[styles.input, focused === "password" && styles.inputFocused]}
                            placeholder="••••••••"
                            placeholderTextColor={colors.textFaint}
                            secureTextEntry
                            onFocus={() => setFocused("password")}
                            onBlur={() => setFocused(null)}
                            onChangeText={setPassword}
                            value={password}
                        />

                        <Text style={styles.label}>Confirmer le mot de passe</Text>
                        <TextInput
                            style={[styles.input, focused === "confirm" && styles.inputFocused]}
                            placeholder="••••••••"
                            placeholderTextColor={colors.textFaint}
                            secureTextEntry
                            onFocus={() => setFocused("confirm")}
                            onBlur={() => setFocused(null)}
                            onChangeText={setConfirm}
                            value={confirm}
                        />

                        <ErrorMessage message={error} />

                        <TouchableOpacity
                            style={styles.legalRow}
                            activeOpacity={0.85}
                            onPress={() => setLegalAccepted((value) => !value)}
                        >
                            <View style={[styles.checkbox, legalAccepted && styles.checkboxActive]}>
                                {legalAccepted ? <Ionicons name="checkmark" size={16} color={colors.bg} /> : null}
                            </View>
                            <Text style={styles.legalText}>
                                J'accepte les{" "}
                                <Text
                                    style={styles.legalLink}
                                    onPress={() => navigation.navigate("Legal", { document: "terms" })}
                                >
                                    Conditions d'utilisation
                                </Text>
                                {" "}et la{" "}
                                <Text
                                    style={styles.legalLink}
                                    onPress={() => navigation.navigate("Legal", { document: "privacy" })}
                                >
                                    Politique de confidentialité
                                </Text>
                                .
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, !canSubmit && styles.buttonDisabled]}
                            disabled={!canSubmit}
                            onPress={handleRegister}
                        >
                            <Text style={styles.buttonText}>Créer un compte</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                            <Text style={styles.loginText}>
                                Déjà un compte ? <Text style={styles.loginHighlight}>Se connecter</Text>
                            </Text>
                        </TouchableOpacity>
                    </View>

                </ScrollView>
            )}
        </KeyboardAvoidingView>
    );
}

/* ----------------------------- STYLES ----------------------------- */
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    scrollContent: {
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: spacing.xxl,
    },
    authPanel: {
        width: "100%",
        maxWidth: 430,
        alignSelf: "center",
    },
    header: { alignItems: "center", marginBottom: 32 },
    subtitle: { marginTop: 10, fontSize: 16, color: colors.textMuted, fontWeight: fontWeights.medium },
    loaderCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
    label: { color: colors.text, marginBottom: 8, marginTop: 12, fontSize: typography.bodySm, fontWeight: fontWeights.extraBold },
    input: {
        width: "100%", height: 52, borderRadius: radius.lg,
        paddingHorizontal: 16, fontSize: 16, color: colors.text,
        backgroundColor: colors.surfaceRaised,
    },
    inputFocused: {
        backgroundColor: colors.control,
    },
    errorText: { color: colors.danger, fontSize: 14, fontWeight: fontWeights.medium },
    legalRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 8,
        backgroundColor: colors.surface2,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 1,
    },
    checkboxActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    legalText: {
        flex: 1,
        color: colors.textMuted,
        fontSize: typography.caption,
        lineHeight: 18,
        fontWeight: fontWeights.medium,
    },
    legalLink: {
        color: colors.primary,
        fontWeight: fontWeights.black,
    },
    button: {
        backgroundColor: colors.controlActive, paddingVertical: 14,
        borderRadius: radius.lg, alignItems: "center", marginTop: 28,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: colors.text, fontSize: 16, fontWeight: fontWeights.extraBold },
    loginText: { color: colors.textMuted, textAlign: "center", marginTop: 18 },
    loginHighlight: { color: colors.primary, fontWeight: fontWeights.extraBold },
});
