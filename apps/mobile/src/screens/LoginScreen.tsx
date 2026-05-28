import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Logo from "../components/Logo";
import LoaderLogo from "../components/LoaderLogo";
import { API_URL } from "../lib/config";
import { colors, radius, spacing, typography, fontWeights, shadows } from "../theme";
import { setStoredToken, clearStoredSession } from "../lib/authStorage";

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
    }, [message, opacity]);

    if (!message) return null;

    return (
        <Animated.View style={{ opacity, marginTop: 5 }}>
            <Text style={styles.errorText}>{message}</Text>
        </Animated.View>
    );
}

function validateEmail(email: string) {
    return /\S+@\S+\.\S+/.test(email);
}

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

export default function LoginScreen({ navigation }: any) {
    const [focused, setFocused] = useState<string | null>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const formFilled = email.trim() !== "" && password.trim() !== "";

    const handleLogin = async () => {
        setError("");

        if (!validateEmail(email)) return setError("Email invalide.");
        if (password.length < 8) return setError("Mot de passe trop court.");

        setLoading(true);

        try {

            const loginRes = await fetch(`${API_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim(), password }),
            });

            const loginData = await safeJson(loginRes);

            if (!loginRes.ok) {
                setLoading(false);
                return setError(loginData?.error || "Identifiants incorrects.");
            }

            const token: string | undefined = loginData?.token;
            if (!token) {
                setLoading(false);
                return setError("Réponse serveur invalide.");
            }

            await setStoredToken(token);

            const meRes = await fetch(`${API_URL}/api/user/me`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const meData = await safeJson(meRes);

            if (!meRes.ok) {
                await clearStoredSession();
                setLoading(false);
                return setError(meData?.error || "Impossible de récupérer le profil.");
            }

            if (!meData?.user?._id) {
                await clearStoredSession();
                setLoading(false);
                return setError("Profil invalide.");
            }

            await AsyncStorage.setItem("user", JSON.stringify(meData.user));

            setLoading(false);
            navigation.replace("Main");
        } catch (err) {
            console.error("LOGIN ERROR:", err);
            setLoading(false);
            setError("Impossible de se connecter au serveur.");
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            {!loading && (
                <View style={styles.header}>
                    <Logo size={48} />
                    <Text style={styles.subtitle}>Connecte-toi à ton compte.</Text>
                </View>
            )}

            {loading ? (
                <View style={{ alignItems: "center", marginTop: 40 }}>
                    <LoaderLogo size={50} />
                </View>
            ) : (
                <View style={styles.form}>
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
                        returnKeyType="next"
                    />

                    <Text style={styles.label}>Mot de passe</Text>
                    <TextInput
                        style={[styles.input, focused === "password" && styles.inputFocused]}
                        placeholder="Mot de passe"
                        placeholderTextColor={colors.textFaint}
                        secureTextEntry
                        onFocus={() => setFocused("password")}
                        onBlur={() => setFocused(null)}
                        onChangeText={setPassword}
                        value={password}
                        returnKeyType="done"
                        onSubmitEditing={() => {
                            if (formFilled) handleLogin();
                        }}
                    />

                    <ErrorMessage message={error} />

                    <TouchableOpacity
                        style={[styles.button, !formFilled && styles.buttonDisabled]}
                        disabled={!formFilled}
                        onPress={handleLogin}
                    >
                        <Text style={styles.buttonText}>Se connecter</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.navigate("Register")}>
                        <Text style={styles.registerText}>
                            Pas de compte ?{" "}
                            <Text style={styles.registerHighlight}>Créer un compte</Text>
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
        paddingHorizontal: spacing.xxl,
        justifyContent: "center",
    },
    header: { alignItems: "center", marginBottom: 40 },
    subtitle: { marginTop: 10, fontSize: 16, color: colors.textMuted, fontWeight: fontWeights.medium },
    form: { width: "100%" },
    label: {
        color: colors.text,
        marginBottom: 8,
        marginTop: 12,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.extraBold,
    },
    input: {
        width: "100%",
        height: 52,
        borderRadius: radius.lg,
        paddingHorizontal: 16,
        fontSize: 16,
        color: colors.text,
        backgroundColor: colors.surface2,
        borderWidth: 1,
        borderColor: colors.border,
    },
    inputFocused: {
        borderColor: colors.primary,
        ...shadows.glowPrimary,
    },
    errorText: { color: colors.danger, fontSize: 14, fontWeight: fontWeights.medium },
    button: {
        backgroundColor: colors.primaryDark,
        paddingVertical: 14,
        borderRadius: radius.lg,
        alignItems: "center",
        marginTop: 28,
        ...shadows.glowPrimary,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: colors.text, fontSize: 16, fontWeight: fontWeights.extraBold },
    registerText: { color: colors.textMuted, textAlign: "center", marginTop: 18 },
    registerHighlight: { color: colors.primary, fontWeight: fontWeights.extraBold },
});
