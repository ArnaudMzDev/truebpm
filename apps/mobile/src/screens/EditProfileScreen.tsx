import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Logo from "../components/Logo";
import { DefaultAvatar, DefaultBanner } from "../components/ProfileFallbacks";
import ProfileImageCropper from "../components/ProfileImageCropper";
import AppScreenLoader from "../components/ui/AppScreenLoader";
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
    | "favoriteTracks"
    | "listenLater"
    | "alreadyListened";

type User = {
    _id: string;
    pseudo: string;
    email: string;
    bio?: string;
    avatarUrl?: string;
    bannerUrl?: string;
    pinnedTrack?: MusicRef | null;
    favoriteArtists?: MusicRef[];
    favoriteAlbums?: MusicRef[];
    favoriteTracks?: MusicRef[];
};

type ArtistReleaseItem = {
    _id: string;
    artistName: string;
    itemId: string;
    itemType: "song" | "album";
    title: string;
    coverUrl: string;
    previewUrl: string;
    releaseDate: string;
    listenedAt: string | null;
};

type CropRequest = {
    type: "avatar" | "banner";
    uri: string;
    width?: number | null;
    height?: number | null;
};

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

function musicEquals(a?: MusicRef | null, b?: MusicRef | null) {
    return JSON.stringify(a || null) === JSON.stringify(b || null);
}

function musicArrayEquals(a?: MusicRef[], b?: MusicRef[]) {
    return JSON.stringify(a || []) === JSON.stringify(b || []);
}

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
                <Text style={styles.musicChipRemoveText}>✕</Text>
            </TouchableOpacity>
        </View>
    );
}

function ReleaseChip({
                         item,
                         onRemove,
                         disabled,
                     }: {
    item: ArtistReleaseItem;
    onRemove: () => void;
    disabled?: boolean;
}) {
    return (
        <View style={styles.musicChip}>
            {item.coverUrl ? (
                <Image source={{ uri: item.coverUrl }} style={styles.musicChipCover} />
            ) : (
                <View style={styles.musicChipCoverFallback}>
                    <Text style={styles.musicChipCoverFallbackText}>
                        {item.itemType === "album" ? "AL" : "S"}
                    </Text>
                </View>
            )}

            <View style={{ flex: 1 }}>
                <Text style={styles.musicChipTitle} numberOfLines={1}>
                    {item.title}
                </Text>
                <Text style={styles.musicChipArtist} numberOfLines={1}>
                    {item.artistName}
                </Text>
            </View>

            <TouchableOpacity
                onPress={onRemove}
                disabled={disabled}
                style={[styles.musicChipRemove, disabled && styles.musicChipRemoveDisabled]}
            >
                <Text style={styles.musicChipRemoveText}>✕</Text>
            </TouchableOpacity>
        </View>
    );
}

