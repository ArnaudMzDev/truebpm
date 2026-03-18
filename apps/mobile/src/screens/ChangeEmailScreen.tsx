import React, { useMemo, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "../lib/config";

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

function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ChangeEmailScreen({ navigation }: any) {
    const [currentEmail, setCurrentEmail] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [password, setPassword] = useState("");

    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const canSubmit = useMemo(() => {
        return (
            isValidEmail(currentEmail.trim()) &&
            isValidEmail(newEmail.trim()) &&
            password.trim().length > 0 &&
            currentEmail.trim().toLowerCase() !== newEmail.trim().toLowerCase()
        );
    }, [currentEmail, newEmail, password]);

    const handleSubmit = async () => {
        if (!canSubmit || loading) return;

        const token = await AsyncStorage.getItem("token");
        if (!token) {
            Alert.alert("Erreur", "Tu n'es pas connecté.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/user/email`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    currentEmail: currentEmail.trim(),
                    newEmail: newEmail.trim(),
                    password: password.trim(),
                }),
            });

            const json = await safeJson(res);

            if (!res.ok) {
                Alert.alert("Erreur", json?.error || "Impossible de modifier l’adresse e-mail.");
                return;
            }

            const rawUser = await AsyncStorage.getItem("user");
            if (rawUser) {
                try {
                    const parsed = JSON.parse(rawUser);
                    parsed.email = newEmail.trim();
                    await AsyncStorage.setItem("user", JSON.stringify(parsed));
                } catch {}
            }

            Alert.alert("Succès", "Ton adresse e-mail a bien été mise à jour.");
            navigation.goBack();
        } catch (e) {
            console.log("change email error:", e);
            Alert.alert("Erreur", "Impossible de modifier l’adresse e-mail.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.85}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>

                <Text style={styles.title}>Adresse e-mail</Text>

                <View style={{ width: 24 }} />
            </View>

            <Text style={styles.subtitle}>
                Pour modifier ton adresse e-mail, confirme ton e-mail actuel et ton mot de passe.
            </Text>

            <View style={styles.card}>
                <Text style={styles.label}>Adresse e-mail actuelle</Text>
                <View style={styles.inputWrap}>
                    <TextInput
                        value={currentEmail}
                        onChangeText={setCurrentEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholder="ancien@email.com"
                        placeholderTextColor="#666"
                        style={styles.input}
                    />
                </View>

                <Text style={[styles.label, { marginTop: 16 }]}>Nouvelle adresse e-mail</Text>
                <View style={styles.inputWrap}>
                    <TextInput
                        value={newEmail}
                        onChangeText={setNewEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholder="nouveau@email.com"
                        placeholderTextColor="#666"
                        style={styles.input}
                    />
                </View>

                <Text style={[styles.label, { marginTop: 16 }]}>Mot de passe</Text>
                <View style={styles.inputWrap}>
                    <TextInput
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        placeholder="••••••••"
                        placeholderTextColor="#666"
                        style={styles.input}
                    />
                    <TouchableOpacity onPress={() => setShowPassword((v) => !v)} activeOpacity={0.85}>
                        <Ionicons
                            name={showPassword ? "eye-off-outline" : "eye-outline"}
                            size={20}
                            color="#aaa"
                        />
                    </TouchableOpacity>
                </View>

                {currentEmail.length > 0 && !isValidEmail(currentEmail.trim()) ? (
                    <Text style={styles.helperError}>L’adresse e-mail actuelle est invalide.</Text>
                ) : null}

                {newEmail.length > 0 && !isValidEmail(newEmail.trim()) ? (
                    <Text style={styles.helperError}>La nouvelle adresse e-mail est invalide.</Text>
                ) : null}

                {currentEmail.trim() &&
                newEmail.trim() &&
                currentEmail.trim().toLowerCase() === newEmail.trim().toLowerCase() ? (
                    <Text style={styles.helperError}>
                        La nouvelle adresse e-mail doit être différente de l’actuelle.
                    </Text>
                ) : null}
            </View>

            <TouchableOpacity
                style={[styles.saveBtn, (!canSubmit || loading) && { opacity: 0.6 }]}
                activeOpacity={0.85}
                disabled={!canSubmit || loading}
                onPress={handleSubmit}
            >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Enregistrer</Text>}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
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
    subtitle: {
        color: "#9A9A9A",
        fontSize: 13,
        lineHeight: 19,
        marginBottom: 16,
    },
    card: {
        backgroundColor: "#0F0F0F",
        borderWidth: 1,
        borderColor: "#1F1F1F",
        borderRadius: 18,
        padding: 14,
    },
    label: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "700",
        marginBottom: 8,
    },
    inputWrap: {
        minHeight: 50,
        borderRadius: 12,
        backgroundColor: "#151515",
        borderWidth: 1,
        borderColor: "#2A2A2A",
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    input: {
        flex: 1,
        color: "#fff",
        fontSize: 15,
        paddingVertical: 12,
    },
    helperError: {
        color: "#FF8A8A",
        fontSize: 12,
        marginTop: 10,
        lineHeight: 17,
    },
    saveBtn: {
        marginTop: 18,
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