// apps/mobile/src/screens/EditProfileScreen.tsx
import React, { useEffect, useState } from "react";
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

export default function EditProfileScreen({ navigation }: any) {
    const [user, setUser] = useState<User | null>(null);

    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [bannerUri, setBannerUri] = useState<string | null>(null);
    const [bio, setBio] = useState("");
    const [loading, setLoading] = useState(false);

    /* -------------------- LOAD USER -------------------- */

    useEffect(() => {
        const loadUser = async () => {
            const raw = await AsyncStorage.getItem("user");
            if (raw) {
                const u: User = JSON.parse(raw);
                setUser(u);
                setAvatarUri(u.avatarUrl || null);
                setBannerUri(u.bannerUrl || null);
                setBio(u.bio || "");
            }
        };
        loadUser();
    }, []);

    /* -------------------- IMAGE PICKER -------------------- */

    const pickImage = async (type: "avatar" | "banner") => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert(
                "Permission",
                "On a besoin d'accéder à ta galerie pour choisir une image."
            );
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: type === "avatar" ? [1, 1] : [3, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const uri = result.assets[0].uri;
            if (type === "avatar") setAvatarUri(uri);
            else setBannerUri(uri);
        }
    };

    /* -------------------- CLOUDINARY -------------------- */

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

        const res = await fetch(CLOUDINARY_URL, {
            method: "POST",
            body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
            console.log("Cloudinary error:", data);
            throw new Error("Erreur upload image.");
        }

        return data.secure_url as string;
    };

    /* -------------------- SAVE PROFILE -------------------- */

    const handleSave = async () => {
        try {
            setLoading(true);

            const token = await AsyncStorage.getItem("token");
            if (!token) {
                setLoading(false);
                return Alert.alert("Erreur", "Utilisateur non authentifié.");
            }

            let avatarUrl: string | undefined = user?.avatarUrl;
            let bannerUrl: string | undefined = user?.bannerUrl;

            // Avatar : si uri locale (file://), on upload
            if (avatarUri && avatarUri.startsWith("file")) {
                avatarUrl = await uploadToCloudinary(
                    avatarUri,
                    "truebpm/profile/avatar"
                );
            } else if (avatarUri === null) {
                avatarUrl = "";
            }

            // Bannière
            if (bannerUri && bannerUri.startsWith("file")) {
                bannerUrl = await uploadToCloudinary(
                    bannerUri,
                    "truebpm/profile/banner"
                );
            } else if (bannerUri === null) {
                bannerUrl = "";
            }

            const res = await fetch(`${API_URL}/api/user/profile`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    bio: bio.trim(), // <– toujours envoyé
                    avatarUrl,
                    bannerUrl,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                console.log("Profile edit error:", data);
                setLoading(false);
                return Alert.alert(
                    "Erreur",
                    data.error || "Impossible d'enregistrer le profil."
                );
            }

            // 🔥 On met à jour le user stocké côté mobile
            if (data.user) {
                await AsyncStorage.setItem("user", JSON.stringify(data.user));
            }

            setLoading(false);
            Alert.alert("Profil mis à jour", "Ton profil a bien été modifié !");

            navigation.replace("Profile");

        } catch (err) {
            console.log(err);
            setLoading(false);
            Alert.alert("Erreur", "Une erreur est survenue.");
        }
    };

    if (!user) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={{ color: "#fff" }}>Chargement du profil...</Text>
            </View>
        );
    }

    /* -------------------- RENDER -------------------- */

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: "#000" }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
            >
                {/* HEADER */}
                <View style={styles.header}>
                    <Logo size={22} />
                    <Text style={styles.title}>Modifier mon profil</Text>
                </View>

                {/* BANNIÈRE */}
                <Text style={styles.sectionTitle}>Bannière</Text>
                <TouchableOpacity
                    style={styles.bannerPlaceholder}
                    onPress={() => pickImage("banner")}
                >
                    {bannerUri ? (
                        <Image source={{ uri: bannerUri }} style={styles.bannerImage} />
                    ) : (
                        <Text style={styles.bannerPlaceholderText}>
                            Choisir une bannière
                        </Text>
                    )}
                </TouchableOpacity>

                {/* AVATAR */}
                <Text style={styles.sectionTitle}>Photo de profil</Text>
                <View style={styles.avatarRow}>
                    <TouchableOpacity
                        style={styles.avatarPlaceholder}
                        onPress={() => pickImage("avatar")}
                    >
                        {avatarUri ? (
                            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                        ) : (
                            <Text style={styles.avatarPlaceholderText}>
                                Choisir une photo
                            </Text>
                        )}
                    </TouchableOpacity>
                    <Text style={styles.avatarHint}>
                        Conseil : choisis une image claire & reconnaissable.
                    </Text>
                </View>

                {/* BIO */}
                <Text style={styles.sectionTitle}>Bio</Text>
                <TextInput
                    style={styles.bioInput}
                    placeholder="Parle un peu de toi, de ta musique, de ton mood..."
                    placeholderTextColor="#666"
                    multiline
                    maxLength={280}
                    value={bio}
                    onChangeText={setBio}
                />
                <Text style={styles.bioCount}>{bio.length}/280</Text>

                {/* BOUTON */}
                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    disabled={loading}
                    onPress={handleSave}
                >
                    <Text style={styles.buttonText}>
                        {loading ? "Enregistrement..." : "Enregistrer"}
                    </Text>
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
    bannerImage: {
        width: "100%",
        height: "100%",
    },
    bannerPlaceholderText: {
        color: "#777",
    },
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
    avatarImage: {
        width: "100%",
        height: "100%",
    },
    avatarPlaceholderText: {
        color: "#777",
        fontSize: 11,
        textAlign: "center",
    },
    avatarHint: {
        flex: 1,
        color: "#777",
        fontSize: 12,
    },
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
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
});