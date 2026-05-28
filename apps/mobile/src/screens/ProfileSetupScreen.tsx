// apps/mobile/src/screens/ProfileSetupScreen.tsx
import React, { useCallback, useState } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import Logo from "../components/Logo";
import { API_URL } from "../lib/config";
import { getStoredToken } from "../lib/authStorage";

const CLOUD_NAME = "dyc6hwvj4";
const UPLOAD_PRESET = "truebpm_unsigned";
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
const PROFILE_MUSIC_PICK_KEY = "edit_profile_pending_music_pick";

type MusicRef = {
    entityId: string;
    entityType: "song" | "album" | "artist";
    title: string;
    artist: string;
    coverUrl: string;
    previewUrl: string;
};

type PickKind =
    | "pinnedTrack"
    | "favoriteArtists"
    | "favoriteAlbums"
    | "favoriteTracks";

function MusicChip({
                       item,
                       onRemove,
                   }: {
    item: MusicRef;
    onRemove: () => void;
}) {
    return (
        <View style={styles.musicChip}>
            {item.coverUrl ? (
                <Image source={{ uri: item.coverUrl }} style={styles.musicChipCover} />
            ) : null}

            <View style={{ flex: 1 }}>
                <Text style={styles.musicChipTitle} numberOfLines={1}>
                    {item.title}
                </Text>
                <Text style={styles.musicChipArtist} numberOfLines={1}>
                    {item.artist}
                </Text>
            </View>

            <TouchableOpacity onPress={onRemove} style={styles.musicChipRemove}>
                <Text style={styles.musicChipRemoveText}>x</Text>
            </TouchableOpacity>
        </View>
    );
}

