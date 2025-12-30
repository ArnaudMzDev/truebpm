import React, { createContext, useContext, useRef, useState } from "react";
import { Audio, AVPlaybackStatusSuccess } from "expo-av";

export type Track = {
    title: string;
    artist: string;
    url: string;

    // Normalisé
    coverUrl?: string;

    // Tolérance legacy (pour ne rien casser)
    cover?: string;
    artwork?: string;
};

type PlayerContextType = {
    currentTrack: Track | null;
    isPlaying: boolean;
    positionMs: number;
    durationMs: number;

    playPreview: (track: Track) => Promise<void>;
    togglePlay: () => Promise<void>;
    seekTo: (ms: number) => Promise<void>;
    close: () => Promise<void>;
};

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
    const soundRef = useRef<Audio.Sound | null>(null);

    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [positionMs, setPositionMs] = useState(0);
    const [durationMs, setDurationMs] = useState(1);

    const unload = async () => {
        if (soundRef.current) {
            await soundRef.current.stopAsync();
            await soundRef.current.unloadAsync();
            soundRef.current = null;
        }
    };

    const normalizeTrack = (track: Track): Track => {
        const coverUrl =
            track.coverUrl ||
            track.cover ||
            track.artwork ||
            "";

        return {
            ...track,
            coverUrl,
        };
    };

    const playPreview = async (track: Track) => {
        try {
            await unload();

            const normalized = normalizeTrack(track);

            const { sound } = await Audio.Sound.createAsync(
                { uri: normalized.url },
                { shouldPlay: true }
            );

            soundRef.current = sound;
            setCurrentTrack(normalized);
            setIsPlaying(true);

            sound.setOnPlaybackStatusUpdate((status) => {
                const s = status as AVPlaybackStatusSuccess;
                if (!s.isLoaded) return;

                setPositionMs(s.positionMillis ?? 0);
                setDurationMs(s.durationMillis ?? 1);
                setIsPlaying(s.isPlaying);

                if (s.didJustFinish) {
                    close();
                }
            });
        } catch (e) {
            console.log("Audio error:", e);
        }
    };

    const togglePlay = async () => {
        if (!soundRef.current) return;

        if (isPlaying) {
            await soundRef.current.pauseAsync();
        } else {
            await soundRef.current.playAsync();
        }
    };

    const seekTo = async (ms: number) => {
        if (!soundRef.current) return;
        await soundRef.current.setPositionAsync(ms);
    };

    const close = async () => {
        await unload();
        setCurrentTrack(null);
        setIsPlaying(false);
        setPositionMs(0);
        setDurationMs(1);
    };

    return (
        <PlayerContext.Provider
            value={{
                currentTrack,
                isPlaying,
                positionMs,
                durationMs,
                playPreview,
                togglePlay,
                seekTo,
                close,
            }}
        >
            {children}
        </PlayerContext.Provider>
    );
}

export const usePlayer = () => {
    const ctx = useContext(PlayerContext);
    if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
    return ctx;
};