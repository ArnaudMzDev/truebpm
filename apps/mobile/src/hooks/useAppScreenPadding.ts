import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../theme";

type Options = {
    horizontal?: number;
    topExtra?: number;
    bottomExtra?: number;
};

export function useAppScreenPadding(options?: Options) {
    const {
        horizontal = spacing.lg,
        topExtra = spacing.sm,
        bottomExtra = spacing.md,
    } = options || {};

    const insets = useSafeAreaInsets();

    return useMemo(
        () => ({
            paddingLeft: horizontal,
            paddingRight: horizontal,
            paddingTop: insets.top + topExtra,
            paddingBottom: insets.bottom + bottomExtra,
        }),
        [horizontal, insets.top, insets.bottom, topExtra, bottomExtra]
    );
}