import React, { useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Logo from "../components/Logo";
import Constants from "expo-constants";

const localIP = Constants.expoConfig?.hostUri?.split(":")[0];
const API_URL = `http://${localIP}:3000`;

const CLOUD_NAME = "dyc6hwvj4";
const UPLOAD_PRESET = "truebpm_unsigned";
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

type User = {
    _id: string;
    pseudo: string;
    email: string;
    bio?: string;
    avatarUrl?: string;
    bannerUrl?: string;
};

// JSON safe pour éviter "Unexpected character: <"
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

export default function EditProfileScreen({ navigation }: any) {
    const [user, setUser] = useState<User | null>(null);

    // URI affichées (peuvent être http(s) OU file:// OU null)
    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [bannerUri, setBannerUri] = useState<string | null>(null);

    const [bio, setBio] = useState("");
    const [loading, setLoading] = useState(false);

    // ✅ On conserve les valeurs “source” pour savoir si l’utilisateur a modifié
    const [initialAvatar, setInitialAvatar] = useState<string>("");
    const [initialBanner, setInitialBanner] = useState<string>("");
    const [initialBio, setInitialBio] = useState<string>("");

    /* -------------------- LOAD USER -------------------- */
    useEffect(() => {
        const loadUser = async () => {
            const raw = await AsyncStorage.getItem("user");
            if (!raw) return;

            try {
                const u: User = JSON.parse(raw);
                setUser(u);

                const a = (u.avatarUrl || "").trim();
                const b = (u.bannerUrl || "").trim();
                const bi = (u.bio || "").trim();

                setInitialAvatar(a);
                setInitialBanner(b);
                setInitialBio(bi);

                setAvatarUri(a ? a : null);
                setBannerUri(b ? b : null);
                setBio(bi);
            } catch (e) {
                console.log("EditProfile loadUser parse error:", e);
            }
        };

        loadUser();
    }, []);

    /* -------------------- IMAGE PICKER -------------------- */
    const pickImage = async (type: "avatar" | "banner") => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Permission refusée", "L'application a besoin d'accéder à ta galerie.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: type === "avatar" ? [1, 1] : [3, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets?.length > 0) {
            const uri = result.assets[0].uri;
            if (type === "avatar") setAvatarUri(uri);
            if (type === "banner") setBannerUri(uri);
        }
    };

    /* -------------------- CLOUDINARY UPLOAD -------------------- */
    const uploadToCloudinary = async (uri: string, folder: string) => {
        const formData = new FormData();
        formData.append(
            "file",
            {
                uri,
                type: "image/jpeg",
                name: "upload.jpg",
            } as any
        );
        formData.append("upload_preset", UPLOAD_PRESET);
        formData.append("folder", folder);

        const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
        const data = await safeJson(res);

        if (!res.ok || !data?.secure_url) {
            console.log("Cloudinary error:", data);
            throw new Error("Erreur lors de l'upload Cloudinary");
        }

        return data.secure_url as string;
    };

    /* -------------------- HELPERS : changed? -------------------- */
    const bioChanged = useMemo(() => bio.trim() !== initialBio, [bio, initialBio]);

    const avatarChanged = useMemo(() => {
        if (avatarUri?.startsWith("file")) return true;
        if (avatarUri === null) return initialAvatar.length > 0;
        return (avatarUri || "").trim() !== initialAvatar;
    }, [avatarUri, initialAvatar]);

    const bannerChanged = useMemo(() => {
        if (bannerUri?.startsWith("file")) return true;
        if (bannerUri === null) return initialBanner.length > 0;
        return (bannerUri || "").trim() !== initialBanner;
    }, [bannerUri, initialBanner]);

    /* -------------------- SAVE PROFILE -------------------- */
    const handleSave = async () => {
        try {
            setLoading(true);

            const token = await AsyncStorage.getItem("token");
            if (!token) {
                setLoading(false);
                return Alert.alert("Erreur", "Tu n'es pas connecté.");
            }

            // ✅ Payload intelligent : on n’envoie que ce qui a changé
            const payload: any = {};

            if (bioChanged) payload.bio = bio.trim();

            // AVATAR
            if (avatarChanged) {
                if (avatarUri === null) {
                    payload.avatarUrl = null; // backend = efface
                } else if (avatarUri.startsWith("file")) {
                    const url = await uploadToCloudinary(avatarUri, "truebpm/profile/avatar");
                    payload.avatarUrl = url;
                } else {
                    payload.avatarUrl = avatarUri.trim();
                }
            }

            // BANNER
            if (bannerChanged) {
                if (bannerUri === null) {
                    payload.bannerUrl = null;
                } else if (bannerUri.startsWith("file")) {
                    const url = await uploadToCloudinary(bannerUri, "truebpm/profile/banner");
                    payload.bannerUrl = url;
                } else {
                    payload.bannerUrl = bannerUri.trim();
                }
            }

            if (Object.keys(payload).length === 0) {
                setLoading(false);
                return Alert.alert("Info", "Aucune modification à enregistrer.");
            }

            const res = await fetch(`${API_URL}/api/user/profile`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            const data = await safeJson(res);

            if (!res.ok) {
                console.log("Profile edit error:", data);
                setLoading(false);
                return Alert.alert("Erreur", data?.error || "Impossible d'enregistrer.");
            }

            if (!data?.user?._id) {
                setLoading(false);
                return Alert.alert("Erreur", "Réponse serveur invalide.");
            }

            await AsyncStorage.setItem("user", JSON.stringify(data.user));

            const next = data.user as User;
            const a = (next.avatarUrl || "").trim();
            const b = (next.bannerUrl || "").trim();
            const bi = (next.bio || "").trim();

            setUser(next);
            setInitialAvatar(a);
            setInitialBanner(b);
            setInitialBio(bi);

            setAvatarUri(a ? a : null);
            setBannerUri(b ? b : null);
            setBio(bi);

            setLoading(false);
            Alert.alert("Succès", "Ton profil a été mis à jour.");

            // ✅ FIX NAVIGATION : "Profile" n'existe pas
            // Retourne sur l'onglet profil
            navigation.navigate("Main", { screen: "ProfileTab" });
            // (Alternative si tu viens toujours du profil : navigation.goBack();)
        } catch (err) {
            console.log("Profile update error:", err);
            setLoading(false);
            Alert.alert("Erreur", "Impossible de modifier ton profil.");
        }
    };

    if (!user) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={{ color: "#fff" }}>Chargement...</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: "#000" }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <Logo size={22} />
                    <Text style={styles.title}>Modifier mon profil</Text>
                </View>

                <Text style={styles.sectionTitle}>Bannière</Text>
                <TouchableOpacity style={styles.bannerPlaceholder} onPress={() => pickImage("banner")}>
                    {bannerUri ? (
                        <Image source={{ uri: bannerUri }} style={styles.bannerImage} />
                    ) : (
                        <Text style={styles.bannerPlaceholderText}>Choisir une bannière</Text>
                    )}
                </TouchableOpacity>

                <Text style={styles.sectionTitle}>Photo de profil</Text>
                <View style={styles.avatarRow}>
                    <TouchableOpacity style={styles.avatarPlaceholder} onPress={() => pickImage("avatar")}>
                        {avatarUri ? (
                            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                        ) : (
                            <Text style={styles.avatarPlaceholderText}>Choisir une photo</Text>
                        )}
                    </TouchableOpacity>

                    <Text style={styles.avatarHint}>
                        Conseil : une image claire & reconnaissable fonctionne mieux.
                    </Text>
                </View>

                <Text style={styles.sectionTitle}>Bio</Text>
                <TextInput
                    style={styles.bioInput}
                    placeholder="Parle un peu de toi..."
                    placeholderTextColor="#666"
                    multiline
                    maxLength={280}
                    value={bio}
                    onChangeText={setBio}
                />
                <Text style={styles.bioCount}>{bio.length}/280</Text>

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    disabled={loading}
                    onPress={handleSave}
                >
                    <Text style={styles.buttonText}>{loading ? "Enregistrement..." : "Enregistrer"}</Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
    },
    container: {
        paddingHorizontal: 24,
        paddingTop: 40,
        paddingBottom: 40,
        backgroundColor: "#000",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 24,
        justifyContent: "space-between",
    },
    title: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
    },
    sectionTitle: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
        marginBottom: 8,
        marginTop: 18,
    },
    bannerPlaceholder: {
        width: "100%",
        height: 120,
        borderRadius: 18,
        backgroundColor: "#141414",
        borderWidth: 1,
        borderColor: "#333",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
    },
    bannerImage: { width: "100%", height: "100%" },
    bannerPlaceholderText: { color: "#777" },
    avatarRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 8,
    },
    avatarPlaceholder: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: "#141414",
        borderWidth: 1,
        borderColor: "#333",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        marginRight: 16,
    },
    avatarImage: { width: "100%", height: "100%" },
    avatarPlaceholderText: {
        color: "#777",
        fontSize: 11,
        textAlign: "center",
    },
    avatarHint: { flex: 1, color: "#777", fontSize: 12 },
    bioInput: {
        marginTop: 4,
        minHeight: 90,
        borderRadius: 14,
        padding: 12,
        backgroundColor: "#141414",
        borderWidth: 1,
        borderColor: "#333",
        color: "#fff",
        textAlignVertical: "top",
        fontSize: 14,
    },
    bioCount: {
        color: "#666",
        fontSize: 12,
        textAlign: "right",
        marginTop: 4,
    },
    button: {
        backgroundColor: "#5E17EB",
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
        marginTop: 28,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});