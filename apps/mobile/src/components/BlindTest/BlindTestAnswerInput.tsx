import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
    BlindTestSuggestion,
    searchBlindTestSuggestions,
} from "../../lib/blindTestApi";
import { colors, fontWeights, radius, spacing, typography } from "../../theme";

type Props = {
    kind: "title" | "artist";
    value: string;
    onChangeText: (value: string) => void;
    onSelect: (suggestion: BlindTestSuggestion) => void;
    onSubmit?: () => void;
    returnKeyType?: "done" | "next";
};

function BlindTestAnswerInput({
    kind,
    value,
    onChangeText,
    onSelect,
    onSubmit,
    returnKeyType = "done",
}: Props) {
    const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [focused, setFocused] = useState(false);
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<BlindTestSuggestion[]>([]);
    const [searchFailed, setSearchFailed] = useState(false);

    useEffect(() => {
        const query = value.trim();
        if (!focused || query.length < 2) {
            setSuggestions([]);
            setLoading(false);
            setSearchFailed(false);
            return;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => {
            setLoading(true);
            setSearchFailed(false);
            searchBlindTestSuggestions(kind, query, controller.signal)
                .then(setSuggestions)
                .catch((error: any) => {
                    if (error?.name === "AbortError") return;
                    setSuggestions([]);
                    setSearchFailed(true);
                })
                .finally(() => {
                    if (!controller.signal.aborted) setLoading(false);
                });
        }, 220);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [focused, kind, value]);

    useEffect(() => () => {
        if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    }, []);

    const handleFocus = useCallback(() => {
        if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
        setFocused(true);
    }, []);

    const handleBlur = useCallback(() => {
        blurTimerRef.current = setTimeout(() => setFocused(false), 140);
    }, []);

    const handleSelect = useCallback((suggestion: BlindTestSuggestion) => {
        if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
        setFocused(false);
        setSuggestions([]);
        onSelect(suggestion);
    }, [onSelect]);

    const showMenu = focused && value.trim().length >= 2;
    const label = kind === "title" ? "Titre" : "Artiste";

    return (
        <View style={styles.group}>
            <Text style={styles.label}>{label}</Text>
            <View style={[styles.inputShell, focused && styles.inputShellFocused]}>
                <Ionicons
                    name={kind === "title" ? "musical-note-outline" : "person-outline"}
                    size={19}
                    color={focused ? colors.primary : colors.textMuted}
                />
                <TextInput
                    accessibilityLabel={`Réponse ${label.toLowerCase()}`}
                    value={value}
                    onChangeText={onChangeText}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onSubmitEditing={onSubmit}
                    placeholder={kind === "title" ? "Commence à écrire le morceau" : "Commence à écrire l’artiste"}
                    placeholderTextColor={colors.textFaint}
                    autoCorrect={false}
                    autoCapitalize="words"
                    returnKeyType={returnKeyType}
                    style={styles.input}
                />
                {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
            </View>

            {showMenu ? (
                <View style={styles.menu} accessibilityLiveRegion="polite">
                    {suggestions.map((suggestion, index) => (
                        <Pressable
                            key={`${suggestion.id}:${index}`}
                            accessibilityRole="button"
                            accessibilityLabel={
                                kind === "title"
                                    ? `${suggestion.title}, par ${suggestion.artist}`
                                    : suggestion.artist
                            }
                            onPress={() => handleSelect(suggestion)}
                            style={({ pressed }) => [
                                styles.suggestion,
                                index < suggestions.length - 1 && styles.suggestionDivider,
                                pressed && styles.suggestionPressed,
                            ]}
                        >
                            {suggestion.coverUrl ? (
                                <Image source={{ uri: suggestion.coverUrl }} style={styles.cover} />
                            ) : (
                                <View style={styles.coverFallback}>
                                    <Ionicons
                                        name={kind === "title" ? "musical-notes" : "person"}
                                        size={18}
                                        color={colors.textMuted}
                                    />
                                </View>
                            )}
                            <View style={styles.copy}>
                                <Text style={styles.suggestionTitle} numberOfLines={1}>
                                    {kind === "title" ? suggestion.title : suggestion.artist}
                                </Text>
                                <Text style={styles.suggestionMeta} numberOfLines={1}>
                                    {kind === "title" ? suggestion.artist : "Artiste"}
                                </Text>
                            </View>
                            <Ionicons name="arrow-up-outline" size={18} color={colors.textMuted} style={styles.pickIcon} />
                        </Pressable>
                    ))}

                    {!loading && suggestions.length === 0 ? (
                        <View style={styles.emptyRow}>
                            <Ionicons
                                name={searchFailed ? "cloud-offline-outline" : "pencil-outline"}
                                size={17}
                                color={colors.textMuted}
                            />
                            <Text style={styles.emptyText}>
                                {searchFailed
                                    ? "Suggestions indisponibles, tu peux quand même répondre."
                                    : "Aucune suggestion, garde ta réponse si elle te semble juste."}
                            </Text>
                        </View>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    group: {
        gap: spacing.sm,
    },
    label: {
        color: colors.textSoft,
        fontSize: typography.caption,
        fontWeight: fontWeights.extraBold,
    },
    inputShell: {
        minHeight: 58,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: colors.surfaceInset,
        borderWidth: 1,
        borderColor: colors.border,
    },
    inputShellFocused: {
        borderColor: colors.primary,
        backgroundColor: colors.surfaceRaised,
    },
    input: {
        flex: 1,
        minWidth: 0,
        paddingVertical: spacing.md,
        color: colors.text,
        fontSize: 16,
        fontWeight: fontWeights.bold,
    },
    menu: {
        overflow: "hidden",
        borderRadius: radius.lg,
        backgroundColor: colors.surfaceRaised,
        borderWidth: 1,
        borderColor: colors.borderStrong,
    },
    suggestion: {
        minHeight: 64,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.md,
    },
    suggestionDivider: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.separator,
    },
    suggestionPressed: {
        backgroundColor: colors.surfacePressed,
    },
    cover: {
        width: 44,
        height: 44,
        borderRadius: radius.sm,
        backgroundColor: colors.surface3,
    },
    coverFallback: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.sm,
        backgroundColor: colors.control,
    },
    copy: {
        flex: 1,
        minWidth: 0,
    },
    suggestionTitle: {
        color: colors.text,
        fontSize: typography.body,
        fontWeight: fontWeights.extraBold,
    },
    suggestionMeta: {
        marginTop: 3,
        color: colors.textMuted,
        fontSize: typography.caption,
        fontWeight: fontWeights.medium,
    },
    pickIcon: {
        transform: [{ rotate: "45deg" }],
    },
    emptyRow: {
        minHeight: 58,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
    },
    emptyText: {
        flex: 1,
        color: colors.textMuted,
        fontSize: typography.caption,
        lineHeight: 17,
        fontWeight: fontWeights.medium,
    },
});

export default memo(BlindTestAnswerInput);
