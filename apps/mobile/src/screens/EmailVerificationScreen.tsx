import React, { useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Logo from "../components/Logo";
import { API_URL } from "../lib/config";
import { getStoredToken, setStoredUser } from "../lib/authStorage";
import { colors, fontWeights, radius, spacing, typography } from "../theme";

type NextRoute = "Login" | "ProfileSetup" | "Main";

async function safeJson(res: Response): Promise<any | null> {
    const text = await res.text();
    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch {
        if (__DEV__) console.log("Email verification non-JSON response:", text.slice(0, 200));
        return null;
    }
}

function emailLabel(email?: string) {
    const clean = email?.trim();
    return clean || "ton adresse email";
}

function formatCode(value: string) {
    return value.replace(/\D/g, "").slice(0, 6);
}

export default function EmailVerificationScreen({ route, navigation }: any) {
    const insets = useSafeAreaInsets();
    const codeInputRef = useRef<TextInput>(null);
    const email = String(route?.params?.email || "").trim().toLowerCase();
    const nextRoute = (route?.params?.nextRoute || "Main") as NextRoute;
    const hasSession = route?.params?.hasSession !== false;

    const [code, setCode] = useState("");
    const [loading, setLoading] = useState<"verify" | "resend" | "check" | null>(null);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const helpText = useMemo(() => {
        if (hasSession) {
            return "Le code expire dans 15 minutes.";
        }
        return "Valide le code, puis reconnecte-toi.";
    }, [hasSession]);

    const goNext = async () => {
        if (nextRoute === "Login" || !hasSession) {
            navigation.replace("Login");
            return;
        }

        navigation.replace(nextRoute);
    };

    const checkVerificationStatus = async () => {
        setError("");
        setMessage("");
        setLoading("check");

        try {
            const storedToken = await getStoredToken();
            if (!storedToken) {
                setLoading(null);
                navigation.replace("Login");
                return;
            }

            const res = await fetch(`${API_URL}/api/user/me?t=${Date.now()}`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${storedToken}`,
                    "Cache-Control": "no-cache",
                },
            });
            const data = await safeJson(res);

            if (!res.ok || !data?.user?._id) {
                setLoading(null);
                setError(data?.error || "Impossible de vérifier ton compte pour le moment.");
                return;
            }

            await setStoredUser(data.user);
            setLoading(null);

            if (!data.user.emailVerifiedAt) {
                setError("Ton email n'est pas encore vérifié.");
                return;
            }

            await goNext();
        } catch {
            setLoading(null);
            setError("Impossible de joindre le serveur.");
        }
    };

    const resendEmail = async () => {
        if (!email) {
            setError("Retourne à la connexion pour renseigner ton email.");
            return;
        }

        setError("");
        setMessage("");
        setLoading("resend");

        try {
            const res = await fetch(`${API_URL}/api/auth/email/resend`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            await safeJson(res);
            setLoading(null);
            setMessage("Si le compte existe, un nouvel email vient d'être envoyé.");
        } catch {
            setLoading(null);
            setError("Impossible d'envoyer un nouvel email.");
        }
    };

    const verifyWithCode = async () => {
        const cleanCode = formatCode(code);
        if (!email) {
            setError("Retourne à la connexion pour renseigner ton email.");
            return;
        }

        if (cleanCode.length !== 6) {
            setError("Entre le code à 6 chiffres.");
            return;
        }

        setError("");
        setMessage("");
        setLoading("verify");

        try {
            const res = await fetch(`${API_URL}/api/auth/email/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code: cleanCode }),
            });
            const data = await safeJson(res);

            if (!res.ok) {
                setLoading(null);
                setError(data?.error || "Code de vérification invalide.");
                return;
            }

            setCode("");
            setLoading(null);
            setMessage("Email vérifié.");

            if (data?.user?._id) {
                await setStoredUser(data.user);
            }

            if (hasSession) {
                await goNext();
                return;
            }

            navigation.replace("Login");
        } catch {
            setLoading(null);
            setError("Impossible de valider ce code.");
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.content,
                    {
                        paddingTop: insets.top + 76,
                        paddingBottom: Math.max(insets.bottom, 16) + 28,
                    },
                ]}
            >
                <LinearGradient
                    pointerEvents="none"
                    colors={["rgba(155, 92, 255, 0.24)", "rgba(94, 23, 235, 0.06)", "rgba(6, 7, 8, 0)"]}
                    style={styles.ambientGlow}
                />
                <TouchableOpacity
                    style={[styles.backButton, { top: insets.top + 12 }]}
                    activeOpacity={0.85}
                    onPress={() => navigation.replace("Login")}
                >
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>

                <View style={styles.brandBlock}>
                    <Logo size={50} />
                    <Text style={styles.brandCaption}>Un dernier check avant d'entrer.</Text>
                </View>

                <View style={styles.ticket}>
                    <View style={styles.ticketHeader}>
                        <View>
                            <Text style={styles.eyebrow}>VÉRIFICATION</Text>
                            <Text style={styles.title}>Entre ton code</Text>
                        </View>

                        <View style={styles.mailBadge}>
                            <Ionicons name="mail-unread-outline" size={21} color={colors.primary} />
                        </View>
                    </View>

                    <Text style={styles.subtitle}>
                        Envoyé à <Text style={styles.emailText}>{emailLabel(email)}</Text>
                    </Text>

                    <TouchableOpacity
                        style={styles.codeRail}
                        activeOpacity={0.9}
                        onPress={() => codeInputRef.current?.focus()}
                    >
                        {Array.from({ length: 6 }).map((_, index) => {
                            const value = code[index] || "";
                            const active = index === code.length && code.length < 6;

                            return (
                                <View
                                    key={index}
                                    style={[
                                        styles.codeCell,
                                        value && styles.codeCellFilled,
                                        active && styles.codeCellActive,
                                    ]}
                                >
                                    <Text style={styles.codeDigit}>{value}</Text>
                                </View>
                            );
                        })}

                        <TextInput
                            ref={codeInputRef}
                            value={code}
                            onChangeText={(value) => setCode(formatCode(value))}
                            keyboardType="number-pad"
                            textContentType="oneTimeCode"
                            autoComplete="one-time-code"
                            autoCorrect={false}
                            maxLength={6}
                            caretHidden
                            style={styles.hiddenCodeInput}
                        />
                    </TouchableOpacity>

                    <View style={styles.metaRow}>
                        <View style={styles.eqMark}>
                            <View style={[styles.eqBar, { height: 12 }]} />
                            <View style={[styles.eqBar, { height: 20 }]} />
                            <View style={[styles.eqBar, { height: 15 }]} />
                        </View>
                        <Text style={styles.helper}>{helpText}</Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.primaryButton, code.length !== 6 && styles.disabledButton]}
                        activeOpacity={0.88}
                        disabled={code.length !== 6 || loading !== null}
                        onPress={verifyWithCode}
                    >
                        {loading === "verify" ? (
                            <ActivityIndicator color={colors.text} />
                        ) : (
                            <Text style={styles.primaryButtonText}>Valider le code</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.inlineActions}>
                        <TouchableOpacity
                            style={styles.textAction}
                            activeOpacity={0.85}
                            disabled={loading !== null}
                            onPress={resendEmail}
                        >
                            {loading === "resend" ? (
                                <ActivityIndicator color={colors.primary} />
                            ) : (
                                <Text style={styles.textActionLabel}>Renvoyer le code</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.actionDot} />

                        <TouchableOpacity
                            style={styles.textAction}
                            activeOpacity={0.85}
                            disabled={loading !== null}
                            onPress={checkVerificationStatus}
                        >
                            {loading === "check" ? (
                                <ActivityIndicator color={colors.primary} />
                            ) : (
                                <Text style={styles.textActionLabel}>Déjà validé</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {message ? (
                    <View style={[styles.feedbackPill, styles.successPill]}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={styles.successText}>{message}</Text>
                    </View>
                ) : null}
                {error ? (
                    <View style={[styles.feedbackPill, styles.errorPill]}>
                        <Ionicons name="alert-circle" size={16} color={colors.danger} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    content: {
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: spacing.xxl,
    },
    ambientGlow: {
        position: "absolute",
        top: -120,
        alignSelf: "center",
        width: 360,
        height: 360,
        borderRadius: 180,
    },
    backButton: {
        position: "absolute",
        left: spacing.xxl,
        width: 44,
        height: 44,
        borderRadius: 16,
        backgroundColor: colors.surfaceRaised,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },
    brandBlock: {
        alignItems: "center",
        marginBottom: spacing.xxl,
    },
    brandCaption: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.extraBold,
        marginTop: spacing.sm,
    },
    ticket: {
        width: "100%",
        maxWidth: 430,
        alignSelf: "center",
        padding: spacing.xl,
        borderRadius: 26,
        backgroundColor: colors.surfaceFeed,
        borderWidth: 1,
        borderColor: colors.borderStrong,
    },
    ticketHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: spacing.lg,
    },
    eyebrow: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        letterSpacing: 3,
        marginBottom: spacing.xs,
    },
    title: {
        color: colors.text,
        fontSize: 30,
        fontWeight: fontWeights.black,
        letterSpacing: 0,
    },
    mailBadge: {
        width: 48,
        height: 48,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primarySoft,
        borderWidth: 1,
        borderColor: colors.borderAccent,
    },
    subtitle: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        lineHeight: 20,
        marginTop: spacing.lg,
        fontWeight: fontWeights.extraBold,
    },
    emailText: {
        color: colors.text,
        fontWeight: fontWeights.black,
    },
    helper: {
        color: colors.textTertiary,
        fontSize: typography.bodySm,
        lineHeight: 19,
        flex: 1,
        fontWeight: fontWeights.extraBold,
    },
    codeRail: {
        position: "relative",
        flexDirection: "row",
        gap: spacing.sm,
        marginTop: spacing.xl,
        padding: spacing.md,
        borderRadius: 22,
        backgroundColor: colors.surfaceInset,
        borderWidth: 1,
        borderColor: colors.border,
    },
    codeCell: {
        flex: 1,
        aspectRatio: 0.78,
        minHeight: 58,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surfaceRaised,
        borderWidth: 1,
        borderColor: colors.border,
    },
    codeCellFilled: {
        borderColor: colors.borderAccent,
        backgroundColor: colors.surfacePressed,
    },
    codeCellActive: {
        borderColor: colors.primary,
    },
    codeDigit: {
        color: colors.text,
        fontSize: 26,
        fontWeight: fontWeights.black,
        fontVariant: ["tabular-nums"],
    },
    hiddenCodeInput: {
        position: "absolute",
        inset: 0,
        opacity: 0,
    },
    primaryButton: {
        minHeight: 56,
        borderRadius: 18,
        backgroundColor: colors.controlActive,
        alignItems: "center",
        justifyContent: "center",
        marginTop: spacing.xl,
    },
    disabledButton: {
        opacity: 0.48,
    },
    primaryButtonText: {
        color: colors.text,
        fontSize: typography.subtitle,
        fontWeight: fontWeights.black,
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        marginTop: spacing.lg,
    },
    eqMark: {
        width: 34,
        height: 28,
        borderRadius: 12,
        backgroundColor: colors.primarySoft,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 3,
    },
    eqBar: {
        width: 4,
        borderRadius: 3,
        backgroundColor: colors.primary,
    },
    inlineActions: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.md,
        marginTop: spacing.lg,
    },
    textAction: {
        minHeight: 34,
        justifyContent: "center",
    },
    textActionLabel: {
        color: colors.primary,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.black,
    },
    actionDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.borderStrong,
    },
    feedbackPill: {
        width: "100%",
        maxWidth: 430,
        alignSelf: "center",
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: radius.lg,
        marginTop: spacing.lg,
        borderWidth: 1,
    },
    successPill: {
        backgroundColor: "rgba(34, 197, 94, 0.08)",
        borderColor: "rgba(34, 197, 94, 0.18)",
    },
    errorPill: {
        backgroundColor: colors.dangerSoft,
        borderColor: "rgba(255, 77, 109, 0.22)",
    },
    successText: {
        color: colors.success,
        flex: 1,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.extraBold,
    },
    errorText: {
        color: colors.danger,
        flex: 1,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.extraBold,
    },
});