export default function EditProfileScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const [user, setUser] = useState<User | null>(null);

    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [bannerUri, setBannerUri] = useState<string | null>(null);
    const [cropRequest, setCropRequest] = useState<CropRequest | null>(null);
    const [bio, setBio] = useState("");
    const [loading, setLoading] = useState(false);

    const [initialAvatar, setInitialAvatar] = useState("");
    const [initialBanner, setInitialBanner] = useState("");
    const [initialBio, setInitialBio] = useState("");

    const [pinnedTrack, setPinnedTrack] = useState<MusicRef | null>(null);
    const [favoriteArtists, setFavoriteArtists] = useState<MusicRef[]>([]);
    const [favoriteAlbums, setFavoriteAlbums] = useState<MusicRef[]>([]);
    const [favoriteTracks, setFavoriteTracks] = useState<MusicRef[]>([]);
    const [listenLater, setListenLater] = useState<ArtistReleaseItem[]>([]);
    const [alreadyListened, setAlreadyListened] = useState<ArtistReleaseItem[]>([]);
    const [releaseActionLoading, setReleaseActionLoading] = useState(false);

    const [initialPinnedTrack, setInitialPinnedTrack] = useState<MusicRef | null>(null);
    const [initialFavoriteArtists, setInitialFavoriteArtists] = useState<MusicRef[]>([]);
    const [initialFavoriteAlbums, setInitialFavoriteAlbums] = useState<MusicRef[]>([]);
    const [initialFavoriteTracks, setInitialFavoriteTracks] = useState<MusicRef[]>([]);

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

        if (kind === "favoriteTracks") {
            setFavoriteTracks((prev) => {
                const next = [item, ...prev.filter((x) => x.entityId !== item.entityId)];
                return next.slice(0, 3);
            });
        }
    }, []);

    const fetchReleaseLists = useCallback(async () => {
        try {
            const token = await getStoredToken();
            if (!token) return;

            const res = await fetch(`${API_URL}/api/artist-releases/me?limit=100`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await safeJson(res);

            if (!res.ok) {
                console.log("EditProfile artist releases error:", data);
                return;
            }

            setListenLater(Array.isArray(data?.toListen) ? data.toListen : []);
            setAlreadyListened(Array.isArray(data?.listened) ? data.listened : []);
        } catch (err) {
            console.log("EditProfile artist releases fetch error:", err);
        }
    }, []);

    const addReleaseFromPick = useCallback(
        async (kind: PickKind, item: MusicRef) => {
            if (kind !== "listenLater" && kind !== "alreadyListened") return;
            if (item.entityType !== "song" && item.entityType !== "album") return;

            try {
                setReleaseActionLoading(true);
                const token = await getStoredToken();
                if (!token) {
                    Alert.alert("Erreur", "Tu n'es pas connecté.");
                    return;
                }

                const res = await fetch(`${API_URL}/api/artist-releases/me`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        listened: kind === "alreadyListened",
                        item,
                    }),
                });
                const data = await safeJson(res);

                if (!res.ok) {
                    console.log("EditProfile add release error:", data);
                    Alert.alert("Erreur", data?.error || "Impossible d'ajouter ce son.");
                    return;
                }

                await fetchReleaseLists();
            } catch (err) {
                console.log("EditProfile add release error:", err);
                Alert.alert("Erreur", "Impossible d'ajouter ce son.");
            } finally {
                setReleaseActionLoading(false);
            }
        },
        [fetchReleaseLists]
    );

    const removeRelease = useCallback(
        async (releaseId: string) => {
            if (releaseActionLoading) return;

            try {
                setReleaseActionLoading(true);
                const token = await getStoredToken();
                if (!token) {
                    Alert.alert("Erreur", "Tu n'es pas connecté.");
                    return;
                }

                const res = await fetch(`${API_URL}/api/artist-releases/me`, {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ releaseId }),
                });
                const data = await safeJson(res);

                if (!res.ok) {
                    console.log("EditProfile remove release error:", data);
                    Alert.alert("Erreur", data?.error || "Impossible de retirer ce son.");
                    return;
                }

                setListenLater((prev) => prev.filter((item) => item._id !== releaseId));
                setAlreadyListened((prev) => prev.filter((item) => item._id !== releaseId));
            } catch (err) {
                console.log("EditProfile remove release error:", err);
                Alert.alert("Erreur", "Impossible de retirer ce son.");
            } finally {
                setReleaseActionLoading(false);
            }
        },
        [releaseActionLoading]
    );

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

                setAvatarUri(a || null);
                setBannerUri(b || null);
                setBio(bi);

                const pt = u.pinnedTrack || null;
                const fa = Array.isArray(u.favoriteArtists) ? u.favoriteArtists : [];
                const fal = Array.isArray(u.favoriteAlbums) ? u.favoriteAlbums : [];
                const ft = Array.isArray(u.favoriteTracks) ? u.favoriteTracks : [];

                setPinnedTrack(pt);
                setFavoriteArtists(fa);
                setFavoriteAlbums(fal);
                setFavoriteTracks(ft);

                setInitialPinnedTrack(pt);
                setInitialFavoriteArtists(fa);
                setInitialFavoriteAlbums(fal);
                setInitialFavoriteTracks(ft);
            } catch (e) {
                console.log("EditProfile loadUser parse error:", e);
            }
        };

        loadUser();
    }, []);

    useEffect(() => {
        fetchReleaseLists().catch(() => {});
    }, [fetchReleaseLists]);

    useFocusEffect(
        useCallback(() => {
            let active = true;

            (async () => {
                try {
                    const raw = await AsyncStorage.getItem(PROFILE_MUSIC_PICK_KEY);
                    if (!raw || !active) return;

                    const parsed = JSON.parse(raw);
                    if (parsed?.kind && parsed?.item) {
                        if (parsed.kind === "listenLater" || parsed.kind === "alreadyListened") {
                            await addReleaseFromPick(parsed.kind, parsed.item);
                        } else {
                            applyPickedMusic(parsed.kind, parsed.item);
                        }
                    }

                    await AsyncStorage.removeItem(PROFILE_MUSIC_PICK_KEY);
                } catch (e) {
                    console.log("EditProfile pending music pick error:", e);
                }
            })();

            return () => {
                active = false;
            };
        }, [addReleaseFromPick, applyPickedMusic])
    );

    const pickImage = async (type: "avatar" | "banner") => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Permission refusée", "L'application a besoin d'accéder à ta galerie.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: type === "avatar" ? 0.82 : 0.9,
            selectionLimit: 1,
        });

        if (!result.canceled && result.assets?.length > 0) {
            const asset = result.assets[0];
            setCropRequest({
                type,
                uri: asset.uri,
                width: asset.width,
                height: asset.height,
            });
        }
    };

    const handleCroppedImage = (uri: string) => {
        if (cropRequest?.type === "avatar") setAvatarUri(uri);
        if (cropRequest?.type === "banner") setBannerUri(uri);
        setCropRequest(null);
    };

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

    const pinnedChanged = useMemo(
        () => !musicEquals(pinnedTrack, initialPinnedTrack),
        [pinnedTrack, initialPinnedTrack]
    );

    const favoriteArtistsChanged = useMemo(
        () => !musicArrayEquals(favoriteArtists, initialFavoriteArtists),
        [favoriteArtists, initialFavoriteArtists]
    );

    const favoriteAlbumsChanged = useMemo(
        () => !musicArrayEquals(favoriteAlbums, initialFavoriteAlbums),
        [favoriteAlbums, initialFavoriteAlbums]
    );

    const favoriteTracksChanged = useMemo(
        () => !musicArrayEquals(favoriteTracks, initialFavoriteTracks),
        [favoriteTracks, initialFavoriteTracks]
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

    const handleSave = async () => {
        try {
            setLoading(true);

            const token = await getStoredToken();
            if (!token) {
                setLoading(false);
                return Alert.alert("Erreur", "Tu n'es pas connecté.");
            }

            const payload: any = {};

            if (bioChanged) payload.bio = bio.trim();

            if (avatarChanged) {
                if (avatarUri === null) {
                    payload.avatarUrl = null;
                } else if (avatarUri.startsWith("file")) {
                    const url = await uploadToCloudinary(avatarUri, "truebpm/profile/avatar");
                    payload.avatarUrl = url;
                } else {
                    payload.avatarUrl = avatarUri.trim();
                }
            }

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

            if (pinnedChanged) payload.pinnedTrack = pinnedTrack;
            if (favoriteArtistsChanged) payload.favoriteArtists = favoriteArtists;
            if (favoriteAlbumsChanged) payload.favoriteAlbums = favoriteAlbums;
            if (favoriteTracksChanged) payload.favoriteTracks = favoriteTracks;

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

            setAvatarUri(a || null);
            setBannerUri(b || null);
            setBio(bi);

            const pt = next.pinnedTrack || null;
            const fa = Array.isArray(next.favoriteArtists) ? next.favoriteArtists : [];
            const fal = Array.isArray(next.favoriteAlbums) ? next.favoriteAlbums : [];
            const ft = Array.isArray(next.favoriteTracks) ? next.favoriteTracks : [];

            setPinnedTrack(pt);
            setFavoriteArtists(fa);
            setFavoriteAlbums(fal);
            setFavoriteTracks(ft);

            setInitialPinnedTrack(pt);
            setInitialFavoriteArtists(fa);
            setInitialFavoriteAlbums(fal);
            setInitialFavoriteTracks(ft);

            setLoading(false);
            Alert.alert("Succès", "Ton profil a été mis à jour.");
            navigation.navigate("Main", { screen: "ProfileTab" });
        } catch (err) {
            console.log("Profile update error:", err);
            setLoading(false);
            Alert.alert("Erreur", "Impossible de modifier ton profil.");
        }
    };

    if (!user) {
        return <AppScreenLoader label="Chargement du profil..." />;
    }

    return (
        <>
            <KeyboardAvoidingView
                style={{ flex: 1, backgroundColor: "#000" }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScrollView
                    contentContainerStyle={[
                        styles.container,
                        {
                            paddingTop: insets.top + 10,
                            paddingBottom: Math.max(insets.bottom, 12) + 32,
                        },
                    ]}
                    keyboardShouldPersistTaps="handled"
                >
                <View style={styles.header}>
                    <Logo size={22} />
                    <Text style={styles.title}>Modifier mon profil</Text>
                </View>

                <Text style={styles.sectionTitle}>Aperçu du profil</Text>
                <View style={styles.profilePreview}>
                    <TouchableOpacity
                        style={styles.previewBannerWrap}
                        onPress={() => pickImage("banner")}
                        activeOpacity={0.86}
                    >
                        {bannerUri ? (
                            <Image
                                source={{ uri: bannerUri }}
                                style={styles.previewBannerImage}
                                resizeMode="cover"
                            />
                        ) : (
                            <DefaultBanner style={styles.previewBannerImage} />
                        )}
                        <View style={styles.previewBannerOverlay} />
                        <View style={styles.previewBannerAction}>
                            <Text style={styles.previewActionText}>Changer la bannière</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.previewAvatarWrap}
                        onPress={() => pickImage("avatar")}
                        activeOpacity={0.86}
                    >
                        {avatarUri ? (
                            <Image
                                source={{ uri: avatarUri }}
                                style={styles.previewAvatarImage}
                                resizeMode="cover"
                            />
                        ) : (
                            <DefaultAvatar label={user?.pseudo} seed={user?._id} size={104} style={styles.previewAvatarImage} />
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.previewAvatarAction}
                        onPress={() => pickImage("avatar")}
                        activeOpacity={0.86}
                    >
                        <Text style={styles.previewActionText}>Changer la photo</Text>
                    </TouchableOpacity>
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

                <View style={styles.releaseSectionHeader}>
                    <Text style={styles.sectionTitle}>Sons à écouter</Text>
                    <Text style={styles.releaseCounter}>{listenLater.length}/100</Text>
                </View>
                {listenLater.length > 0 ? (
                    listenLater.slice(0, 5).map((item) => (
                        <ReleaseChip
                            key={item._id}
                            item={item}
                            disabled={releaseActionLoading}
                            onRemove={() => removeRelease(item._id)}
                        />
                    ))
                ) : (
                    <Text style={styles.emptyText}>Ajoute les sons que tu veux garder sous la main.</Text>
                )}
                {listenLater.length > 5 ? (
                    <TouchableOpacity
                        style={styles.inlineListBtn}
                        onPress={() => navigation.navigate("ArtistReleases", { initialTab: "toListen" })}
                        activeOpacity={0.86}
                    >
                        <Text style={styles.inlineListText}>Voir les {listenLater.length} sons</Text>
                    </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                    style={[
                        styles.selectBtn,
                        (listenLater.length >= 100 || releaseActionLoading) && styles.selectBtnDisabled,
                    ]}
                    disabled={listenLater.length >= 100 || releaseActionLoading}
                    onPress={() => openPicker("listenLater")}
                >
                    <Text style={styles.selectBtnText}>Ajouter via recherche</Text>
                </TouchableOpacity>

                <View style={styles.releaseSectionHeader}>
                    <Text style={styles.sectionTitle}>Déjà écoutés</Text>
                    <Text style={styles.releaseCounter}>{alreadyListened.length}/100</Text>
                </View>
                {alreadyListened.length > 0 ? (
                    alreadyListened.slice(0, 5).map((item) => (
                        <ReleaseChip
                            key={item._id}
                            item={item}
                            disabled={releaseActionLoading}
                            onRemove={() => removeRelease(item._id)}
                        />
                    ))
                ) : (
                    <Text style={styles.emptyText}>Garde une trace des sons déjà passés dans tes oreilles.</Text>
                )}
                {alreadyListened.length > 5 ? (
                    <TouchableOpacity
                        style={styles.inlineListBtn}
                        onPress={() => navigation.navigate("ArtistReleases", { initialTab: "listened" })}
                        activeOpacity={0.86}
                    >
                        <Text style={styles.inlineListText}>Voir les {alreadyListened.length} sons</Text>
                    </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                    style={[
                        styles.selectBtn,
                        (alreadyListened.length >= 100 || releaseActionLoading) && styles.selectBtnDisabled,
                    ]}
                    disabled={alreadyListened.length >= 100 || releaseActionLoading}
                    onPress={() => openPicker("alreadyListened")}
                >
                    <Text style={styles.selectBtnText}>Ajouter via recherche</Text>
                </TouchableOpacity>

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

            <ProfileImageCropper
                visible={!!cropRequest}
                mode={cropRequest?.type || "avatar"}
                source={cropRequest}
                onCancel={() => setCropRequest(null)}
                onCropped={handleCroppedImage}
            />
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 24,
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
    releaseSectionHeader: {
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
    },
    releaseCounter: {
        color: "#8E59FF",
        fontSize: 12,
        fontWeight: "900",
        marginBottom: 9,
        marginTop: 18,
    },
    profilePreview: {
        position: "relative",
        width: "100%",
        height: 258,
        marginTop: 4,
        marginBottom: 6,
    },
    previewBannerWrap: {
        width: "100%",
        aspectRatio: 16 / 9,
        borderRadius: 24,
        backgroundColor: "rgba(15, 18, 24, 0.76)",
        overflow: "hidden",
    },
    previewBannerImage: {
        width: "100%",
        height: "100%",
    },
    previewBannerOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.18)",
    },
    previewBannerAction: {
        position: "absolute",
        right: 12,
        top: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: "rgba(0,0,0,0.58)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.16)",
    },
    previewAvatarWrap: {
        position: "absolute",
        left: 18,
        bottom: 0,
        width: 112,
        height: 112,
        borderRadius: 56,
        padding: 4,
        backgroundColor: "#000",
        overflow: "hidden",
    },
    previewAvatarImage: {
        width: "100%",
        height: "100%",
        borderRadius: 52,
        borderWidth: 3,
        borderColor: "#1B202B",
        backgroundColor: "#141414",
    },
    previewAvatarAction: {
        position: "absolute",
        left: 142,
        bottom: 15,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: "rgba(94, 23, 235, 0.9)",
        borderWidth: 1,
        borderColor: "#2E2050",
    },
    previewActionText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "900",
    },
    bioInput: {
        marginTop: 4,
        minHeight: 90,
        borderRadius: 14,
        padding: 12,
        backgroundColor: "rgba(15, 18, 24, 0.76)",
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
    emptyText: {
        color: "#777",
        fontSize: 13,
        marginBottom: 6,
    },
    selectBtn: {
        backgroundColor: "rgba(15, 18, 24, 0.76)",
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: "center",
        marginTop: 8,
    },
    selectBtnDisabled: {
        opacity: 0.45,
    },
    selectBtnText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "700",
    },
    inlineListBtn: {
        alignSelf: "flex-start",
        marginTop: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: "rgba(94, 23, 235, 0.16)",
    },
    inlineListText: {
        color: "#A66BFF",
        fontSize: 12,
        fontWeight: "900",
    },
    musicChip: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(15, 18, 24, 0.76)",
        borderRadius: 12,
        padding: 10,
        marginTop: 8,
    },
    musicChipCover: {
        width: 42,
        height: 42,
        borderRadius: 8,
        marginRight: 10,
    },
    musicChipCoverFallback: {
        width: 42,
        height: 42,
        borderRadius: 8,
        marginRight: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(94, 23, 235, 0.2)",
    },
    musicChipCoverFallbackText: {
        color: "#A66BFF",
        fontSize: 11,
        fontWeight: "900",
    },
    musicChipTitle: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "700",
    },
    musicChipArtist: {
        color: "#888",
        fontSize: 12,
        marginTop: 2,
    },
    musicChipRemove: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1b1b1b",
        marginLeft: 10,
    },
    musicChipRemoveDisabled: {
        opacity: 0.45,
    },
    musicChipRemoveText: {
        color: "#fff",
        fontWeight: "800",
        fontSize: 12,
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
