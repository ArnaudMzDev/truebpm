import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppScreen from "../components/ui/AppScreen";
import AppTopBar from "../components/ui/AppTopBar";
import AppScreenLoader from "../components/ui/AppScreenLoader";
import AppButton from "../components/ui/AppButton";
import { BlindTestResult, getBlindTestSession, startBlindTest } from "../lib/blindTestApi";
import { colors, fontWeights, radius, spacing, typography } from "../theme";

const scoreFormatter = new Intl.NumberFormat("fr-FR");

export default function BlindTestResultScreen({ navigation, route }: any) {
    const insets = useSafeAreaInsets();
    const sessionId = String(route.params?.sessionId || "");
    const [result, setResult] = useState<BlindTestResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [replaying, setReplaying] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await getBlindTestSession(sessionId);
            if (!response.result) throw new Error("Le résultat n’est pas encore disponible.");
            setResult(response.result);
        } catch (loadError: any) {
            setError(loadError?.message || "Impossible de charger le résultat.");
        } finally {
            setLoading(false);
        }
    }, [sessionId]);

    useEffect(() => {
        void load();
    }, [load]);

    const replay = useCallback(async () => {
        if (!result || replaying) return;
        setReplaying(true);
        setError("");
        try {
            const response = await startBlindTest({
                blindTestId: result.blindTest.slug,
                roundCount: result.rules.roundCount,
                difficulty: result.rules.difficulty,
                answerMode: result.rules.answerMode,
                target: result.rules.target,
            });
            navigation.replace("BlindTestGame", { sessionId: response.session.sessionId });
        } catch (replayError: any) {
            setError(replayError?.message || "Impossible de rejouer.");
        } finally {
            setReplaying(false);
        }
    }, [navigation, replaying, result]);

    const share = useCallback(async () => {
        if (!result) return;
        await Share.share({
            message: [
                `TrueBPM Blind Test · ${result.blindTest.title}`,
                `${result.titlesFound + result.artistsFound} réponses trouvées`,
                `${scoreFormatter.format(result.score)} points`,
                `Rang : #${result.rank}`,
                "Tu peux faire mieux ?",
            ].join("\n"),
        });
    }, [result]);

    if (loading && !result) return <AppScreenLoader label="Calcul du résultat..." />;

    if (!result) {
        return (
            <AppScreen>
                <AppTopBar title="Résultat" onBack={() => navigation.navigate("BlindTestHome")} />
                <View style={styles.centerError}>
                    <Text style={styles.errorTitle}>Résultat indisponible</Text>
                    <Text style={styles.errorText}>{error}</Text>
                    <AppButton label="Réessayer" onPress={load} />
                </View>
            </AppScreen>
        );
    }

    const missedRounds = result.rounds.filter((round) => {
        const titleAsked = round.questionType === "title" || round.questionType === "both" || round.questionType === "qcm-title";
        const artistAsked = round.questionType === "artist" || round.questionType === "both" || round.questionType === "qcm-artist";
        return (titleAsked && !round.titleCorrect) || (artistAsked && !round.artistCorrect);
    });

    return (
        <AppScreen>
            <AppTopBar title="Résultat" subtitle={result.blindTest.title} onBack={() => navigation.navigate("BlindTestHome")} />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.xxl }]}
            >
                {error ? <Text style={styles.inlineError}>{error}</Text> : null}

                <View style={styles.scoreHero}>
                    <Text style={styles.scoreEyebrow}>{result.isPersonalBest ? "Record personnel" : "Score final"}</Text>
                    <Text style={styles.score}>{scoreFormatter.format(result.score)}</Text>
                    <Text style={styles.points}>points</Text>
                    <View style={styles.rankPill}>
                        <Ionicons name="trophy-outline" size={16} color={colors.primary} />
                        <Text style={styles.rankText}>#{result.rank} sur ce blind test</Text>
                    </View>
                </View>

                <View style={styles.statsGrid}>
                    <Stat value={`${result.accuracy}%`} label="Précision" />
                    <Stat value={`${result.titlesFound}`} label="Titres" />
                    <Stat value={`${result.artistsFound}`} label="Artistes" />
                    <Stat value={`${(result.averageTimeMs / 1000).toFixed(1)}s`} label="Temps moyen" />
                    <Stat value={`${result.bestStreak}`} label="Meilleure série" />
                    <Stat value={`${result.roundCount}`} label="Manches" />
                </View>

                <View style={styles.actions}>
                    <AppButton label="Rejouer" loading={replaying} onPress={replay} style={styles.actionMain} />
                    <Pressable onPress={share} style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}>
                        <Ionicons name="share-outline" size={21} color={colors.text} />
                    </Pressable>
                </View>

                {missedRounds.length ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionEyebrow}>À revoir</Text>
                        <Text style={styles.sectionTitle}>Les morceaux qui t’ont échappé</Text>
                        {missedRounds.map((round) => (
                            <View key={round.index} style={styles.missedRow}>
                                <Text style={styles.roundNumber}>{String(round.index + 1).padStart(2, "0")}</Text>
                                <View style={styles.rowCopy}>
                                    <Text style={styles.trackTitle}>{round.correct.title}</Text>
                                    <Text style={styles.trackArtist}>{round.correct.artist}</Text>
                                </View>
                                <Text style={styles.roundScore}>+{scoreFormatter.format(round.score?.total || 0)}</Text>
                            </View>
                        ))}
                    </View>
                ) : (
                    <View style={styles.perfectRow}>
                        <Ionicons name="checkmark-circle" size={23} color={colors.success} />
                        <View style={styles.rowCopy}>
                            <Text style={styles.perfectTitle}>Sans faute.</Text>
                            <Text style={styles.perfectText}>Tu n’as laissé passer aucun morceau.</Text>
                        </View>
                    </View>
                )}

                <Pressable onPress={() => navigation.navigate("BlindTestHome")} style={({ pressed }) => [styles.homeLink, pressed && styles.pressed]}>
                    <Text style={styles.homeLinkText}>Retour aux sélections</Text>
                    <Ionicons name="arrow-forward" size={17} color={colors.textMuted} />
                </Pressable>
            </ScrollView>
        </AppScreen>
    );
}

