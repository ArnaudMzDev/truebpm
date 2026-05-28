import { NativeModules, Platform } from "react-native";

export type ShazamKitTrack = {
    entityType: "song";
    entityId: string | null;
    title: string;
    artist: string;
    album?: string;
    cover: string | null;
    previewUrl: string | null;
    songLink?: string | null;
    shazamId?: string | null;
    isrc?: string | null;
    genres?: string[];
    matchOffset?: number | null;
    confidence?: number | null;
};

export type ShazamKitResult = {
    matched: boolean;
    provider: "shazamkit";
    track?: ShazamKitTrack;
    error?: string;
};

type TrueBPMShazamNativeModule = {
    recognize: () => Promise<ShazamKitResult>;
    cancel?: () => void;
};

const nativeModule = NativeModules.TrueBPMShazam as TrueBPMShazamNativeModule | undefined;

export function isShazamKitAvailable() {
    return Platform.OS === "ios" && typeof nativeModule?.recognize === "function";
}

export async function recognizeWithShazamKit() {
    if (Platform.OS !== "ios") {
        throw new Error("ShazamKit Apple est disponible sur iOS dans cette version.");
    }

    if (!nativeModule?.recognize) {
        throw new Error("Le module natif ShazamKit n’est pas disponible. Lance une Expo dev build iOS.");
    }

    return nativeModule.recognize();
}
