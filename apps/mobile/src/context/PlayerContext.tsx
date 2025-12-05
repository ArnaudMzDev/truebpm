import React, { createContext, useState, useContext, useRef } from "react";
import { Audio, AVPlaybackStatusSuccess } from "expo-av";

type Track = {
    title: string;
    artist: string;
    cover: string;
    url: string;
};

type PlayerContextType = {
    currentTrack: Track | null;
    isPlaying: boolean;
    playPreview: (track: Track) => Promise<void>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
    stop: () => Promise<void>;
    togglePlay: () => Promise<void>;
};

const PlayerContext = createContext<PlayerContextType | null>(null);

export const PlayerProvider = ({ children }: any) => {
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const soundRef = useRef<Audio.Sound | null>(null);

    const playPreview = async (track: Track) => {
        try {
            // Stop old sound
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
            }

            const { sound } = await Audio.Sound.createAsync(
                { uri: track.url },
                { shouldPlay: true }
            );

            soundRef.current = sound;

            setCurrentTrack(track);
            setIsPlaying(true);

            sound.setOnPlaybackStatusUpdate((status) => {
                const s = status as AVPlaybackStatusSuccess;
                if (s.didJustFinish) {
                    setIsPlaying(false);
                }
            });
        } catch (err) {
            console.log("Audio play error:", err);
        }
    };

    const pause = async () => {
        if (soundRef.current) {
            await soundRef.current.pauseAsync();
            setIsPlaying(false);
        }
    };

    const resume = async () => {
        if (soundRef.current) {
            await soundRef.current.playAsync();
            setIsPlaying(true);
        }
    };

    const stop = async () => {
        if (soundRef.current) {
            await soundRef.current.stopAsync();
            setIsPlaying(false);
        }
    };

    // 🔥 ICI : togglePlay manquait !
    const togglePlay = async () => {
        if (!soundRef.current) return;

        if (isPlaying) {
            await pause();
        } else {
            await resume();
        }
    };

    return (
        <PlayerContext.Provider
            value={{
                currentTrack,
                isPlaying,
                playPreview,
                pause,
                resume,
                stop,
                togglePlay, // 🔥 ajouté ici
            }}
        >
            {children}
        </PlayerContext.Provider>
    );
};

export const usePlayer = () => useContext(PlayerContext)!;