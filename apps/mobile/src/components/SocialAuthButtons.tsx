import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { API_URL, GOOGLE_ANDROID_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from "../lib/config";
import { setStoredToken } from "../lib/authStorage";
import { colors, fontWeights, radius, spacing, typography } from "../theme";

WebBrowser.maybeCompleteAuthSession();

type SocialProvider = "apple" | "google";

type Props = {
    mode: "login" | "register";
    onSuccess: (user: any) => void;
    onError: (message: string) => void;
};

async function safeJson(res: Response): Promise<any | null> {
    const text = await res.text();
    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch {
        if (__DEV__) console.log("Social auth non-JSON response:", text.slice(0, 200));
        return null;
    }
}

function currentGoogleClientId() {
    if (Platform.OS === "ios") return GOOGLE_IOS_CLIENT_ID;
    if (Platform.OS === "android") return GOOGLE_ANDROID_CLIENT_ID;
    return GOOGLE_WEB_CLIENT_ID;
}

export default function SocialAuthButtons({ mode, onSuccess, onError }: Props) {
    const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null);
    const [appleAvailable, setAppleAvailable] = useState(false);
    const googleClientId = currentGoogleClientId();

    const googleConfig = useMemo(
        () => ({
            iosClientId: GOOGLE_IOS_CLIENT_ID || "missing-google-ios-client-id",
            androidClientId: GOOGLE_ANDROID_CLIENT_ID || "missing-google-android-client-id",
            webClientId: GOOGLE_WEB_CLIENT_ID || "missing-google-web-client-id",
            scopes: ["openid", "profile", "email"],
            selectAccount: true,
        }),
        []
    );

    const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest(googleConfig);

    useEffect(() => {
        AppleAuthentication.isAvailableAsync()
            .then(setAppleAvailable)
            .catch(() => setAppleAvailable(false));
    }, []);

    async function exchange(provider: SocialProvider, payload: Record<string, unknown>) {
        const res = await fetch(`${API_URL}/api/auth/oauth/${provider}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const data = await safeJson(res);
        if (!res.ok || !data?.token || !data?.user?._id) {
            throw new Error(data?.error || "Connexion impossible pour le moment.");
        }

        await setStoredToken(data.token);
        await AsyncStorage.setItem("user", JSON.stringify(data.user));
        onSuccess(data.user);
    }

    async function handleApple() {
        if (!appleAvailable) {
            onError("Connexion Apple indisponible sur cet appareil.");
            return;
        }

        setLoadingProvider("apple");
        onError("");

        try {
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });

            if (!credential.identityToken) {
                throw new Error("Apple n'a pas renvoyé de token.");
            }

            await exchange("apple", {
                identityToken: credential.identityToken,
                email: credential.email,
                fullName: credential.fullName,
                appleUser: credential.user,
            });
        } catch (err: any) {
            if (err?.code !== "ERR_REQUEST_CANCELED") {
                onError(err?.message || "Connexion Apple impossible.");
            }
        } finally {
            setLoadingProvider(null);
        }
    }

    async function handleGoogle() {
        if (!googleClientId) {
            onError("Connexion Google pas encore configurée.");
            return;
        }

        setLoadingProvider("google");
        onError("");

        try {
            await promptGoogleAsync();
        } catch (err: any) {
            onError(err?.message || "Connexion Google impossible.");
            setLoadingProvider(null);
        }
    }

    useEffect(() => {
        if (!googleResponse) return;

        if (googleResponse.type !== "success") {
            setLoadingProvider(null);
            if (googleResponse.type === "error") {
                onError("Connexion Google interrompue.");
            }
            return;
        }

        const idToken =
            googleResponse.params?.id_token ||
            (googleResponse.authentication as any)?.idToken ||
            "";

        if (!idToken) {
            setLoadingProvider(null);
            onError("Google n'a pas renvoyé de jeton d'identité.");
            return;
        }

        exchange("google", { idToken })
            .catch((err) => onError(err?.message || "Connexion Google impossible."))
            .finally(() => setLoadingProvider(null));
    }, [googleResponse]);

    const title = mode === "register" ? "Créer avec" : "Continuer avec";

    return (
        <View style={styles.socialSection}>
            <Text style={styles.sectionEyebrow}>ACCÈS RAPIDE</Text>

            <TouchableOpacity
                style={[styles.socialButton, !appleAvailable && styles.socialButtonDisabled]}
                activeOpacity={0.88}
                onPress={handleApple}
                disabled={loadingProvider !== null || !appleAvailable}
            >
                <View style={styles.socialIcon}>
                    {loadingProvider === "apple" ? (
                        <ActivityIndicator size="small" color={colors.text} />
                    ) : (
                        <Ionicons name="logo-apple" size={20} color={colors.text} />
                    )}
                </View>
                <Text style={styles.socialText}>{title} Apple</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.socialButton, (!googleClientId || !googleRequest) && styles.socialButtonDisabled]}
                activeOpacity={0.88}
                onPress={handleGoogle}
                disabled={loadingProvider !== null || !googleRequest}
            >
                <View style={styles.socialIcon}>
                    {loadingProvider === "google" ? (
                        <ActivityIndicator size="small" color={colors.text} />
                    ) : (
                        <Ionicons name="logo-google" size={19} color={colors.text} />
                    )}
                </View>
                <Text style={styles.socialText}>{title} Google</Text>
            </TouchableOpacity>

            <Text style={styles.legalHint}>
                En continuant, tu acceptes les conditions TrueBPM.
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    socialSection: {
        width: "100%",
        gap: spacing.sm,
    },
    sectionEyebrow: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        letterSpacing: 3,
        marginBottom: spacing.xs,
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
    socialButtonDisabled: {
        opacity: 0.55,
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
    legalHint: {
        color: colors.textTertiary,
        fontSize: typography.caption,
        lineHeight: 18,
        fontWeight: fontWeights.medium,
        marginTop: spacing.xs,
    },
});
