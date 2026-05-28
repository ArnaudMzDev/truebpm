import React from "react";
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
    ViewStyle,
    TextStyle,
} from "react-native";
import { colors, radius, spacing, typography, fontWeights, shadows } from "../../theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = {
    label: string;
    onPress?: () => void;
    loading?: boolean;
    disabled?: boolean;
    variant?: Variant;
    style?: ViewStyle;
    textStyle?: TextStyle;
};

export default function AppButton({
                                      label,
                                      onPress,
                                      loading = false,
                                      disabled = false,
                                      variant = "primary",
                                      style,
                                      textStyle,
                                  }: Props) {
    const isDisabled = disabled || loading;

    return (
        <TouchableOpacity
            activeOpacity={0.88}
            onPress={onPress}
            disabled={isDisabled}
            style={[
                styles.base,
                variant === "primary" && styles.primary,
                variant === "secondary" && styles.secondary,
                variant === "ghost" && styles.ghost,
                variant === "danger" && styles.danger,
                isDisabled && styles.disabled,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator
                    size="small"
                    color={variant === "ghost" ? colors.textMuted : colors.text}
                />
            ) : (
                <Text
                    style={[
                        styles.label,
                        variant === "ghost" && styles.ghostLabel,
                        variant === "secondary" && styles.secondaryLabel,
                        textStyle,
                    ]}
                >
                    {label}
                </Text>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    base: {
        minHeight: 48,
        borderRadius: radius.md,
        paddingHorizontal: spacing.lg,
        alignItems: "center",
        justifyContent: "center",
    },

    primary: {
        backgroundColor: colors.primaryDark,
        ...shadows.glowPrimary,
    },

    secondary: {
        backgroundColor: colors.surface3,
        borderWidth: 1,
        borderColor: colors.border,
    },

    ghost: {
        backgroundColor: "transparent",
        minHeight: 40,
        paddingHorizontal: spacing.md,
    },

    danger: {
        backgroundColor: "#2A1015",
        borderWidth: 1,
        borderColor: "#4A1E28",
    },

    disabled: {
        opacity: 0.65,
    },

    label: {
        color: colors.text,
        fontSize: typography.body,
        fontWeight: fontWeights.extraBold,
        letterSpacing: 0.1,
    },

    secondaryLabel: {
        color: colors.text,
    },

    ghostLabel: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
    },
});
