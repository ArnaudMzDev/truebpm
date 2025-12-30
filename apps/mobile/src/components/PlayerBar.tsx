import React, { useState } from "react";
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    Modal,
} from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlayer } from "../context/PlayerContext";

function format(ms: number) {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function Cover({
                   uri,
                   size,
                   radius,
               }: {
    uri?: string;
    size: number;
    radius: number;
}) {
    if (!uri) {
        return (
            <View
                style={{
                    width: size,
                    height: size,
                    borderRadius: radius,
                    backgroundColor: "#1a1a1a",
                    borderWidth: 1,
                    borderColor: "#2a2a2a",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Ionicons name="musical-notes" size={22} color="#777" />
            </View>
        );
    }

    return (
        <Image
            source={{ uri }}
            style={{
                width: size,
                height: size,
                borderRadius: radius,
                backgroundColor: "#111",
            }}
        />
    );
}

export default function PlayerBar() {
    const {
        currentTrack,
        isPlaying,
        togglePlay,
        seekTo,
        positionMs,
        durationMs,
        close,
    } = usePlayer();

    const [expanded, setExpanded] = useState(false);
    const insets = useSafeAreaInsets();

    if (!currentTrack) return null;

    const coverUri = currentTrack.coverUrl || "";

    return (
        <>
            {/* MINI BAR */}
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setExpanded(true)}
                style={[styles.bar, { paddingBottom: insets.bottom + 8 }]}
            >
                <Cover uri={coverUri} size={48} radius={6} />

                <View style={styles.info}>
                    <Text numberOfLines={1} style={styles.title}>
                        {currentTrack.title}
                    </Text>
                    <Text numberOfLines={1} style={styles.artist}>
                        {currentTrack.artist}
                    </Text>
                </View>

                <TouchableOpacity onPress={togglePlay} style={styles.iconBtn}>
                    <Ionicons
                        name={isPlaying ? "pause" : "play"}
                        size={26}
                        color="#fff"
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={async () => {
                        setExpanded(false);
                        await close();
                    }}
                    style={styles.iconBtn}
                >
                    <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
            </TouchableOpacity>

            {/* FULL PLAYER */}
            <Modal visible={expanded} animationType="slide" transparent={false}>
                <View
                    style={[
                        styles.full,
                        {
                            paddingTop: insets.top + 12,
                            paddingBottom: insets.bottom + 18,
                        },
                    ]}
                >
                    {/* TOP BAR */}
                    <View style={styles.fullTopBar}>
                        <TouchableOpacity onPress={() => setExpanded(false)} style={styles.topBtn}>
                            <Ionicons name="chevron-down" size={28} color="#fff" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={async () => {
                                setExpanded(false);
                                await close();
                            }}
                            style={styles.topBtn}
                        >
                            <Ionicons name="close" size={26} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {/* CONTENT */}
                    <View style={styles.fullContent}>
                        <Cover uri={coverUri} size={300} radius={18} />

                        <Text style={styles.fullTitle} numberOfLines={2}>
                            {currentTrack.title}
                        </Text>
                        <Text style={styles.fullArtist} numberOfLines={1}>
                            {currentTrack.artist}
                        </Text>
                    </View>

                    {/* CONTROLS (descendus et safe-area safe) */}
                    <View style={styles.bottomArea}>
                        <Slider
                            style={{ width: "100%" }}
                            minimumValue={0}
                            maximumValue={durationMs || 1}
                            value={Math.min(positionMs, durationMs || 1)}
                            onSlidingComplete={seekTo}
                            minimumTrackTintColor="#9B5CFF"
                            maximumTrackTintColor="#333"
                            thumbTintColor="#9B5CFF"
                        />

                        <View style={styles.timeRow}>
                            <Text style={styles.time}>{format(positionMs)}</Text>
                            <Text style={styles.time}>{format(durationMs)}</Text>
                        </View>

                        <View style={styles.controls}>
                            <TouchableOpacity onPress={togglePlay} style={styles.playCircle}>
                                <Ionicons
                                    name={isPlaying ? "pause" : "play"}
                                    size={34}
                                    color="#fff"
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    bar: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#111",
        borderTopWidth: 1,
        borderTopColor: "#222",
        paddingHorizontal: 12,
        paddingTop: 10,
        zIndex: 999,
    },
    info: {
        flex: 1,
        marginLeft: 12,
        marginRight: 8,
    },
    title: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "700",
    },
    artist: {
        color: "#aaa",
        fontSize: 12,
        marginTop: 2,
    },
    iconBtn: {
        padding: 8,
    },

    full: {
        flex: 1,
        backgroundColor: "#000",
        paddingHorizontal: 24,
    },
    fullTopBar: {
        width: "100%",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingBottom: 10,
    },
    topBtn: {
        padding: 8,
    },
    fullContent: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 10,
    },
    fullTitle: {
        color: "#fff",
        fontSize: 22,
        fontWeight: "800",
        marginTop: 22,
        textAlign: "center",
    },
    fullArtist: {
        color: "#aaa",
        fontSize: 16,
        marginTop: 6,
    },
    bottomArea: {
        width: "100%",
        paddingTop: 10,
    },
    timeRow: {
        width: "100%",
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 8,
    },
    time: {
        color: "#aaa",
        fontSize: 12,
    },
    controls: {
        alignItems: "center",
        marginTop: 22,
    },
    playCircle: {
        width: 74,
        height: 74,
        borderRadius: 37,
        backgroundColor: "#1a1a1a",
        borderWidth: 1,
        borderColor: "#2a2a2a",
        alignItems: "center",
        justifyContent: "center",
    },
});