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

export default function ChangePasswordScreen({ navigation }: any) {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [loading, setLoading] = useState(false);

    const canSubmit = useMemo(() => {
        return (
            currentPassword.trim().length > 0 &&
            newPassword.trim().length >= 6 &&
            confirmPassword.trim().length >= 6 &&
            newPassword === confirmPassword &&
            newPassword !== currentPassword
        );
    }, [currentPassword, newPassword, confirmPassword]);

    const handleSubmit = async () => {
        if (!canSubmit || loading) return;

        const token = await AsyncStorage.getItem("token");
        if (!token) {
            Alert.alert("Erreur", "Tu n'es pas connecté.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/user/password`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    currentPassword: currentPassword.trim(),
                    newPassword: newPassword.trim(),
                }),
            });

            const json = await safeJson(res);

            if (!res.ok) {
                Alert.alert("Erreur", json?.error || "Impossible de modifier le mot de passe.");
                return;
            }

            Alert.alert("Succès", "Ton mot de passe a bien été mis à jour.");
            navigation.goBack();
        } catch (e) {
            console.log("change password error:", e);
            Alert.alert("Erreur", "Impossible de modifier le mot de passe.");
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

                <Text style={styles.title}>Mot de passe</Text>

                <View style={{ width: 24 }} />
            </View>

            <Text style={styles.subtitle}>
                Pour modifier ton mot de passe, confirme d’abord ton mot de passe actuel.
            </Text>

            <View style={styles.card}>
                <Text style={styles.label}>Mot de passe actuel</Text>
                <View style={styles.inputWrap}>
                    <TextInput
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        secureTextEntry={!showCurrent}
                        placeholder="••••••••"
                        placeholderTextColor="#666"
                        style={styles.input}
                    />
                    <TouchableOpacity onPress={() => setShowCurrent((v) => !v)} activeOpacity={0.85}>
                        <Ionicons
                            name={showCurrent ? "eye-off-outline" : "eye-outline"}
                            size={20}
                            color="#aaa"
                        />
                    </TouchableOpacity>
                </View>

                <Text style={[styles.label, { marginTop: 16 }]}>Nouveau mot de passe</Text>
                <View style={styles.inputWrap}>
                    <TextInput
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry={!showNew}
                        placeholder="Au moins 6 caractères"
                        placeholderTextColor="#666"
                        style={styles.input}
                    />
                    <TouchableOpacity onPress={() => setShowNew((v) => !v)} activeOpacity={0.85}>
                        <Ionicons
                            name={showNew ? "eye-off-outline" : "eye-outline"}
                            size={20}
                            color="#aaa"
                        />
                    </TouchableOpacity>
                </View>

                <Text style={[styles.label, { marginTop: 16 }]}>Confirmer le nouveau mot de passe</Text>
                <View style={styles.inputWrap}>
                    <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showConfirm}
                        placeholder="Retape le nouveau mot de passe"
                        placeholderTextColor="#666"
                        style={styles.input}
                    />
                    <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} activeOpacity={0.85}>
                        <Ionicons
                            name={showConfirm ? "eye-off-outline" : "eye-outline"}
                            size={20}
                            color="#aaa"
                        />
                    </TouchableOpacity>
                </View>

                {newPassword.length > 0 && newPassword.length < 6 ? (
                    <Text style={styles.helperError}>
                        Le nouveau mot de passe doit faire au moins 6 caractères.
                    </Text>
                ) : null}

                {confirmPassword.length > 0 && newPassword !== confirmPassword ? (
                    <Text style={styles.helperError}>
                        La confirmation ne correspond pas.
                    </Text>
                ) : null}

                {newPassword.length > 0 && currentPassword === newPassword ? (
                    <Text style={styles.helperError}>
                        Le nouveau mot de passe doit être différent de l’ancien.
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