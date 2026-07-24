import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Image,
    ImageBackground,
    KeyboardAvoidingView,
    Platform,
    Pressable,
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
import BlindTestClock from "../components/BlindTest/BlindTestClock";
import BlindTestAudioPlayer from "../components/BlindTest/BlindTestAudioPlayer";
import BlindTestAnswerInput from "../components/BlindTest/BlindTestAnswerInput";
import {
    BlindTestQuestionType,
    BlindTestSession,
    BlindTestSuggestion,
    continueBlindTest,
    getBlindTestSession,
    requestBlindTestHint,
    submitBlindTestAnswer,
} from "../lib/blindTestApi";
import { usePlayer } from "../context/PlayerContext";
import { colors, fontWeights, radius, spacing, typography } from "../theme";

const scoreFormatter = new Intl.NumberFormat("fr-FR");

function questionCopy(type: BlindTestQuestionType) {
    if (type === "title" || type === "qcm-title") return "Quel est le titre ?";
    if (type === "artist" || type === "qcm-artist") return "Qui chante ce morceau ?";
    return "Trouve le titre et l’artiste";
}

function asksTitle(type: BlindTestQuestionType) {
    return type === "title" || type === "both" || type === "qcm-title";
}

function asksArtist(type: BlindTestQuestionType) {
    return type === "artist" || type === "both" || type === "qcm-artist";
}

