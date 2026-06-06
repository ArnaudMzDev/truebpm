import React, { useMemo, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Logo from "../components/Logo";
import { colors, fontWeights, radius, spacing, typography } from "../theme";

const DISCOVERY_STORAGE_KEY = "truebpm_discovery_seen_v1";

const slides = [
    {
        eyebrow: "Publie",
        title: "Note un son, un album ou un artiste",
        body: "Appuie sur le bouton central, cherche une musique, choisis ta note et publie ton avis. Tu peux écrire beaucoup, un peu, ou rien du tout.",
        icon: "add-circle-outline",
        accent: "Créer un post",
    },
    {
        eyebrow: "Écoute",
        title: "Lance les previews directement",
        body: "Quand un post a un extrait, touche le bouton lecture. Le mini-player reste disponible pendant que tu continues à découvrir le feed.",
        icon: "play-circle-outline",
        accent: "Preview audio",
    },
    {
        eyebrow: "Réagis",
        title: "Like, commente et partage les avis",
        body: "Un bon avis mérite une réaction. Tu peux liker, commenter, partager, ou ouvrir le détail du post pour suivre la discussion.",
        icon: "heart-outline",
        accent: "Vie sociale",
    },
    {
        eyebrow: "Notes",
        title: "Partage ton mood musical du moment",
        body: "Sur l’accueil, les bulles de notes montrent ce que les autres écoutent. Ta bulle te permet d’ajouter ou modifier ta note du moment.",
        icon: "radio-outline",
        accent: "Bulles rapides",
    },
    {
        eyebrow: "Profil",
        title: "Construis ton univers musical",
        body: "Ajoute ton son épinglé, tes artistes favoris et suis les profils qui ont les mêmes goûts que toi. Ton feed devient plus vivant avec le temps.",
        icon: "person-circle-outline",
        accent: "Ton identité",
    },
] as const;

export default function AppDiscoveryScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const [index, setIndex] = useState(0);
    const slide = slides[index];
    const isLast = index === slides.length - 1;

    const progress = useMemo(() => `${index + 1}/${slides.length}`, [index]);

    const finish = async () => {
        await AsyncStorage.setItem(DISCOVERY_STORAGE_KEY, "1");
        navigation.replace("Main");
    };

    const next = () => {
        if (isLast) {
            finish().catch(() => navigation.replace("Main"));
            return;
        }

        setIndex((value) => Math.min(value + 1, slides.length - 1));
    };

    const previous = () => {
        setIndex((value) => Math.max(value - 1, 0));
    };

    return (
        <View style={styles.screen}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.content,
                    {
                        paddingTop: insets.top + spacing.lg,
                        paddingBottom: Math.max(insets.bottom, 12) + spacing.xl,
                    },
                ]}
            >
                <View style={styles.topBar}>
                    <Logo size={42} />
                    <TouchableOpacity activeOpacity={0.85} onPress={finish}>
                        <Text style={styles.skipText}>Passer</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.hero}>
                    <View style={styles.orbit}>
                        <View style={styles.iconDisc}>
                            <Ionicons name={slide.icon as any} size={48} color={colors.text} />
                        </View>
                    </View>

                    <View style={styles.progressRow}>
                        {slides.map((item, itemIndex) => (
                            <View
                                key={item.eyebrow}
                                style={[
                                    styles.progressDot,
                                    itemIndex === index && styles.progressDotActive,
                                ]}
                            />
                        ))}
                    </View>
                </View>

                <View style={styles.copyBlock}>
                    <View style={styles.eyebrowRow}>
                        <Text style={styles.eyebrow}>{slide.eyebrow}</Text>
                        <Text style={styles.progressText}>{progress}</Text>
                    </View>
                    <Text style={styles.title}>{slide.title}</Text>
                    <Text style={styles.body}>{slide.body}</Text>

                    <View style={styles.accentPill}>
                        <Ionicons name="sparkles-outline" size={15} color={colors.primary} />
                        <Text style={styles.accentText}>{slide.accent}</Text>
                    </View>
                </View>

                <View style={styles.controls}>
                    <TouchableOpacity
                        style={[styles.secondaryButton, index === 0 && styles.buttonHidden]}
                        activeOpacity={0.85}
                        onPress={previous}
                        disabled={index === 0}
                    >
                        <Ionicons name="chevron-back" size={18} color={colors.text} />
                        <Text style={styles.secondaryText}>Retour</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.primaryButton} activeOpacity={0.9} onPress={next}>
                        <Text style={styles.primaryText}>
                            {isLast ? "Entrer dans TrueBPM" : "Continuer"}
                        </Text>
                        <Ionicons name="chevron-forward" size={18} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    content: {
        flexGrow: 1,
        paddingHorizontal: spacing.lg,
    },
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    skipText: {
        color: colors.textMuted,
        fontSize: typography.caption,
        fontWeight: fontWeights.extraBold,
    },
    hero: {
        minHeight: 330,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.lg,
    },
    orbit: {
        width: 204,
        height: 204,
        borderRadius: 102,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(151, 89, 255, 0.08)",
        borderWidth: 1,
        borderColor: "rgba(151, 89, 255, 0.22)",
    },
    iconDisc: {
        width: 128,
        height: 128,
        borderRadius: 64,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primary,
    },
    progressRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
    },
    progressDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.surface4,
    },
    progressDotActive: {
        width: 26,
        backgroundColor: colors.primary,
    },
    copyBlock: {
        gap: spacing.md,
    },
    eyebrowRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    eyebrow: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: fontWeights.black,
        letterSpacing: 4,
        textTransform: "uppercase",
    },
    progressText: {
        color: colors.textFaint,
        fontSize: typography.caption,
        fontWeight: fontWeights.black,
        fontVariant: ["tabular-nums"],
    },
    title: {
        color: colors.text,
        fontSize: 34,
        lineHeight: 39,
        fontWeight: fontWeights.black,
    },
    body: {
        color: colors.textMuted,
        fontSize: 16,
        lineHeight: 24,
        fontWeight: fontWeights.bold,
    },
    accentPill: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        marginTop: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: 10,
        borderRadius: radius.pill,
        backgroundColor: "rgba(151, 89, 255, 0.12)",
    },
    accentText: {
        color: colors.text,
        fontSize: typography.caption,
        fontWeight: fontWeights.black,
    },
    controls: {
        marginTop: "auto",
        paddingTop: spacing.xxl,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
    },
    secondaryButton: {
        height: 52,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        backgroundColor: colors.surface3,
    },
    buttonHidden: {
        opacity: 0,
    },
    secondaryText: {
        color: colors.text,
        fontSize: typography.caption,
        fontWeight: fontWeights.black,
    },
    primaryButton: {
        flex: 1,
        height: 52,
        borderRadius: radius.pill,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        backgroundColor: colors.primary,
    },
    primaryText: {
        color: colors.text,
        fontSize: typography.body,
        fontWeight: fontWeights.black,
    },
});
