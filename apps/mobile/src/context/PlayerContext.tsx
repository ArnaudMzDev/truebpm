import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Audio, InterruptionModeIOS, InterruptionModeAndroid, AVPlaybackStatus } from "expo-av";

export type Track = {
    title: string;
    artist: string;
    url: string;

    // normalisé
    coverUrl?: string;

    // legacy tolérance
    cover?: string;
    artwork?: string;
};

type PlayerContextType = {
    currentTrack: Track | null;
    isPlaying: boolean;
    isLoaded: boolean;
    positionMs: number;
    durationMs: number;

    playPreview: (track: Track) => Promise<void>;
    togglePlay: () => Promise<void>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
    seekTo: (ms: number) => Promise<void>;
    stop: () => Promise<void>;
    close: () => Promise<void>;
};

const PlayerContext = createContext<PlayerContextType | null>(null);

function normalizeTrack(track: Track): Track {
    const coverUrl = track.coverUrl || track.cover || track.artwork || "";

    return {
        ...track,
        coverUrl,
    };
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
    const soundRef = useRef<Audio.Sound | null>(null);
    const mountedRef = useRef(true);

    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [positionMs, setPositionMs] = useState(0);
    const [durationMs, setDurationMs] = useState(1);

    useEffect(() => {
        mountedRef.current = true;

        Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
            interruptionModeIOS: InterruptionModeIOS.DoNotMix,
            interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
            playThroughEarpieceAndroid: false,
        }).catch((e) => {
            console.log("setAudioModeAsync error:", e);
        });

        return () => {
            mountedRef.current = false;

            const cleanup = async () => {
                try {
                    if (soundRef.current) {
                        soundRef.current.setOnPlaybackStatusUpdate(null);
                        await soundRef.current.stopAsync().catch(() => {});
                        await soundRef.current.unloadAsync().catch(() => {});
                        soundRef.current = null;
                    }
                } catch (e) {
                    console.log("player cleanup error:", e);
                }
            };

            cleanup().catch(() => {});
        };
    }, []);

    const resetState = useCallback(() => {
        if (!mountedRef.current) return;
        setCurrentTrack(null);
        setIsPlaying(false);
        setIsLoaded(false);
        setPositionMs(0);
        setDurationMs(1);
    }, []);

    const attachStatusListener = useCallback((sound: Audio.Sound) => {
        sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
            if (!mountedRef.current) return;

            if (!status.isLoaded) {
                setIsLoaded(false);
                setIsPlaying(false);
                return;
            }

            setIsLoaded(true);
            setIsPlaying(status.isPlaying);
            setPositionMs(status.positionMillis ?? 0);
            setDurationMs(status.durationMillis ?? 1);

            if (status.didJustFinish) {
                void (async () => {
                    try {
                        sound.setOnPlaybackStatusUpdate(null);
                        await sound.unloadAsync().catch(() => {});
                    } catch {}
                    if (soundRef.current === sound) {
                        soundRef.current = null;
                    }
                    resetState();
                })();
            }
        });
    }, [resetState]);

    const unloadCurrentSound = useCallback(async () => {
        const currentSound = soundRef.current;
        if (!currentSound) return;

        try {
            currentSound.setOnPlaybackStatusUpdate(null);
            await currentSound.stopAsync().catch(() => {});
            await currentSound.unloadAsync().catch(() => {});
        } catch (e) {
            console.log("unloadCurrentSound error:", e);
        } finally {
            if (soundRef.current === currentSound) {
                soundRef.current = null;
            }
        }
    }, []);

    const playPreview = useCallback(async (track: Track) => {
        const normalized = normalizeTrack(track);

        try {
            const existingTrack = currentTrack;
            const currentSound = soundRef.current;

            // même track déjà chargée
            if (
                existingTrack &&
                currentSound &&
                existingTrack.url === normalized.url
            ) {
                const status = await currentSound.getStatusAsync();

                if (status.isLoaded) {
                    if (status.isPlaying) {
                        return;
                    }

                    await currentSound.playAsync();
                    return;
                }
            }

            await unloadCurrentSound();

            const { sound, status } = await Audio.Sound.createAsync(
                { uri: normalized.url },
                {
                    shouldPlay: true,
                    progressUpdateIntervalMillis: 250,
                    positionMillis: 0,
                }
            );

            soundRef.current = sound;
            attachStatusListener(sound);

            if (!mountedRef.current) {
                sound.setOnPlaybackStatusUpdate(null);
                await sound.unloadAsync().catch(() => {});
                soundRef.current = null;
                return;
            }

            setCurrentTrack(normalized);

            if (status.isLoaded) {
                setIsLoaded(true);
                setIsPlaying(status.isPlaying ?? true);
                setPositionMs(status.positionMillis ?? 0);
                setDurationMs(status.durationMillis ?? 1);
            } else {
                setIsLoaded(false);
                setIsPlaying(false);
                setPositionMs(0);
                setDurationMs(1);
            }
        } catch (e) {
            console.log("playPreview error:", e);
            await unloadCurrentSound().catch(() => {});
            resetState();
        }
    }, [attachStatusListener, currentTrack, resetState, unloadCurrentSound]);

    const pause = useCallback(async () => {
        const sound = soundRef.current;
        if (!sound) return;

        try {
            const status = await sound.getStatusAsync();
            if (!status.isLoaded) return;
            if (!status.isPlaying) return;

            await sound.pauseAsync();
        } catch (e) {
            console.log("pause error:", e);
        }
    }, []);

    const resume = useCallback(async () => {
        const sound = soundRef.current;
        if (!sound) return;

        try {
            const status = await sound.getStatusAsync();
            if (!status.isLoaded) return;
            if (status.isPlaying) return;

            await sound.playAsync();
        } catch (e) {
            console.log("resume error:", e);
        }
    }, []);

    const togglePlay = useCallback(async () => {
        const sound = soundRef.current;
        if (!sound) return;

        try {
            const status = await sound.getStatusAsync();
            if (!status.isLoaded) return;

            if (status.isPlaying) {
                await sound.pauseAsync();
            } else {
                await sound.playAsync();
            }
        } catch (e) {
            console.log("togglePlay error:", e);
        }
    }, []);

    const seekTo = useCallback(async (ms: number) => {
        const sound = soundRef.current;
        if (!sound) return;

        try {
            const status = await sound.getStatusAsync();
            if (!status.isLoaded) return;

            const maxDuration = status.durationMillis ?? durationMs ?? 1;
            const nextMs = Math.max(0, Math.min(ms, maxDuration));

            await sound.setPositionAsync(nextMs);
        } catch (e) {
            console.log("seekTo error:", e);
        }
    }, [durationMs]);

    const stop = useCallback(async () => {
        await unloadCurrentSound();
        resetState();
    }, [resetState, unloadCurrentSound]);

    const close = useCallback(async () => {
        await stop();
    }, [stop]);

    const value = useMemo<PlayerContextType>(
        () => ({
            currentTrack,
            isPlaying,
            isLoaded,
            positionMs,
            durationMs,
            playPreview,
            togglePlay,
            pause,
            resume,
            seekTo,
            stop,
            close,
        }),
        [
            currentTrack,
            isPlaying,
            isLoaded,
            positionMs,
            durationMs,
            playPreview,
            togglePlay,
            pause,
            resume,
            seekTo,
            stop,
            close,
        ]
    );

    return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export const usePlayer = () => {
    const ctx = useContext(PlayerContext);
    if (!ctx) {
        throw new Error("usePlayer must be used inside PlayerProvider");
    }
    return ctx;
};