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

import Logo from "../components/Logo";
import LoaderLogo from "../components/LoaderLogo";

const API_URL = "http://192.168.1.52:3000"; // 🔥 REMPLACE PAR TON IP LOCALE

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
    const min = pw.length >= 8;
    const upper = /[A-Z]/.test(pw);
    const number = /\d/.test(pw);
    const special = /[!@#$%^&*(),.?":{}|<>]/.test(pw);

    return min && upper && number && special;
}

/* ----------------------------- SCREEN ----------------------------- */

export default function RegisterScreen({ navigation }: any) {
    const [focused, setFocused] = useState<string | null>(null);

    const [pseudo, setPseudo] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const formFilled =
        pseudo.trim() &&
        email.trim() &&
        password.trim() &&
        confirm.trim();

    const handleRegister = async () => {
        setError("");

        if (!pseudo.trim()) return setError("Choisis un pseudo.");
        if (!validateEmail(email)) return setError("Email invalide.");
        if (!validatePassword(password))
            return setError(
                "Mot de passe trop faible (8 caractères, majuscule, chiffre, symbole)."
            );
        if (password !== confirm)
            return setError("Les mots de passe ne correspondent pas.");

        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pseudo, email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setLoading(false);
                return setError(data.error || "Erreur inconnue.");
            }

            setLoading(false);
            navigation.navigate("Login");

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
            {!loading && (
                <View style={styles.header}>
                    <Logo size={48} />
                    <Text style={styles.subtitle}>Crée ton compte</Text>
                </View>
            )}

            {loading ? (
                <View style={styles.loaderCenter}>
                    <LoaderLogo size={50} />
                </View>
            ) : (
                <View style={styles.form}>

                    <Text style={styles.label}>Pseudo</Text>
                    <TextInput
                        style={[styles.input, focused === "pseudo" && styles.inputFocused]}
                        placeholder="Ton pseudo"
                        placeholderTextColor="#777"
                        autoCapitalize="none"
                        onFocus={() => setFocused("pseudo")}
                        onBlur={() => setFocused(null)}
                        onChangeText={setPseudo}
                        value={pseudo}
                    />

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
                    />

                    <Text style={styles.label}>Mot de passe</Text>
                    <TextInput
                        style={[styles.input, focused === "password" && styles.inputFocused]}
                        placeholder="••••••••"
                        placeholderTextColor="#777"
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
                        placeholderTextColor="#777"
                        secureTextEntry
                        onFocus={() => setFocused("confirm")}
                        onBlur={() => setFocused(null)}
                        onChangeText={setConfirm}
                        value={confirm}
                    />

                    <ErrorMessage message={error} />

                    <TouchableOpacity
                        style={[styles.button, !formFilled && styles.buttonDisabled]}
                        disabled={!formFilled}
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
            )}
        </KeyboardAvoidingView>
    );
}

/* ----------------------------- STYLES ----------------------------- */

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#000", paddingHorizontal: 24, justifyContent: "center" },
    header: { alignItems: "center", marginBottom: 35 },
    subtitle: { marginTop: 10, fontSize: 16, color: "#aaa" },
    form: { width: "100%" },
    loaderCenter: { alignItems: "center", marginTop: 20 },
    label: { color: "#fff", marginBottom: 8, marginTop: 12, fontSize: 14, fontWeight: "600" },
    input: {
        width: "100%", height: 52, borderRadius: 14,
        paddingHorizontal: 16, fontSize: 16, color: "#fff",
        backgroundColor: "#141414", borderWidth: 1, borderColor: "#333",
    },
    inputFocused: {
        borderColor: "#9B5CFF", shadowColor: "#9B5CFF",
        shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
    },
    errorText: { color: "#ff4d4d", fontSize: 14, fontWeight: "500" },
    button: {
        backgroundColor: "#5E17EB", paddingVertical: 14,
        borderRadius: 12, alignItems: "center", marginTop: 28,
    },
    buttonDisabled: { backgroundColor: "#2f116e", opacity: 0.5 },
    buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    loginText: { color: "#aaa", textAlign: "center", marginTop: 18 },
    loginHighlight: { color: "#9B5CFF", fontWeight: "700" },
});