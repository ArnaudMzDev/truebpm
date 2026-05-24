import { useMemo } from "react";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Options = {
    extra?: number;
    includeInset?: boolean;
};

export function useAppBottomSpacing(options?: Options) {
    const { extra = 24, includeInset = true } = options || {};
    const tabBarHeight = useBottomTabBarHeight();
    const insets = useSafeAreaInsets();

    return useMemo(() => {
        const inset = includeInset ? insets.bottom : 0;
        return tabBarHeight + inset + extra;
    }, [tabBarHeight, insets.bottom, extra, includeInset]);
}