function Stat({ value, label }: { value: string; label: string }) {
    return (
        <View style={styles.stat}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    content: { gap: spacing.xl },
    centerError: { flex: 1, justifyContent: "center", gap: spacing.md },
    errorTitle: { color: colors.text, fontSize: typography.title, fontWeight: fontWeights.black },
    errorText: { color: colors.textMuted, fontSize: typography.body },
    inlineError: { padding: spacing.md, borderRadius: radius.md, color: colors.danger, backgroundColor: colors.dangerSoft, fontWeight: fontWeights.bold },
    pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
    scoreHero: { alignItems: "center", paddingVertical: spacing.xxl },
    scoreEyebrow: { color: colors.primary, fontSize: typography.tiny, fontWeight: fontWeights.black, textTransform: "uppercase" },
    score: { marginTop: spacing.sm, color: colors.text, fontSize: 56, lineHeight: 60, fontWeight: fontWeights.black, fontVariant: ["tabular-nums"] },
    points: { color: colors.textMuted, fontSize: typography.body, fontWeight: fontWeights.bold },
    rankPill: { marginTop: spacing.lg, minHeight: 38, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
    rankText: { color: colors.textSoft, fontSize: typography.caption, fontWeight: fontWeights.extraBold },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
    stat: { width: "33.333%", alignItems: "center", paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
    statValue: { color: colors.text, fontSize: typography.subtitle, fontWeight: fontWeights.black, fontVariant: ["tabular-nums"] },
    statLabel: { marginTop: 3, color: colors.textMuted, fontSize: typography.tiny, fontWeight: fontWeights.bold },
    actions: { flexDirection: "row", gap: spacing.sm },
    actionMain: { flex: 1 },
    shareButton: { width: 50, height: 50, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.control },
    section: { gap: spacing.sm },
    sectionEyebrow: { color: colors.primary, fontSize: typography.tiny, fontWeight: fontWeights.black, textTransform: "uppercase" },
    sectionTitle: { color: colors.text, fontSize: typography.subtitle, fontWeight: fontWeights.black, marginBottom: spacing.sm },
    missedRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
    roundNumber: { width: 27, color: colors.textFaint, fontSize: typography.caption, fontWeight: fontWeights.black, fontVariant: ["tabular-nums"] },
    rowCopy: { flex: 1, minWidth: 0 },
    trackTitle: { color: colors.text, fontSize: typography.body, fontWeight: fontWeights.extraBold },
    trackArtist: { marginTop: 3, color: colors.textMuted, fontSize: typography.caption, fontWeight: fontWeights.medium },
    roundScore: { color: colors.textSoft, fontSize: typography.caption, fontWeight: fontWeights.black, fontVariant: ["tabular-nums"] },
    perfectRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
    perfectTitle: { color: colors.text, fontSize: typography.body, fontWeight: fontWeights.extraBold },
    perfectText: { marginTop: 3, color: colors.textMuted, fontSize: typography.caption },
    homeLink: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    homeLinkText: { color: colors.textMuted, fontSize: typography.bodySm, fontWeight: fontWeights.bold },
});
