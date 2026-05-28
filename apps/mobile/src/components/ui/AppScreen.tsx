import React from "react";
import { View, StyleSheet, ViewProps } from "react-native";
import { colors, spacing } from "../../theme";

type Props = ViewProps & {
    padded?: boolean;
    paddingHorizontalSize?: number;
};

export default function AppScreen({
                                      children,
                                      padded = true,
                                      paddingHorizontalSize,
                                      style,
                                      ...rest
                                  }: Props) {
    return (
        <View
            style={[
                styles.container,
                padded && {
                    paddingHorizontal:
                        typeof paddingHorizontalSize === "number"
                            ? paddingHorizontalSize
                            : spacing.lg,
                },
                style,
            ]}
            {...rest}
        >
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
    },
});
