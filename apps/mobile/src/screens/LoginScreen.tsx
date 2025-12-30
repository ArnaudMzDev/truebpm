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
import Constants from "expo-constants";

const localIP = Constants.expoConfig?.hostUri?.split(":")[0];
const API_URL = `http://${localIP}:3000`;

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

/**
 * Parse JSON en mode safe :
 * - si le serveur renvoie HTML (404/405) => évite "Unexpected character: <"
 */
async function safeJson(res: Response): Promise<any | null> {
    const text = await res.text();
    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch {
        // utile pour debug (retour HTML, etc.)
        console.log("Non-JSON response:", text.slice(0, 200));
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
            // 1) Login -> token
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

            await AsyncStorage.setItem("token", token);

            // 2) Source de vérité -> /user/me
            const meRes = await fetch(`${API_URL}/api/user/me`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const meData = await safeJson(meRes);

            if (!meRes.ok) {
                // Token pas accepté / backend pas prêt => on purge et on affiche
                await AsyncStorage.multiRemove(["token", "user"]);
                setLoading(false);
                return setError(meData?.error || "Impossible de récupérer le profil.");
            }

            if (!meData?.user?._id) {
                await AsyncStorage.multiRemove(["token", "user"]);
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
                        placeholderTextColor="#777"
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
                        placeholderTextColor="#777"
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
        backgroundColor: "#000",
        paddingHorizontal: 24,
        justifyContent: "center",
    },
    header: { alignItems: "center", marginBottom: 40 },
    subtitle: { marginTop: 10, fontSize: 16, color: "#aaa" },
    form: { width: "100%" },
    label: {
        color: "#fff",
        marginBottom: 8,
        marginTop: 12,
        fontSize: 14,
        fontWeight: "600",
    },
    input: {
        width: "100%",
        height: 52,
        borderRadius: 14,
        paddingHorizontal: 16,
        fontSize: 16,
        color: "#fff",
        backgroundColor: "#141414",
        borderWidth: 1,
        borderColor: "#333",
    },
    inputFocused: {
        borderColor: "#9B5CFF",
        shadowColor: "#9B5CFF",
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
    },
    errorText: { color: "#ff4d4d", fontSize: 14, fontWeight: "500" },
    button: {
        backgroundColor: "#5E17EB",
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
        marginTop: 28,
    },
    buttonDisabled: { backgroundColor: "#2f116e", opacity: 0.5 },
    buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    registerText: { color: "#aaa", textAlign: "center", marginTop: 18 },
    registerHighlight: { color: "#9B5CFF", fontWeight: "700" },
});