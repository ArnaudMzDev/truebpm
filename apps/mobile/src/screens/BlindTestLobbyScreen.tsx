import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Image,
    Pressable,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { io, Socket } from "socket.io-client";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppScreen from "../components/ui/AppScreen";
import AppTopBar from "../components/ui/AppTopBar";
import AppScreenLoader from "../components/ui/AppScreenLoader";
import AppButton from "../components/ui/AppButton";
import {
    BlindTestRoom,
    getBlindTestRoom,
    leaveBlindTestRoom,
    setBlindTestRoomReady,
    startBlindTestRoom,
} from "../lib/blindTestApi";
import { getStoredToken } from "../lib/authStorage";
import { SOCKET_URL } from "../lib/config";
import { colors, fontWeights, radius, spacing, typography } from "../theme";

function normalizeCode(value: string) {
    return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function formatMode(room: BlindTestRoom) {
    const format =
        room.settings.answerMode === "qcm"
            ? "QCM"
            : room.settings.answerMode === "free"
                ? "Libre"
                : "Mixte";
    const mode = room.settings.playMode === "competitive" ? "Compétitif" : "Casual";
    return `${room.settings.roundCount} manches · ${format} · ${mode}`;
}

function PlayerAvatar({ player }: { player: BlindTestRoom["players"][number] }) {
    if (player.avatarUrl) {
        return <Image source={{ uri: player.avatarUrl }} style={styles.avatar} />;
    }

    return (
        <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>{player.pseudo.slice(0, 1).toUpperCase()}</Text>
        </View>
    );
}

export default function BlindTestLobbyScreen({ route, navigation }: any) {
    const insets = useSafeAreaInsets();
    const code = normalizeCode(String(route.params?.code || ""));
    const socketRef = useRef<Socket | null>(null);
    const [room, setRoom] = useState<BlindTestRoom | null>(null);
    const [meId, setMeId] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [busy, setBusy] = useState<"ready" | "start" | "leave" | null>(null);
    const [error, setError] = useState("");

    const load = useCallback(async (refresh = false) => {
        if (!code) return;
        if (refresh) setRefreshing(true);
        else setLoading(true);
        setError("");

        try {
            const [{ room: nextRoom }, rawUser] = await Promise.all([
                getBlindTestRoom(code),
                AsyncStorage.getItem("user"),
            ]);
            setRoom(nextRoom);
            if (rawUser) {
                try {
                    setMeId(String(JSON.parse(rawUser)?._id || ""));
                } catch {}
            }
        } catch (loadError: any) {
            setError(loadError?.message || "Impossible de charger le salon.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [code]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        let alive = true;

        (async () => {
            const token = await getStoredToken();
            if (!token || !code || !alive) return;

            const socket = io(SOCKET_URL, {
                transports: ["websocket", "polling"],
                auth: { token },
                reconnection: true,
            });
            socketRef.current = socket;

            socket.on("connect", () => {
                socket.emit("blind-room:join", { code });
            });

            socket.on("blind-room:update", ({ room: nextRoom }: { room: BlindTestRoom }) => {
                if (!alive || nextRoom?.code !== code) return;
                setRoom(nextRoom);
            });

            socket.on("blind-room:closed", () => {
                if (!alive) return;
                setError("Le salon a été fermé.");
            });
        })();

        return () => {
            alive = false;
            const socket = socketRef.current;
            if (socket) {
                socket.emit("blind-room:leave", { code });
                socket.removeAllListeners();
                socket.disconnect();
            }
            socketRef.current = null;
        };
    }, [code]);

    const me = useMemo(() => {
        if (!room) return null;
        return room.players.find((player) => player.userId === meId || player.isMe) || null;
    }, [meId, room]);

    const isHost = !!room && !!me && room.hostId === me.userId;
    const players = room?.players.filter((player) => player.role === "player") || [];
    const readyCount = players.filter((player) => player.ready).length;
    const canStart = !!room && isHost && room.status === "lobby" && players.length >= 2 && readyCount === players.length;

    function emitRefresh() {
        socketRef.current?.emit("blind-room:refresh", { code });
    }

    async function toggleReady() {
        if (!room || !me || busy) return;
        setBusy("ready");
        setError("");
        try {
            const nextReady = !me.ready;
            const response = await setBlindTestRoomReady(room.code, nextReady);
            setRoom(response.room);
            socketRef.current?.emit("blind-room:ready", { code: room.code, ready: nextReady });
            emitRefresh();
        } catch (readyError: any) {
            setError(readyError?.message || "Impossible de changer ton statut.");
        } finally {
            setBusy(null);
        }
    }

    async function startRoom() {
        if (!room || busy) return;
        setBusy("start");
        setError("");
        try {
            const response = await startBlindTestRoom(room.code);
            setRoom(response.room);
            emitRefresh();
        } catch (startError: any) {
            setError(startError?.message || "Impossible de lancer la partie.");
        } finally {
            setBusy(null);
        }
    }

    async function leaveRoom() {
        if (!room || busy) {
            navigation.goBack();
            return;
        }
        setBusy("leave");
        try {
            await leaveBlindTestRoom(room.code);
            socketRef.current?.emit("blind-room:leave", { code: room.code });
            navigation.goBack();
        } catch {
            navigation.goBack();
        } finally {
            setBusy(null);
        }
    }

    async function shareRoom() {
        if (!room) return;
        await Share.share({
            message: `Rejoins mon blind test TrueBPM avec le code ${room.code}`,
        });
    }

    if (loading && !room) return <AppScreenLoader label="Ouverture du salon..." />;

    return (
        <AppScreen padded={false}>
            <View style={styles.topPad}>
                <AppTopBar title="Salon privé" subtitle={room?.blindTest.title || code} onBack={leaveRoom} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
                contentContainerStyle={[
                    styles.content,
                    { paddingBottom: 118 + Math.max(insets.bottom, spacing.md) },
                ]}
            >
                {error ? (
                    <View style={styles.errorBox}>
                        <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                {room ? (
                    <>
                        <View style={styles.hero}>
                            {room.blindTest.coverUrl ? (
                                <Image source={{ uri: room.blindTest.coverUrl }} style={styles.heroCover} />
                            ) : (
                                <View style={styles.heroCoverFallback}>
                                    <Ionicons name="musical-notes-outline" size={34} color={colors.primary} />
                                </View>
                            )}
                            <View style={styles.heroCopy}>
                                <Text style={styles.eyebrow}>Code salon</Text>
                                <Text style={styles.code}>{room.code}</Text>
                                <Text style={styles.heroTitle} numberOfLines={1}>{room.blindTest.title}</Text>
                                <Text style={styles.heroMeta}>{formatMode(room)}</Text>
                            </View>
                            <Pressable style={styles.shareButton} onPress={shareRoom}>
                                <Ionicons name="share-outline" size={20} color={colors.text} />
                            </Pressable>
                        </View>

                        {room.status === "active" ? (
                            <View style={styles.activeNotice}>
                                <Ionicons name="radio-outline" size={22} color={colors.primary} />
                                <View style={styles.flex}>
                                    <Text style={styles.noticeTitle}>Partie lancée</Text>
                                    <Text style={styles.noticeText}>
                                        Le lobby temps réel est prêt. L’écran de jeu multijoueur arrive à l’étape suivante.
                                    </Text>
                                </View>
                            </View>
                        ) : null}

                        <View style={styles.statsRow}>
                            <View style={styles.stat}>
                                <Text style={styles.statValue}>{players.length}/{room.settings.maxPlayers}</Text>
                                <Text style={styles.statLabel}>Joueurs</Text>
                            </View>
                            <View style={styles.stat}>
                                <Text style={styles.statValue}>{readyCount}/{players.length || 1}</Text>
                                <Text style={styles.statLabel}>Prêts</Text>
                            </View>
                            <View style={styles.stat}>
                                <Text style={styles.statValue}>{Math.round(room.settings.roundDurationMs / 1000)}s</Text>
                                <Text style={styles.statLabel}>Extrait</Text>
                            </View>
                        </View>

                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Joueurs</Text>
                                <Text style={styles.sectionMeta}>{isHost ? "Tu es l’hôte" : "En attente de l’hôte"}</Text>
                            </View>

                            {room.players.map((player) => (
                                <View key={player.userId} style={styles.playerRow}>
                                    <PlayerAvatar player={player} />
                                    <View style={styles.flex}>
                                        <View style={styles.nameRow}>
                                            <Text style={styles.playerName} numberOfLines={1}>
                                                {player.pseudo}
                                            </Text>
                                            {player.isHost ? (
                                                <View style={styles.hostPill}>
                                                    <Text style={styles.hostText}>Hôte</Text>
                                                </View>
                                            ) : null}
                                        </View>
                                        <Text style={styles.playerMeta}>
                                            {player.connected ? "Connecté" : "Hors ligne"}
                                        </Text>
                                    </View>
                                    <View style={[styles.readyPill, player.ready && styles.readyPillActive]}>
                                        <Ionicons
                                            name={player.ready ? "checkmark" : "time-outline"}
                                            size={14}
                                            color={player.ready ? colors.bg : colors.textMuted}
                                        />
                                        <Text style={[styles.readyText, player.ready && styles.readyTextActive]}>
                                            {player.ready ? "Prêt" : "Attente"}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>

                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Réglages</Text>
                                <Text style={styles.sectionMeta}>{room.settings.playMode === "competitive" ? "Strict" : "Souple"}</Text>
                            </View>
                            <View style={styles.settingsGrid}>
                                <View style={styles.settingTile}>
                                    <Text style={styles.settingLabel}>Réponse</Text>
                                    <Text style={styles.settingValue}>{room.settings.answerMode}</Text>
                                </View>
                                <View style={styles.settingTile}>
                                    <Text style={styles.settingLabel}>Cible</Text>
                                    <Text style={styles.settingValue}>{room.settings.target}</Text>
                                </View>
                                <View style={styles.settingTile}>
                                    <Text style={styles.settingLabel}>Difficulté</Text>
                                    <Text style={styles.settingValue}>{room.settings.difficulty}</Text>
                                </View>
                                <View style={styles.settingTile}>
                                    <Text style={styles.settingLabel}>Indices</Text>
                                    <Text style={styles.settingValue}>{room.settings.hintsEnabled ? "Oui" : "Non"}</Text>
                                </View>
                            </View>
                        </View>
                    </>
                ) : null}
            </ScrollView>

            {room ? (
                <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
                    <AppButton
                        label={me?.ready ? "Pas prêt" : "Je suis prêt"}
                        variant={me?.ready ? "secondary" : "primary"}
                        loading={busy === "ready"}
                        disabled={room.status !== "lobby"}
                        onPress={toggleReady}
                        style={styles.bottomButton}
                    />
                    {isHost ? (
                        <AppButton
                            label="Lancer"
                            loading={busy === "start"}
                            disabled={!canStart}
                            onPress={startRoom}
                            style={styles.bottomButton}
                        />
                    ) : null}
                </View>
            ) : null}
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    topPad: { paddingHorizontal: spacing.lg },
    content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
    flex: { flex: 1, minWidth: 0 },
    errorBox: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.md,
        backgroundColor: colors.dangerSoft,
    },
    errorText: { flex: 1, color: colors.danger, fontSize: typography.bodySm, fontWeight: fontWeights.bold },
    hero: {
        minHeight: 132,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.xxl,
        backgroundColor: colors.surfaceFeed,
        borderWidth: 1,
        borderColor: colors.border,
    },
    heroCover: { width: 92, height: 92, borderRadius: radius.lg, backgroundColor: colors.surface2 },
    heroCoverFallback: {
        width: 92,
        height: 92,
        borderRadius: radius.lg,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface2,
    },
    heroCopy: { flex: 1, minWidth: 0 },
    eyebrow: { color: colors.primary, fontSize: typography.tiny, fontWeight: fontWeights.black, letterSpacing: 2.5 },
    code: { marginTop: 2, color: colors.text, fontSize: 34, lineHeight: 39, fontWeight: fontWeights.black, letterSpacing: 4 },
    heroTitle: { color: colors.textSoft, fontSize: typography.body, fontWeight: fontWeights.extraBold },
    heroMeta: { marginTop: 4, color: colors.textMuted, fontSize: typography.caption, fontWeight: fontWeights.medium },
    shareButton: {
        width: 44,
        height: 44,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surfaceRaised,
    },
    activeNotice: {
        flexDirection: "row",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.xl,
        backgroundColor: colors.primaryFaint,
        borderWidth: 1,
        borderColor: colors.borderAccent,
    },
    noticeTitle: { color: colors.text, fontSize: typography.body, fontWeight: fontWeights.black },
    noticeText: { marginTop: 3, color: colors.textMuted, fontSize: typography.caption, lineHeight: 18 },
    statsRow: { flexDirection: "row", gap: spacing.sm },
    stat: {
        flex: 1,
        minHeight: 74,
        justifyContent: "center",
        paddingHorizontal: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: colors.surface2,
    },
    statValue: { color: colors.text, fontSize: typography.subtitle, fontWeight: fontWeights.black, textAlign: "center" },
    statLabel: { marginTop: 3, color: colors.textMuted, fontSize: typography.caption, fontWeight: fontWeights.bold, textAlign: "center" },
    section: { gap: spacing.md },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: spacing.md },
    sectionTitle: { color: colors.text, fontSize: typography.subtitle, fontWeight: fontWeights.black },
    sectionMeta: { color: colors.textMuted, fontSize: typography.caption, fontWeight: fontWeights.bold },
    playerRow: {
        minHeight: 72,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: colors.separator,
    },
    avatar: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.surface2 },
    avatarFallback: {
        width: 48,
        height: 48,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primaryFaint,
        borderWidth: 1,
        borderColor: colors.borderAccent,
    },
    avatarInitial: { color: colors.text, fontSize: typography.body, fontWeight: fontWeights.black },
    nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    playerName: { flexShrink: 1, color: colors.text, fontSize: typography.body, fontWeight: fontWeights.extraBold },
    playerMeta: { marginTop: 2, color: colors.textMuted, fontSize: typography.caption, fontWeight: fontWeights.medium },
    hostPill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.primaryFaint },
    hostText: { color: colors.primary, fontSize: 10, fontWeight: fontWeights.black, textTransform: "uppercase" },
    readyPill: {
        minHeight: 34,
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceRaised,
    },
    readyPillActive: { backgroundColor: colors.accentMuted },
    readyText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: fontWeights.black },
    readyTextActive: { color: colors.bg },
    settingsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    settingTile: {
        width: "48%",
        minHeight: 66,
        justifyContent: "center",
        paddingHorizontal: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: colors.surface2,
    },
    settingLabel: { color: colors.textMuted, fontSize: typography.caption, fontWeight: fontWeights.bold },
    settingValue: { marginTop: 3, color: colors.text, fontSize: typography.body, fontWeight: fontWeights.black, textTransform: "capitalize" },
    bottomBar: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: "row",
        gap: spacing.sm,
        paddingTop: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.surface,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
    },
    bottomButton: { flex: 1 },
});