export default function BlindTestGameScreen({ navigation, route }: any) {
    const insets = useSafeAreaInsets();
    const { close: closeGlobalPlayer } = usePlayer();
    const scrollRef = useRef<ScrollView | null>(null);
    const submittingRef = useRef(false);
    const continuingRef = useRef(false);
    const [session, setSession] = useState<BlindTestSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [continuing, setContinuing] = useState(false);
    const [hintLoading, setHintLoading] = useState(false);
    const [title, setTitle] = useState("");
    const [artist, setArtist] = useState("");
    const [choice, setChoice] = useState("");
    const [hint, setHint] = useState<{ label: string; value: string; penalty: number } | null>(null);
    const [audioActive, setAudioActive] = useState(false);
    const [error, setError] = useState("");
    const sessionId = String(route.params?.sessionId || "");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await getBlindTestSession(sessionId);
            if (response.result) {
                navigation.replace("BlindTestResult", { sessionId });
                return;
            }
            if (!response.session) throw new Error("Partie introuvable.");
            setSession(response.session);
            setAudioActive(false);
        } catch (loadError: any) {
            setError(loadError?.message || "Impossible de charger la partie.");
        } finally {
            setLoading(false);
        }
    }, [navigation, sessionId]);

    useFocusEffect(
        useCallback(() => {
            void closeGlobalPlayer();
            void load();
            return () => setAudioActive(false);
        }, [closeGlobalPlayer, load])
    );

    useEffect(() => {
        setTitle("");
        setArtist("");
        setChoice("");
        setHint(null);
        submittingRef.current = false;
        continuingRef.current = false;
    }, [session?.round.index]);

    const submit = useCallback(async (timedOut = false) => {
        if (!session || session.reveal || submittingRef.current) return;
        submittingRef.current = true;
        setSubmitting(true);
        setError("");
        setAudioActive(false);

        try {
            const response = await submitBlindTestAnswer(session.sessionId, {
                roundIndex: session.round.index,
                title: timedOut ? "" : title,
                artist: timedOut ? "" : artist,
                choice: timedOut ? "" : choice,
            });
            if (response.completed) {
                navigation.replace("BlindTestResult", { sessionId: session.sessionId });
                return;
            }
            if (response.session) {
                setSession(response.session);
                requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: true }));
            }
        } catch (submitError: any) {
            submittingRef.current = false;
            setError(submitError?.message || "Impossible de valider la réponse.");
        } finally {
            setSubmitting(false);
        }
    }, [artist, choice, navigation, session, title]);

    const handleStarted = useCallback(() => setAudioActive(true), []);
    const handleExpired = useCallback(() => void submit(true), [submit]);

    const useHint = useCallback(async () => {
        if (!session || session.reveal || hintLoading) return;
        setHintLoading(true);
        setError("");
        try {
            const response = await requestBlindTestHint(session.sessionId);
            setHint(response.hint);
        } catch (hintError: any) {
            setError(hintError?.message || "Aucun indice disponible.");
        } finally {
            setHintLoading(false);
        }
    }, [hintLoading, session]);

    const nextRound = useCallback(async () => {
        if (!session || continuingRef.current) return;
        continuingRef.current = true;
        setContinuing(true);
        setError("");
        try {
            const response = await continueBlindTest(session.sessionId);
            setSession(response.session);
            setAudioActive(false);
            scrollRef.current?.scrollTo({ y: 0, animated: true });
        } catch (nextError: any) {
            const recovered = await getBlindTestSession(session.sessionId).catch(() => null);
            if (recovered?.session && recovered.session.round.index > session.round.index) {
                setSession(recovered.session);
                setAudioActive(false);
                scrollRef.current?.scrollTo({ y: 0, animated: true });
            } else {
                setError(nextError?.message || "Impossible de continuer.");
            }
        } finally {
            continuingRef.current = false;
            setContinuing(false);
        }
    }, [session]);

    const canSubmit = useMemo(() => {
        if (!session || session.reveal) return false;
        const type = session.round.questionType;
        if (type.startsWith("qcm-")) return !!choice;
        if (type === "title") return title.trim().length >= 2;
        if (type === "artist") return artist.trim().length >= 2;
        return title.trim().length >= 2 || artist.trim().length >= 2;
    }, [artist, choice, session, title]);

    const selectTitleSuggestion = useCallback((suggestion: BlindTestSuggestion) => {
        setTitle(suggestion.title);
        if (session && asksArtist(session.round.questionType) && suggestion.artist) {
            setArtist(suggestion.artist);
        }
    }, [session]);

    const selectArtistSuggestion = useCallback((suggestion: BlindTestSuggestion) => {
        setArtist(suggestion.artist);
    }, []);

    if (loading && !session) return <AppScreenLoader label="Chargement de la partie..." />;

    if (!session) {
        return (
            <AppScreen>
                <AppTopBar title="Blind Test" onBack={() => navigation.goBack()} />
                <View style={styles.centerError}>
                    <Text style={styles.errorTitle}>La partie ne répond pas.</Text>
                    <Text style={styles.errorText}>{error}</Text>
                    <AppButton label="Réessayer" onPress={load} />
                </View>
            </AppScreen>
        );
    }

    const round = session.round;
    const reveal = session.reveal;
    const answeredCorrectly = reveal
        ? (asksTitle(round.questionType) ? reveal.titleCorrect : true) &&
          (asksArtist(round.questionType) ? reveal.artistCorrect : true)
        : false;

    return (
        <AppScreen>
            <AppTopBar
                title={session.blindTest.title}
                subtitle={`Manche ${round.number} sur ${round.total}`}
                onBack={() => navigation.goBack()}
                right={<Text style={styles.headerScore}>{scoreFormatter.format(session.score)}</Text>}
            />
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <ScrollView
                    ref={scrollRef}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.xxl }]}
                >
                    {error ? <Text style={styles.inlineError}>{error}</Text> : null}

                    {!reveal ? (
                        <>
                            <View style={styles.questionHeader}>
                                <View style={styles.questionTopRow}>
                                    <Text style={styles.questionEyebrow}>Manche {round.number}</Text>
                                    <View style={styles.streakRow}>
                                        <Ionicons name="flash" size={15} color={session.streak > 0 ? colors.warning : colors.textFaint} />
                                        <Text style={styles.streakText}>Série {session.streak}</Text>
                                    </View>
                                </View>
                                <Text style={styles.questionTitle}>{questionCopy(round.questionType)}</Text>
                            </View>

                            <BlindTestClock
                                key={`${session.sessionId}:${round.index}`}
                                startsAt={round.startedAt}
                                endsAt={round.endsAt}
                                onStarted={handleStarted}
                                onExpired={handleExpired}
                            />

                            <BlindTestAudioPlayer
                                url={round.previewUrl}
                                roundKey={`${session.sessionId}:${round.index}`}
                                active={audioActive}
                                onError={setError}
                            />

                            {round.questionType.startsWith("qcm-") ? (
                                <View style={styles.options}>
                                    {round.options.map((option, index) => (
                                        <Pressable
                                            key={`${option}:${index}`}
                                            accessibilityRole="radio"
                                            accessibilityState={{ checked: choice === option }}
                                            onPress={() => setChoice(option)}
                                            style={({ pressed }) => [
                                                styles.option,
                                                choice === option && styles.optionSelected,
                                                pressed && styles.pressed,
                                            ]}
                                        >
                                            {round.optionArtworks?.[index] ? (
                                                <Image
                                                    source={{ uri: round.optionArtworks[index] }}
                                                    style={styles.optionArtwork}
                                                />
                                            ) : (
                                                <View style={styles.optionArtworkFallback}>
                                                    <Ionicons
                                                        name={round.questionType === "qcm-artist" ? "person" : "musical-note"}
                                                        size={22}
                                                        color={colors.textMuted}
                                                    />
                                                </View>
                                            )}
                                            <View style={styles.optionCopy}>
                                                <Text style={[styles.optionLetter, choice === option && styles.optionLetterSelected]}>
                                                    {String.fromCharCode(65 + index)}
                                                </Text>
                                                <Text
                                                    style={[styles.optionText, choice === option && styles.optionTextSelected]}
                                                    numberOfLines={2}
                                                >
                                                    {option}
                                                </Text>
                                            </View>
                                            {choice === option ? (
                                                <View style={styles.optionCheck}>
                                                    <Ionicons name="checkmark" size={14} color={colors.text} />
                                                </View>
                                            ) : null}
                                        </Pressable>
                                    ))}
                                </View>
                            ) : (
                                <View style={styles.inputs}>
                                    <View style={styles.answerHeader}>
                                        <View>
                                            <Text style={styles.answerEyebrow}>Ta réponse</Text>
                                            <Text style={styles.answerHeading}>Écris, on te suggère la suite</Text>
                                        </View>
                                        <Ionicons name="search" size={20} color={colors.primary} />
                                    </View>
                                    {asksTitle(round.questionType) ? (
                                        <BlindTestAnswerInput
                                            kind="title"
                                            value={title}
                                            onChangeText={setTitle}
                                            onSelect={selectTitleSuggestion}
                                            returnKeyType={asksArtist(round.questionType) ? "next" : "done"}
                                            onSubmit={!asksArtist(round.questionType) && canSubmit ? () => void submit(false) : undefined}
                                        />
                                    ) : null}
                                    {asksArtist(round.questionType) ? (
                                        <BlindTestAnswerInput
                                            kind="artist"
                                            value={artist}
                                            onChangeText={setArtist}
                                            onSelect={selectArtistSuggestion}
                                            returnKeyType="done"
                                            onSubmit={canSubmit ? () => void submit(false) : undefined}
                                        />
                                    ) : null}
                                </View>
                            )}

                            {hint ? (
                                <View style={styles.hintResult}>
                                    <Ionicons name="bulb-outline" size={18} color={colors.warning} />
                                    <View style={styles.rowCopy}>
                                        <Text style={styles.hintLabel}>{hint.label}</Text>
                                        <Text style={styles.hintValue}>{hint.value}</Text>
                                    </View>
                                    <Text style={styles.hintPenalty}>-{hint.penalty}</Text>
                                </View>
                            ) : null}

                            <View style={styles.actions}>
                                <Pressable
                                    disabled={hintLoading || !!hint}
                                    onPress={useHint}
                                    style={({ pressed }) => [styles.hintButton, pressed && styles.pressed, !!hint && styles.disabled]}
                                >
                                    <Ionicons name="bulb-outline" size={18} color={colors.textSoft} />
                                    <Text style={styles.hintButtonText}>{hintLoading ? "Indice..." : "Un indice"}</Text>
                                </Pressable>
                                <AppButton
                                    label="Valider ma réponse"
                                    loading={submitting}
                                    disabled={!canSubmit}
                                    onPress={() => submit(false)}
                                    style={styles.submitButton}
                                />
                            </View>
                        </>
                    ) : (
                        <View style={styles.reveal}>
                            <View style={styles.revealStatus}>
                                <View style={[styles.statusIcon, answeredCorrectly ? styles.statusSuccess : styles.statusMiss]}>
                                    <Ionicons
                                        name={answeredCorrectly ? "checkmark" : reveal.timedOut ? "timer-outline" : "close"}
                                        size={25}
                                        color={answeredCorrectly ? colors.success : colors.danger}
                                    />
                                </View>
                                <View style={styles.rowCopy}>
                                    <Text style={styles.revealEyebrow}>{reveal.timedOut ? "Temps écoulé" : answeredCorrectly ? "Bien joué" : "Pas cette fois"}</Text>
                                    <Text style={styles.pointsEarned}>+{scoreFormatter.format(reveal.score?.total || 0)} points</Text>
                                </View>
                            </View>

                            {reveal.correct.artworkUrl ? (
                                <ImageBackground
                                    accessible
                                    accessibilityLabel={`Pochette de ${reveal.correct.title} par ${reveal.correct.artist}`}
                                    source={{ uri: reveal.correct.artworkUrl }}
                                    style={styles.revealArtwork}
                                    imageStyle={styles.revealArtworkImage}
                                >
                                    <View style={styles.revealScrim} />
                                    <View style={styles.revealTrackCopy}>
                                        <Text style={styles.correctTitle}>{reveal.correct.title}</Text>
                                        <Text style={styles.correctArtist}>{reveal.correct.artist}</Text>
                                        {reveal.correct.album || reveal.correct.year ? (
                                            <Text style={styles.correctMeta} numberOfLines={1}>
                                                {[reveal.correct.album, reveal.correct.year].filter(Boolean).join(" · ")}
                                            </Text>
                                        ) : null}
                                    </View>
                                </ImageBackground>
                            ) : (
                                <View style={[styles.revealArtwork, styles.artworkFallback]}>
                                    <Ionicons name="musical-notes" size={52} color={colors.textMuted} />
                                    <View style={styles.revealTrackCopy}>
                                        <Text style={styles.correctTitle}>{reveal.correct.title}</Text>
                                        <Text style={styles.correctArtist}>{reveal.correct.artist}</Text>
                                    </View>
                                </View>
                            )}

                            <View style={styles.breakdown}>
                                <Text style={styles.breakdownTitle}>Détail de la manche</Text>
                                <ScoreLine label="Titre" value={reveal.score?.title || 0} />
                                <ScoreLine label="Artiste" value={reveal.score?.artist || 0} />
                                <ScoreLine label="Rapidité" value={reveal.score?.speed || 0} />
                                {(reveal.score?.streak || 0) > 0 ? <ScoreLine label="Série" value={reveal.score?.streak || 0} /> : null}
                                {(reveal.score?.hintPenalty || 0) > 0 ? <ScoreLine label="Indice" value={-(reveal.score?.hintPenalty || 0)} negative /> : null}
                            </View>

                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Score actuel</Text>
                                <Text style={styles.totalValue}>{scoreFormatter.format(session.score)}</Text>
                            </View>
                            <AppButton
                                label={`Continuer · Manche ${Math.min(round.number + 1, round.total)}`}
                                loading={continuing}
                                disabled={continuing}
                                onPress={nextRound}
                            />
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </AppScreen>
    );
}

