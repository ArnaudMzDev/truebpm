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

// ---------------- ERROR MESSAGE ----------------

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

// ---------------- VALIDATION ----------------

function validateEmail(email: string) {
    return /\S+@\S+\.\S+/.test(email);
}

export default function LoginScreen({ navigation }: any) {
    const [focused, setFocused] = useState<string | null>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const formFilled = email.trim() !== "" && password.trim() !== "";

    // 🔥 URL FIXÉE (tu avais un "\n" avant !)
    const API_URL = "http://192.168.1.52:3000/api/auth/login";

    // ---------------- LOGIN ----------------

    const handleLogin = async () => {
        setError("");

        if (!validateEmail(email)) return setError("Email invalide.");
        if (password.length < 8) return setError("Mot de passe trop court.");

        setLoading(true);

        try {
            const res = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setLoading(false);
                return setError(data.error || "Identifiants incorrects.");
            }

            // 🔥 STOCKAGE TOKEN + USER
            await AsyncStorage.setItem("token", data.token);
            await AsyncStorage.setItem("user", JSON.stringify(data.user));

            setLoading(false);
            navigation.replace("Home");

        } catch (err) {
            console.error("LOGIN ERROR :", err);
            setLoading(false);
            setError("Impossible de se connecter au serveur.");
        }
    };

    // ---------------- UI ----------------

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
                    {/* EMAIL */}
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={[
                            styles.input,
                            focused === "email" && styles.inputFocused,
                        ]}
                        placeholder="exemple@mail.com"
                        placeholderTextColor="#777"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        onFocus={() => setFocused("email")}
                        onBlur={() => setFocused(null)}
                        onChangeText={setEmail}
                        value={email}
                    />

                    {/* PASSWORD */}
                    <Text style={styles.label}>Mot de passe</Text>
                    <TextInput
                        style={[
                            styles.input,
                            focused === "password" && styles.inputFocused,
                        ]}
                        placeholder="••••••••"
                        placeholderTextColor="#777"
                        secureTextEntry
                        onFocus={() => setFocused("password")}
                        onBlur={() => setFocused(null)}
                        onChangeText={setPassword}
                        value={password}
                    />

                    {/* ERROR */}
                    <ErrorMessage message={error} />

                    {/* BUTTON */}
                    <TouchableOpacity
                        style={[styles.button, !formFilled && styles.buttonDisabled]}
                        disabled={!formFilled}
                        onPress={handleLogin}
                    >
                        <Text style={styles.buttonText}>Se connecter</Text>
                    </TouchableOpacity>

                    {/* LINK REGISTER */}
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

// ---------------- STYLES ----------------

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#000", paddingHorizontal: 24, justifyContent: "center" },
    header: { alignItems: "center", marginBottom: 40 },
    subtitle: { marginTop: 10, fontSize: 16, color: "#aaa" },
    form: { width: "100%" },
    label: { color: "#fff", marginBottom: 8, marginTop: 12, fontSize: 14, fontWeight: "600" },
    input: {
        width: "100%", height: 52, borderRadius: 14,
        paddingHorizontal: 16, fontSize: 16, color: "#fff",
        backgroundColor: "#141414", borderWidth: 1, borderColor: "#333",
    },
    inputFocused: {
        borderColor: "#9B5CFF",
        shadowColor: "#9B5CFF",
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
    },
    errorText: { color: "#ff4d4d", fontSize: 14, fontWeight: "500" },
    button: { backgroundColor: "#5E17EB", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 28 },
    buttonDisabled: { backgroundColor: "#2f116e", opacity: 0.5 },
    buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    registerText: { color: "#aaa", textAlign: "center", marginTop: 18 },
    registerHighlight: { color: "#9B5CFF", fontWeight: "700" },
});