import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ImageBackground,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppScreen from "../components/ui/AppScreen";
import AppTopBar from "../components/ui/AppTopBar";
import AppScreenLoader from "../components/ui/AppScreenLoader";
import AppButton from "../components/ui/AppButton";
import {
    BlindTestAnswerMode,
    BlindTestCategory,
    BlindTestDifficulty,
    getBlindTestCatalog,
    getBlindTestLeaderboard,
    startBlindTest,
} from "../lib/blindTestApi";
import { colors, fontWeights, radius, spacing, typography } from "../theme";

const scoreFormatter = new Intl.NumberFormat("fr-FR");
const ROUND_COUNTS = [5, 10, 20, 30];
const DIFFICULTIES: Array<{ value: BlindTestDifficulty; label: string }> = [
    { value: "easy", label: "Facile" },
    { value: "normal", label: "Normal" },
    { value: "hard", label: "Difficile" },
    { value: "expert", label: "Expert" },
];
const FORMATS: Array<{
    value: BlindTestAnswerMode;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    description: string;
}> = [
    { value: "mixed", icon: "shuffle", label: "Mixte", description: "QCM et réponses libres" },
    { value: "free", icon: "create-outline", label: "Libre", description: "Écris titre et artiste" },
    { value: "qcm", icon: "grid-outline", label: "QCM", description: "Quatre choix par manche" },
];

function categoryIcon(slug: string): keyof typeof Ionicons.glyphMap {
    if (slug.includes("rap")) return "mic-outline";
    if (slug.includes("electro")) return "pulse-outline";
    if (slug.includes("rnb")) return "moon-outline";
    if (slug.includes("pop")) return "star-outline";
    if (slug.includes("internation")) return "earth-outline";
    return "musical-notes-outline";
}

function StepTitle({ number, title, detail }: { number: string; title: string; detail: string }) {
    return (
        <View style={styles.stepHeader}>
            <Text style={styles.stepNumber}>{number}</Text>
            <View style={styles.stepCopy}>
                <Text style={styles.stepTitle}>{title}</Text>
                <Text style={styles.stepDetail}>{detail}</Text>
            </View>
        </View>
    );
}