function ScoreLine({ label, value, negative = false }: { label: string; value: number; negative?: boolean }) {
    return (
        <View style={styles.scoreLine}>
            <Text style={styles.scoreLabel}>{label}</Text>
            <Text style={[styles.scoreValue, negative && styles.negativeValue]}>
                {value > 0 ? "+" : ""}{scoreFormatter.format(value)}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    content: { gap: spacing.xl },
    headerScore: { color: colors.text, fontSize: typography.body, fontWeight: fontWeights.black, fontVariant: ["tabular-nums"] },
    centerError: { flex: 1, justifyContent: "center", gap: spacing.md },
    errorTitle: { color: colors.text, fontSize: typography.title, fontWeight: fontWeights.black },
    errorText: { color: colors.textMuted, fontSize: typography.body, lineHeight: 20 },
    inlineError: { padding: spacing.md, borderRadius: radius.md, color: colors.danger, backgroundColor: colors.dangerSoft, fontSize: typography.bodySm, fontWeight: fontWeights.bold },
    pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
    disabled: { opacity: 0.45 },
    questionHeader: { gap: spacing.sm },
    questionTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    questionEyebrow: { color: colors.primary, fontSize: typography.tiny, fontWeight: fontWeights.black, textTransform: "uppercase" },
    questionTitle: { color: colors.text, fontSize: 28, lineHeight: 32, fontWeight: fontWeights.black },
    streakRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    streakText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: fontWeights.bold },
    options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    option: { width: "48.7%", minHeight: 92, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.xl, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderSubtle },
    optionSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    optionArtwork: { width: 58, height: 58, flexShrink: 0, borderRadius: radius.md, backgroundColor: colors.surface3 },
    optionArtworkFallback: { width: 58, height: 58, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.control },
    optionCopy: { flex: 1, minWidth: 0, gap: 3 },
    optionLetter: { color: colors.primary, fontSize: 10, fontWeight: fontWeights.black },
    optionLetterSelected: { color: colors.accentMuted },
    optionText: { color: colors.textSoft, fontSize: typography.bodySm, lineHeight: 17, fontWeight: fontWeights.extraBold },
    optionTextSelected: { color: colors.text },
    optionCheck: { position: "absolute", top: 6, right: 6, width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.primaryDark },
    inputs: { gap: spacing.lg, padding: spacing.lg, borderRadius: radius.xxl, backgroundColor: colors.surface2 },
    answerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
    answerEyebrow: { color: colors.primary, fontSize: typography.tiny, fontWeight: fontWeights.black, textTransform: "uppercase" },
    answerHeading: { marginTop: 3, color: colors.text, fontSize: typography.body, fontWeight: fontWeights.extraBold },
    hintResult: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
    rowCopy: { flex: 1, minWidth: 0 },
    hintLabel: { color: colors.textMuted, fontSize: typography.tiny, fontWeight: fontWeights.bold, textTransform: "uppercase" },
    hintValue: { marginTop: 3, color: colors.text, fontSize: typography.body, fontWeight: fontWeights.black },
    hintPenalty: { color: colors.warning, fontSize: typography.caption, fontWeight: fontWeights.black },
    actions: { flexDirection: "row", gap: spacing.sm, paddingBottom: spacing.sm },
    hintButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.control },
    hintButtonText: { color: colors.textSoft, fontSize: typography.bodySm, fontWeight: fontWeights.extraBold },
    submitButton: { flex: 1 },
    reveal: { gap: spacing.xl },
    revealStatus: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    statusIcon: { width: 52, height: 52, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
    statusSuccess: { backgroundColor: "rgba(34,197,94,0.14)" },
    statusMiss: { backgroundColor: colors.dangerSoft },
    revealEyebrow: { color: colors.textMuted, fontSize: typography.caption, fontWeight: fontWeights.black, textTransform: "uppercase" },
    pointsEarned: { marginTop: 3, color: colors.text, fontSize: typography.title, fontWeight: fontWeights.black },
    revealArtwork: { width: "100%", aspectRatio: 1, justifyContent: "flex-end", overflow: "hidden", borderRadius: radius.xxl, backgroundColor: colors.surface3 },
    revealArtworkImage: { borderRadius: radius.xxl },
    revealScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.24)" },
    artworkFallback: { alignItems: "center", justifyContent: "center" },
    revealTrackCopy: { width: "100%", paddingTop: 44, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, backgroundColor: "rgba(3,4,6,0.78)" },
    correctTitle: { color: colors.text, fontSize: 25, lineHeight: 29, fontWeight: fontWeights.black },
    correctArtist: { marginTop: 4, color: colors.textSoft, fontSize: typography.subtitle, fontWeight: fontWeights.bold },
    correctMeta: { marginTop: spacing.sm, color: colors.textMuted, fontSize: typography.caption },
    breakdown: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface2 },
    breakdownTitle: { marginBottom: spacing.xs, color: colors.text, fontSize: typography.body, fontWeight: fontWeights.black },
    scoreLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    scoreLabel: { color: colors.textMuted, fontSize: typography.bodySm, fontWeight: fontWeights.bold },
    scoreValue: { color: colors.text, fontSize: typography.body, fontWeight: fontWeights.black, fontVariant: ["tabular-nums"] },
    negativeValue: { color: colors.warning },
    totalRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
    totalLabel: { color: colors.textMuted, fontSize: typography.body, fontWeight: fontWeights.bold },
    totalValue: { color: colors.primary, fontSize: 28, fontWeight: fontWeights.black, fontVariant: ["tabular-nums"] },
});
