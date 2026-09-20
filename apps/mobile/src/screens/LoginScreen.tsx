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
import { Ionicons } from "@expo/vector-icons";
import Logo from "../components/Logo";
import LoaderLogo from "../components/LoaderLogo";
import SocialAuthButtons from "../components/SocialAuthButtons";
import { API_URL } from "../lib/config";
import { colors, radius, spacing, typography, fontWeights } from "../theme";
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
    const [showPassword, setShowPassword] = useState(false);
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
                if (loginData?.code === "EMAIL_NOT_VERIFIED") {
                    navigation.navigate("EmailVerification", {
                        email: email.trim().toLowerCase(),
                        hasSession: false,
                        nextRoute: "Login",
                    });
                    return;
                }
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
                    <View style={styles.authSection}>
                        <Text style={styles.sectionEyebrow}>EMAIL</Text>
                        <Text style={styles.label}>Adresse email</Text>
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
                        <View style={[styles.inputWrap, focused === "password" && styles.inputFocused]}>
                            <TextInput
                                style={styles.inputWithIcon}
                                placeholder="••••••••"
                                placeholderTextColor={colors.textFaint}
                                secureTextEntry={!showPassword}
                                onFocus={() => setFocused("password")}
                                onBlur={() => setFocused(null)}
                                onChangeText={setPassword}
                                value={password}
                                returnKeyType="done"
                                onSubmitEditing={() => {
                                    if (formFilled) handleLogin();
                                }}
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword((value) => !value)}
                                activeOpacity={0.85}
                                style={styles.eyeButton}
                            >
                                <Ionicons
                                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                                    size={20}
                                    color={colors.textMuted}
                                />
                            </TouchableOpacity>
                        </View>

                        <ErrorMessage message={error} />

                        <TouchableOpacity
                            style={[styles.button, !formFilled && styles.buttonDisabled]}
                            disabled={!formFilled}
                            onPress={handleLogin}
                        >
                            <Text style={styles.buttonText}>Se connecter</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.dividerRow}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>ou</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    <SocialAuthButtons
                        mode="login"
                        onError={setError}
                        onSuccess={() => navigation.replace("Main")}
                    />

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
    authSection: {
        width: "100%",
        padding: spacing.lg,
        borderRadius: radius.xxl,
        backgroundColor: colors.surfaceFeed,
        borderWidth: 1,
        borderColor: colors.border,
    },
    sectionEyebrow: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        letterSpacing: 3,
        marginBottom: spacing.xs,
    },
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
        backgroundColor: colors.surfaceRaised,
    },
    inputFocused: {
        backgroundColor: colors.control,
    },
    inputWrap: {
        width: "100%",
        height: 52,
        borderRadius: radius.lg,
        paddingLeft: 16,
        paddingRight: 10,
        backgroundColor: colors.surfaceRaised,
        flexDirection: "row",
        alignItems: "center",
    },
    inputWithIcon: {
        flex: 1,
        height: "100%",
        fontSize: 16,
        color: colors.text,
    },
    eyeButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
    },
    dividerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        marginVertical: spacing.lg,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.separator,
    },
    dividerText: {
        color: colors.textTertiary,
        fontSize: typography.caption,
        fontWeight: fontWeights.black,
        textTransform: "uppercase",
    },
    socialSection: {
        width: "100%",
        gap: spacing.sm,
    },
    socialButton: {
        minHeight: 54,
        borderRadius: radius.xl,
        backgroundColor: colors.surfaceRaised,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
    },
    socialIcon: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: colors.surfaceInset,
        alignItems: "center",
        justifyContent: "center",
    },
    socialText: {
        flex: 1,
        color: colors.text,
        fontSize: typography.body,
        fontWeight: fontWeights.extraBold,
    },
    errorText: { color: colors.danger, fontSize: 14, fontWeight: fontWeights.medium },
    button: {
        backgroundColor: colors.controlActive,
        paddingVertical: 14,
        borderRadius: radius.lg,
        alignItems: "center",
        marginTop: 28,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: colors.text, fontSize: 16, fontWeight: fontWeights.extraBold },
    registerText: { color: colors.textMuted, textAlign: "center", marginTop: 18 },
    registerHighlight: { color: colors.primary, fontWeight: fontWeights.extraBold },
});