export default function BlindTestHomeScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const [catalog, setCatalog] = useState<any>(null);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [selectedSlug, setSelectedSlug] = useState("");
    const [roundCount, setRoundCount] = useState(5);
    const [difficulty, setDifficulty] = useState<BlindTestDifficulty>("normal");
    const [answerMode, setAnswerMode] = useState<BlindTestAnswerMode>("mixed");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(async (refresh = false) => {
        if (refresh) setRefreshing(true);
        else setLoading(true);
        setError("");
        try {
            const nextCatalog = await getBlindTestCatalog();
            setCatalog(nextCatalog);
            const defaultCategory = nextCatalog.categories.find((item) => item.featured) || nextCatalog.categories[0];
            setSelectedSlug((current) => current || defaultCategory?.slug || "");
        } catch (loadError: any) {
            setError(loadError?.message || "Impossible de charger les sélections.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void load();
        }, [load])
    );

    useEffect(() => {
        if (!selectedSlug) return;
        let active = true;
        getBlindTestLeaderboard(selectedSlug)
            .then((response) => active && setLeaderboard(response.entries.slice(0, 3)))
            .catch(() => active && setLeaderboard([]));
        return () => {
            active = false;
        };
    }, [selectedSlug]);

    const categories: BlindTestCategory[] = catalog?.categories || [];
    const selectedCategory = useMemo(
        () => categories.find((category) => category.slug === selectedSlug) || categories[0],
        [categories, selectedSlug]
    );

    useEffect(() => {
        if (selectedCategory?.difficulty) setDifficulty(selectedCategory.difficulty);
    }, [selectedCategory?.slug]);

    const start = useCallback(async () => {
        if (!selectedCategory || starting) return;
        setStarting(true);
        setError("");
        try {
            const response = await startBlindTest({
                blindTestId: selectedCategory.slug,
                roundCount,
                difficulty,
                answerMode,
                target: answerMode === "free" ? "both" : "mixed",
            });
            navigation.navigate("BlindTestGame", { sessionId: response.session.sessionId });
        } catch (startError: any) {
            setError(startError?.message || "Impossible de préparer les extraits.");
        } finally {
            setStarting(false);
        }
    }, [answerMode, difficulty, navigation, roundCount, selectedCategory, starting]);

    if (loading && !catalog) return <AppScreenLoader label="Préparation des blind tests..." />;

    return (
        <AppScreen padded={false}>
            <View style={styles.horizontalPadding}>
                <AppTopBar title="Blind Test" subtitle="Écoute. Trouve. Marque." onBack={() => navigation.goBack()} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
                contentContainerStyle={[
                    styles.content,
                    { paddingBottom: 116 + Math.max(insets.bottom, spacing.md) },
                ]}
            >
                {error ? (
                    <View style={styles.errorBox} accessibilityLiveRegion="polite">
                        <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                {catalog?.active ? (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Reprendre ${catalog.active.title}`}
                        onPress={() => navigation.navigate("BlindTestGame", { sessionId: catalog.active.id })}
                        style={({ pressed }) => [styles.resume, pressed && styles.pressed]}
                    >
                        <View style={styles.resumePlay}>
                            <Ionicons name="play" size={17} color={colors.text} />
                        </View>
                        <View style={styles.flexCopy}>
                            <Text style={styles.resumeLabel}>Reprendre la partie</Text>
                            <Text style={styles.resumeTitle}>{catalog.active.title}</Text>
                        </View>
                        <Text style={styles.resumeCount}>
                            {Math.min(catalog.active.currentRound + 1, catalog.active.roundCount)}/{catalog.active.roundCount}
                        </Text>
                        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </Pressable>
                ) : null}

                <View style={styles.section}>
                    <StepTitle number="01" title="Choisis ton terrain" detail="Une ambiance, une cover, puis à toi de reconnaître les morceaux." />
                    {selectedCategory ? (
                        <View style={styles.categoryHeroWrap}>
                            {selectedCategory.coverUrl ? (
                                <ImageBackground
                                    source={{ uri: selectedCategory.coverUrl }}
                                    style={styles.categoryHero}
                                    imageStyle={styles.categoryHeroImage}
                                >
                                    <View style={styles.categoryHeroScrim} />
                                    <View style={styles.categoryHeroCopy}>
                                        <View style={styles.categoryHeroBadge}>
                                            <Ionicons name={categoryIcon(selectedCategory.slug)} size={15} color={colors.accentMuted} />
                                            <Text style={styles.categoryHeroBadgeText}>
                                                {selectedCategory.region === "france" ? "France" : selectedCategory.region === "international" ? "Monde" : "Mixte"}
                                            </Text>
                                        </View>
                                        <View>
                                            <Text style={styles.categoryHeroTitle}>{selectedCategory.title}</Text>
                                            <Text style={styles.categoryHeroDescription} numberOfLines={2}>
                                                {selectedCategory.description}
                                            </Text>
                                        </View>
                                    </View>
                                </ImageBackground>
                            ) : (
                                <View style={[styles.categoryHero, styles.categoryHeroFallback]}>
                                    <Ionicons name={categoryIcon(selectedCategory.slug)} size={56} color={colors.primary} />
                                    <View>
                                        <Text style={styles.categoryHeroTitle}>{selectedCategory.title}</Text>
                                        <Text style={styles.categoryHeroDescription}>{selectedCategory.description}</Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    ) : null}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoryRail}
                    >
                        {categories.map((category) => {
                            const selected = category.slug === selectedCategory?.slug;
                            return (
                                <Pressable
                                    key={category.slug}
                                    accessibilityRole="radio"
                                    accessibilityState={{ checked: selected }}
                                    accessibilityLabel={category.title}
                                    onPress={() => setSelectedSlug(category.slug)}
                                    style={({ pressed }) => [styles.categoryRailItem, pressed && styles.pressed]}
                                >
                                    <View style={[styles.categoryThumbWrap, selected && styles.categoryThumbWrapSelected]}>
                                        {category.coverUrl ? (
                                            <ImageBackground
                                                source={{ uri: category.coverUrl }}
                                                style={styles.categoryThumb}
                                                imageStyle={styles.categoryThumbImage}
                                            >
                                                {selected ? (
                                                    <View style={styles.categoryThumbCheck}>
                                                        <Ionicons name="checkmark" size={14} color={colors.text} />
                                                    </View>
                                                ) : null}
                                            </ImageBackground>
                                        ) : (
                                            <View style={[styles.categoryThumb, styles.categoryThumbFallback]}>
                                                <Ionicons name={categoryIcon(category.slug)} size={28} color={selected ? colors.primary : colors.textMuted} />
                                            </View>
                                        )}
                                    </View>
                                    <Text style={[styles.categoryRailLabel, selected && styles.categoryRailLabelSelected]} numberOfLines={2}>
                                        {category.title}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </View>

                <View style={styles.section}>
                    <StepTitle number="02" title="Combien de manches ?" detail="Une partie de 5 manches dure environ deux minutes." />
                    <View style={styles.roundChoices}>
                        {ROUND_COUNTS.map((value) => {
                            const selected = roundCount === value;
                            return (
                                <Pressable
                                    key={value}
                                    accessibilityRole="radio"
                                    accessibilityState={{ checked: selected }}
                                    onPress={() => setRoundCount(value)}
                                    style={({ pressed }) => [styles.roundChoice, selected && styles.roundChoiceSelected, pressed && styles.pressed]}
                                >
                                    <Text style={[styles.roundValue, selected && styles.roundValueSelected]}>{value}</Text>
                                    <Text style={[styles.roundLabel, selected && styles.roundLabelSelected]}>manches</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

                <View style={styles.section}>
                    <StepTitle number="03" title="Comment tu veux jouer ?" detail="Le mode mixte donne le rythme le plus varié." />
                    <View style={styles.formatList}>
                        {FORMATS.map((format) => {
                            const selected = answerMode === format.value;
                            return (
                                <Pressable
                                    key={format.value}
                                    accessibilityRole="radio"
                                    accessibilityState={{ checked: selected }}
                                    onPress={() => setAnswerMode(format.value)}
                                    style={({ pressed }) => [styles.formatRow, selected && styles.formatRowSelected, pressed && styles.pressed]}
                                >
                                    <View style={[styles.formatIcon, selected && styles.formatIconSelected]}>
                                        <Ionicons name={format.icon} size={20} color={selected ? colors.text : colors.textMuted} />
                                    </View>
                                    <View style={styles.flexCopy}>
                                        <Text style={[styles.formatTitle, selected && styles.formatTitleSelected]}>{format.label}</Text>
                                        <Text style={styles.formatDescription}>{format.description}</Text>
                                    </View>
                                    <View style={[styles.radio, selected && styles.radioSelected]}>
                                        {selected ? <View style={styles.radioDot} /> : null}
                                    </View>
                                </Pressable>
                            );
                        })}
                    </View>

                    <Text style={styles.difficultyLabel}>Difficulté</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.difficultyRow}>
                        {DIFFICULTIES.map((item) => {
                            const selected = difficulty === item.value;
                            return (
                                <Pressable
                                    key={item.value}
                                    accessibilityRole="radio"
                                    accessibilityState={{ checked: selected }}
                                    onPress={() => setDifficulty(item.value)}
                                    style={({ pressed }) => [styles.difficultyPill, selected && styles.difficultyPillSelected, pressed && styles.pressed]}
                                >
                                    <Text style={[styles.difficultyText, selected && styles.difficultyTextSelected]}>{item.label}</Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </View>

                {leaderboard.length ? (
                    <View style={styles.section}>
                        <View style={styles.simpleHeader}>
                            <Text style={styles.simpleEyebrow}>Top joueurs</Text>
                            <Text style={styles.simpleTitle}>{selectedCategory?.title}</Text>
                        </View>
                        {leaderboard.map((entry) => (
                            <View key={entry.userId} style={styles.rankingRow}>
                                <Text style={styles.rank}>#{entry.rank}</Text>
                                <Text style={styles.rankingName} numberOfLines={1}>{entry.pseudo}</Text>
                                <Text style={styles.rankingScore}>{scoreFormatter.format(entry.score)} pts</Text>
                            </View>
                        ))}
                    </View>
                ) : null}

                {catalog?.recent?.length ? (
                    <View style={styles.section}>
                        <View style={styles.simpleHeader}>
                            <Text style={styles.simpleEyebrow}>Historique</Text>
                            <Text style={styles.simpleTitle}>Tes dernières parties</Text>
                        </View>
                        {catalog.recent.slice(0, 3).map((item: any) => (
                            <Pressable
                                key={item.id}
                                onPress={() => navigation.navigate("BlindTestResult", { sessionId: item.id })}
                                style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}
                            >
                                <View style={styles.flexCopy}>
                                    <Text style={styles.historyTitle}>{item.title}</Text>
                                    <Text style={styles.historyMeta}>{item.roundCount} manches</Text>
                                </View>
                                <Text style={styles.historyScore}>{scoreFormatter.format(item.score)}</Text>
                                <Ionicons name="chevron-forward" size={17} color={colors.textFaint} />
                            </Pressable>
                        ))}
                    </View>
                ) : null}
            </ScrollView>

            <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
                {selectedCategory?.coverUrl ? (
                    <ImageBackground
                        source={{ uri: selectedCategory.coverUrl }}
                        style={styles.bottomCover}
                        imageStyle={styles.bottomCoverImage}
                    />
                ) : null}
                <View style={styles.bottomCopy}>
                    <Text style={styles.bottomLabel}>Ta partie</Text>
                    <Text style={styles.bottomTitle} numberOfLines={1}>{selectedCategory?.title || "Choisis une sélection"}</Text>
                    <Text style={styles.bottomMeta}>{roundCount} manches · {FORMATS.find((format) => format.value === answerMode)?.label}</Text>
                </View>
                <AppButton
                    label={starting ? "Préparation..." : "Jouer"}
                    loading={starting}
                    disabled={!selectedCategory}
                    onPress={start}
                    style={styles.playButton}
                />
            </View>
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    horizontalPadding: { paddingHorizontal: spacing.lg },
    content: { paddingHorizontal: spacing.lg, gap: spacing.xxxl },
    pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
    errorBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.dangerSoft },
    errorText: { flex: 1, color: colors.danger, fontSize: typography.bodySm, fontWeight: fontWeights.bold },
    resume: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface2 },
    resumePlay: { width: 42, height: 42, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryDark },
    flexCopy: { flex: 1, minWidth: 0 },
    resumeLabel: { color: colors.primary, fontSize: typography.tiny, fontWeight: fontWeights.black, textTransform: "uppercase" },
    resumeTitle: { marginTop: 3, color: colors.text, fontSize: typography.body, fontWeight: fontWeights.extraBold },
    resumeCount: { color: colors.textSoft, fontSize: typography.bodySm, fontWeight: fontWeights.black, fontVariant: ["tabular-nums"] },
    section: { gap: spacing.lg },
    stepHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
    stepNumber: { width: 32, color: colors.primary, fontSize: typography.caption, fontWeight: fontWeights.black, fontVariant: ["tabular-nums"] },
    stepCopy: { flex: 1, gap: 3 },
    stepTitle: { color: colors.text, fontSize: typography.subtitle, fontWeight: fontWeights.black },
    stepDetail: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 17, fontWeight: fontWeights.medium },
    categoryHeroWrap: { width: "100%", aspectRatio: 1.48 },
    categoryHero: { flex: 1, justifyContent: "flex-end", overflow: "hidden", borderRadius: radius.xxl, backgroundColor: colors.surface2 },
    categoryHeroImage: { borderRadius: radius.xxl },
    categoryHeroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(3,4,7,0.48)" },
    categoryHeroCopy: { flex: 1, justifyContent: "space-between", padding: spacing.lg },
    categoryHeroBadge: { alignSelf: "flex-start", minHeight: 34, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: "rgba(4,5,8,0.78)" },
    categoryHeroBadgeText: { color: colors.textSoft, fontSize: typography.tiny, fontWeight: fontWeights.black, textTransform: "uppercase" },
    categoryHeroTitle: { color: colors.text, fontSize: 28, lineHeight: 31, fontWeight: fontWeights.black },
    categoryHeroDescription: { maxWidth: "88%", marginTop: spacing.sm, color: colors.textSoft, fontSize: typography.body, lineHeight: 20, fontWeight: fontWeights.medium },
    categoryHeroFallback: { justifyContent: "space-between", padding: spacing.lg },
    categoryRail: { gap: spacing.md, paddingRight: spacing.lg },
    categoryRailItem: { width: 88, gap: spacing.sm },
    categoryThumbWrap: { width: 88, height: 88, padding: 2, borderRadius: radius.xl, borderWidth: 1, borderColor: "transparent" },
    categoryThumbWrapSelected: { borderColor: colors.primary },
    categoryThumb: { flex: 1, alignItems: "flex-end", padding: spacing.xs, overflow: "hidden", borderRadius: radius.lg, backgroundColor: colors.surface2 },
    categoryThumbImage: { borderRadius: radius.lg },
    categoryThumbFallback: { alignItems: "center", justifyContent: "center" },
    categoryThumbCheck: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.primaryDark },
    categoryRailLabel: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 16, fontWeight: fontWeights.bold },
    categoryRailLabelSelected: { color: colors.text },
    roundChoices: { flexDirection: "row", gap: spacing.sm },
    roundChoice: { flex: 1, minHeight: 72, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.surface2 },
    roundChoiceSelected: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.borderAccent },
    roundValue: { color: colors.textSoft, fontSize: typography.subtitle, fontWeight: fontWeights.black, fontVariant: ["tabular-nums"] },
    roundValueSelected: { color: colors.text },
    roundLabel: { marginTop: 2, color: colors.textFaint, fontSize: 10, fontWeight: fontWeights.bold },
    roundLabelSelected: { color: colors.accentMuted },
    formatList: { gap: spacing.sm },
    formatRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: "transparent" },
    formatRowSelected: { backgroundColor: colors.primaryFaint, borderColor: colors.borderAccent },
    formatIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.control },
    formatIconSelected: { backgroundColor: colors.primaryDark },
    formatTitle: { color: colors.textSoft, fontSize: typography.body, fontWeight: fontWeights.extraBold },
    formatTitleSelected: { color: colors.text },
    formatDescription: { marginTop: 3, color: colors.textMuted, fontSize: typography.caption, fontWeight: fontWeights.medium },
    radio: { width: 22, height: 22, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
    radioSelected: { borderColor: colors.primary },
    radioDot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.primary },
    difficultyLabel: { marginTop: spacing.sm, color: colors.textMuted, fontSize: typography.caption, fontWeight: fontWeights.bold },
    difficultyRow: { gap: spacing.sm },
    difficultyPill: { minHeight: 42, justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.controlMuted },
    difficultyPillSelected: { backgroundColor: colors.primarySoft },
    difficultyText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: fontWeights.bold },
    difficultyTextSelected: { color: colors.text },
    simpleHeader: { gap: 3 },
    simpleEyebrow: { color: colors.primary, fontSize: typography.tiny, fontWeight: fontWeights.black, textTransform: "uppercase" },
    simpleTitle: { color: colors.text, fontSize: typography.subtitle, fontWeight: fontWeights.black },
    rankingRow: { minHeight: 52, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
    rank: { width: 42, color: colors.primary, fontSize: typography.bodySm, fontWeight: fontWeights.black },
    rankingName: { flex: 1, color: colors.textSoft, fontSize: typography.body, fontWeight: fontWeights.bold },
    rankingScore: { color: colors.text, fontSize: typography.bodySm, fontWeight: fontWeights.black, fontVariant: ["tabular-nums"] },
    historyRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
    historyTitle: { color: colors.text, fontSize: typography.body, fontWeight: fontWeights.extraBold },
    historyMeta: { marginTop: 3, color: colors.textMuted, fontSize: typography.caption },
    historyScore: { color: colors.text, fontSize: typography.subtitle, fontWeight: fontWeights.black, fontVariant: ["tabular-nums"] },
    bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 96, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingTop: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    bottomCover: { width: 52, height: 52, overflow: "hidden", borderRadius: radius.md, backgroundColor: colors.surface3 },
    bottomCoverImage: { borderRadius: radius.md },
    bottomCopy: { flex: 1, minWidth: 0 },
    bottomLabel: { color: colors.primary, fontSize: 10, fontWeight: fontWeights.black, textTransform: "uppercase" },
    bottomTitle: { marginTop: 2, color: colors.text, fontSize: typography.body, fontWeight: fontWeights.black },
    bottomMeta: { marginTop: 2, color: colors.textMuted, fontSize: typography.tiny, fontWeight: fontWeights.bold },
    playButton: { minWidth: 112 },
});