export default function ProfileSetupScreen({ navigation }: any) {
    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [bannerUri, setBannerUri] = useState<string | null>(null);
    const [bio, setBio] = useState("");
    const [loading, setLoading] = useState(false);
    const [pinnedTrack, setPinnedTrack] = useState<MusicRef | null>(null);
    const [favoriteArtists, setFavoriteArtists] = useState<MusicRef[]>([]);
    const [favoriteAlbums, setFavoriteAlbums] = useState<MusicRef[]>([]);
    const [favoriteTracks, setFavoriteTracks] = useState<MusicRef[]>([]);

    const applyPickedMusic = useCallback((kind: PickKind, item: MusicRef) => {
        if (kind === "pinnedTrack") {
            setPinnedTrack(item);
            return;
        }

        if (kind === "favoriteArtists") {
            setFavoriteArtists((prev) => {
                const next = [item, ...prev.filter((x) => x.entityId !== item.entityId)];
                return next.slice(0, 3);
            });
            return;
        }

        if (kind === "favoriteAlbums") {
            setFavoriteAlbums((prev) => {
                const next = [item, ...prev.filter((x) => x.entityId !== item.entityId)];
                return next.slice(0, 3);
            });
            return;
        }

        setFavoriteTracks((prev) => {
            const next = [item, ...prev.filter((x) => x.entityId !== item.entityId)];
            return next.slice(0, 3);
        });
    }, []);

    useFocusEffect(
        useCallback(() => {
            let active = true;

            (async () => {
                try {
                    const raw = await AsyncStorage.getItem(PROFILE_MUSIC_PICK_KEY);
                    if (!raw || !active) return;

                    const parsed = JSON.parse(raw);
                    if (parsed?.kind && parsed?.item) {
                        applyPickedMusic(parsed.kind, parsed.item);
                    }

                    await AsyncStorage.removeItem(PROFILE_MUSIC_PICK_KEY);
                } catch (e) {
                    console.log("ProfileSetup pending music pick error:", e);
                }
            })();

            return () => {
                active = false;
            };
        }, [applyPickedMusic])
    );

    const openPicker = (kind: PickKind) => {
        const initialType =
            kind === "favoriteArtists"
                ? "artist"
                : kind === "favoriteAlbums"
                    ? "album"
                    : "song";

        navigation.navigate("MusicSearch", {
            mode: "pickProfileMusic",
            kind,
            initialType,
        });
    };

    /* -------------------- PICKERS -------------------- */

    const pickImage = async (type: "avatar" | "banner") => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Permission", "On a besoin de ta galerie.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: type === "avatar" ? [1, 1] : [16, 9],
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const uri = result.assets[0].uri;
            if (type === "avatar") setAvatarUri(uri);
            else setBannerUri(uri);
        }
    };

    /* -------------------- CLOUDINARY UPLOAD -------------------- */

    const uploadToCloudinary = async (uri: string, folder: string) => {
        const formData = new FormData();
        formData.append("file", {
            uri,
            type: "image/jpeg",
            name: "upload.jpg",
        } as any);
        formData.append("upload_preset", UPLOAD_PRESET);
        formData.append("folder", folder);

        const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
        const data = await res.json();

        if (!res.ok) {
            console.log("Cloudinary error:", data);
            throw new Error("Upload échoué.");
        }

        return data.secure_url as string;
    };

    /* -------------------- SUBMIT -------------------- */

    const handleSaveProfile = async () => {
        try {
            const hasMusic =
                !!pinnedTrack ||
                favoriteArtists.length > 0 ||
                favoriteAlbums.length > 0 ||
                favoriteTracks.length > 0;

            if (!avatarUri && !bannerUri && !bio.trim() && !hasMusic) {
                return Alert.alert(
                    "Profil incomplet",
                    "Ajoute au moins une image, une bio ou une sélection musicale."
                );
            }

            setLoading(true);

            const token = await getStoredToken();
            if (!token) {
                setLoading(false);
                return Alert.alert("Erreur", "Utilisateur non authentifié.");
            }

            let avatarUrl: string | undefined;
            let bannerUrl: string | undefined;

            if (avatarUri) {
                avatarUrl = await uploadToCloudinary(
                    avatarUri,
                    "truebpm/profile/avatar"
                );
            }
            if (bannerUri) {
                bannerUrl = await uploadToCloudinary(
                    bannerUri,
                    "truebpm/profile/banner"
                );
            }

            const res = await fetch(`${API_URL}/api/user/profile`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    bio: bio.trim(),
                    avatarUrl,
                    bannerUrl,
                    pinnedTrack,
                    favoriteArtists,
                    favoriteAlbums,
                    favoriteTracks,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                console.log("Profile API error:", data);
                setLoading(false);
                return Alert.alert(
                    "Erreur",
                    data.error || "Impossible d'enregistrer."
                );
            }

            if (data.user) {
                await AsyncStorage.setItem("user", JSON.stringify(data.user));
            }

            setLoading(false);
            navigation.replace("Main");
        } catch (err) {
            console.log(err);
            setLoading(false);
            Alert.alert("Erreur", "Une erreur est survenue.");
        }
    };

    /* -------------------- RENDER -------------------- */

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: "#000" }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView contentContainerStyle={styles.container}>
                {/* Bouton PASSER */}
                <TouchableOpacity
                    onPress={() => navigation.replace("Main")}
                    style={styles.skipButton}
                >
                    <Text style={styles.skipText}>Passer</Text>
                </TouchableOpacity>

                {/* HEADER */}
                <View style={styles.header}>
                    <Logo size={38} />
                    <Text style={styles.subtitle}>
                        Personnalise ton profil TrueBPM
                    </Text>
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
                        Conseil : choisis une image claire.
                    </Text>
                </View>

                {/* BIO */}
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

                <Text style={styles.sectionTitle}>Son épinglé</Text>
                {pinnedTrack ? (
                    <MusicChip item={pinnedTrack} onRemove={() => setPinnedTrack(null)} />
                ) : (
                    <Text style={styles.emptyText}>Aucun son épinglé</Text>
                )}
                <TouchableOpacity style={styles.selectBtn} onPress={() => openPicker("pinnedTrack")}>
                    <Text style={styles.selectBtnText}>
                        {pinnedTrack ? "Changer le son épinglé" : "Choisir un son épinglé"}
                    </Text>
                </TouchableOpacity>

                <Text style={styles.sectionTitle}>Artistes favoris</Text>
                {favoriteArtists.length > 0 ? (
                    favoriteArtists.map((item) => (
                        <MusicChip
                            key={`${item.entityType}:${item.entityId}`}
                            item={item}
                            onRemove={() =>
                                setFavoriteArtists((prev) =>
                                    prev.filter((x) => x.entityId !== item.entityId)
                                )
                            }
                        />
                    ))
                ) : (
                    <Text style={styles.emptyText}>Aucun artiste favori</Text>
                )}
                {favoriteArtists.length < 3 ? (
                    <TouchableOpacity style={styles.selectBtn} onPress={() => openPicker("favoriteArtists")}>
                        <Text style={styles.selectBtnText}>Ajouter un artiste</Text>
                    </TouchableOpacity>
                ) : null}

                <Text style={styles.sectionTitle}>Albums favoris</Text>
                {favoriteAlbums.length > 0 ? (
                    favoriteAlbums.map((item) => (
                        <MusicChip
                            key={`${item.entityType}:${item.entityId}`}
                            item={item}
                            onRemove={() =>
                                setFavoriteAlbums((prev) =>
                                    prev.filter((x) => x.entityId !== item.entityId)
                                )
                            }
                        />
                    ))
                ) : (
                    <Text style={styles.emptyText}>Aucun album favori</Text>
                )}
                {favoriteAlbums.length < 3 ? (
                    <TouchableOpacity style={styles.selectBtn} onPress={() => openPicker("favoriteAlbums")}>
                        <Text style={styles.selectBtnText}>Ajouter un album</Text>
                    </TouchableOpacity>
                ) : null}

                <Text style={styles.sectionTitle}>Morceaux favoris</Text>
                {favoriteTracks.length > 0 ? (
                    favoriteTracks.map((item) => (
                        <MusicChip
                            key={`${item.entityType}:${item.entityId}`}
                            item={item}
                            onRemove={() =>
                                setFavoriteTracks((prev) =>
                                    prev.filter((x) => x.entityId !== item.entityId)
                                )
                            }
                        />
                    ))
                ) : (
                    <Text style={styles.emptyText}>Aucun morceau favori</Text>
                )}
                {favoriteTracks.length < 3 ? (
                    <TouchableOpacity style={styles.selectBtn} onPress={() => openPicker("favoriteTracks")}>
                        <Text style={styles.selectBtnText}>Ajouter un morceau</Text>
                    </TouchableOpacity>
                ) : null}

                {/* BOUTON ENREGISTRER */}
                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    disabled={loading}
                    onPress={handleSaveProfile}
                >
                    <Text style={styles.buttonText}>
                        {loading ? "Enregistrement..." : "Enregistrer mon profil"}
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 40,
        backgroundColor: "#000",
    },

    skipButton: {
        alignSelf: "flex-end",
        marginBottom: 10,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    skipText: {
        color: "#999",
        fontSize: 14,
        fontWeight: "600",
    },

    header: {
        alignItems: "center",
        marginBottom: 30,
    },
    subtitle: {
        marginTop: 10,
        fontSize: 15,
        color: "#aaa",
        textAlign: "center",
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
    avatarRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
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
    avatarPlaceholderText: { color: "#777", fontSize: 11, textAlign: "center" },
    avatarHint: { color: "#777", flex: 1, fontSize: 12 },
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
    bioCount: { color: "#666", fontSize: 12, textAlign: "right", marginTop: 4 },
    emptyText: {
        color: "#777",
        fontSize: 13,
        marginTop: 4,
        marginBottom: 8,
    },
    selectBtn: {
        borderWidth: 1,
        borderColor: "#5E17EB",
        backgroundColor: "rgba(94, 23, 235, 0.14)",
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        alignItems: "center",
        marginTop: 8,
    },
    selectBtnText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "800",
    },
    musicChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: "#141414",
        borderWidth: 1,
        borderColor: "#333",
        borderRadius: 14,
        padding: 10,
        marginBottom: 8,
    },
    musicChipCover: {
        width: 46,
        height: 46,
        borderRadius: 10,
        backgroundColor: "#222",
    },
    musicChipTitle: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "800",
    },
    musicChipArtist: {
        color: "#888",
        fontSize: 12,
        marginTop: 3,
    },
    musicChipRemove: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: "#202020",
        alignItems: "center",
        justifyContent: "center",
    },
    musicChipRemoveText: {
        color: "#aaa",
        fontSize: 13,
        fontWeight: "900",
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
