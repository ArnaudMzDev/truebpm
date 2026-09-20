import { randomInt } from "crypto";
import BlindTestRoom from "@/models/BlindTestRoom";
import BlindTestTrack from "@/models/BlindTestTrack";

export type BlindRoomDifficulty = "easy" | "normal" | "hard" | "expert";
export type BlindRoomAnswerMode = "free" | "qcm" | "mixed";
export type BlindRoomTarget = "title" | "artist" | "both" | "mixed";
export type BlindRoomPlayMode = "casual" | "competitive";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const ROUND_DURATIONS: Record<BlindRoomDifficulty, number> = {
    easy: 25000,
    normal: 20000,
    hard: 15000,
    expert: 10000,
};

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function boolValue(value: unknown, fallback: boolean) {
    return typeof value === "boolean" ? value : fallback;
}

export function expiresAtFromNow() {
    return new Date(Date.now() + ROOM_TTL_MS);
}

export function normalizeRoomCode(value: unknown) {
    return typeof value === "string"
        ? value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)
        : "";
}

export async function createUniqueRoomCode() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        let code = "";
        for (let index = 0; index < 5; index += 1) {
            code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
        }
        const exists = await BlindTestRoom.exists({ code });
        if (!exists) return code;
    }
    throw new Error("Impossible de créer un code de salon.");
}

export function parseRoomSettings(body: any, fallbackDifficulty: BlindRoomDifficulty = "normal") {
    const roundCount = [5, 10, 20, 30].includes(Number(body?.roundCount))
        ? Number(body.roundCount)
        : 5;
    const difficulty: BlindRoomDifficulty = ["easy", "normal", "hard", "expert"].includes(body?.difficulty)
        ? body.difficulty
        : fallbackDifficulty;
    const answerMode: BlindRoomAnswerMode = ["free", "qcm", "mixed"].includes(body?.answerMode)
        ? body.answerMode
        : "mixed";
    const target: BlindRoomTarget = ["title", "artist", "both", "mixed"].includes(body?.target)
        ? body.target
        : answerMode === "free"
            ? "both"
            : "mixed";
    const playMode: BlindRoomPlayMode = body?.playMode === "competitive" ? "competitive" : "casual";
    const region = ["france", "international", "mixed"].includes(body?.region)
        ? body.region
        : "mixed";
    const maxPlayers = clamp(Number(body?.maxPlayers) || 6, 2, 8);
    const excerptSeconds = clamp(Number(body?.excerptSeconds) || Math.round(ROUND_DURATIONS[difficulty] / 1000), 8, 30);

    return {
        roundCount,
        difficulty,
        answerMode,
        target,
        roundDurationMs: excerptSeconds * 1000,
        maxPlayers,
        allowSpectators: boolValue(body?.allowSpectators, false),
        hintsEnabled: boolValue(body?.hintsEnabled, true),
        region,
        playMode,
    };
}

export function isRoomExpired(room: any) {
    const expiresAt = room?.expiresAt ? new Date(room.expiresAt) : null;
    return !!expiresAt && expiresAt.getTime() <= Date.now();
}

export async function expireRoomIfNeeded(room: any) {
    if (!room || !isRoomExpired(room) || room.status === "expired") return room;
    return BlindTestRoom.findByIdAndUpdate(
        room._id,
        { $set: { status: "expired" } },
        { new: true }
    ).lean();
}

function playerPayload(player: any, hostId: string, meId?: string) {
    const userId = String(player.userId || "");
    return {
        userId,
        pseudo: player.pseudo || "Joueur",
        avatarUrl: player.avatarUrl || "",
        role: player.role || "player",
        ready: !!player.ready,
        connected: !!player.connected,
        joinedAt: player.joinedAt,
        lastSeenAt: player.lastSeenAt,
        score: Number(player.score || 0),
        streak: Number(player.streak || 0),
        isHost: userId === hostId,
        isMe: meId ? userId === meId : false,
        answeredRound: Number(player.answeredRound ?? -1),
    };
}

async function currentRoundPayload(room: any) {
    const round = room?.rounds?.[Number(room.currentRound || 0)];
    if (!round || room.status === "lobby") return null;

    const track = await BlindTestTrack.findById(round.trackId)
        .select("_id previewUrl artworkUrl")
        .lean();
    if (!track) return null;

    return {
        index: Number(room.currentRound || 0),
        number: Number(room.currentRound || 0) + 1,
        total: Array.isArray(room.rounds) ? room.rounds.length : 0,
        questionType: round.questionType,
        options: round.options || [],
        optionArtworks: round.optionArtworks || [],
        previewUrl: (track as any).previewUrl || "",
        artworkUrl: (track as any).artworkUrl || "",
        startsAt: round.startedAt,
        endsAt: round.endsAt,
    };
}

export async function serializeRoom(room: any, meId?: string) {
    const hostId = String(room.hostId || "");
    const players = [...(room.players || [])]
        .sort((left: any, right: any) => new Date(left.joinedAt).getTime() - new Date(right.joinedAt).getTime())
        .map((player: any) => playerPayload(player, hostId, meId));

    return {
        id: String(room._id),
        code: room.code,
        status: room.status,
        serverNow: new Date().toISOString(),
        hostId,
        blindTest: {
            id: String(room.blindTestId),
            slug: room.blindTestSlug,
            title: room.blindTestTitle,
            coverUrl: room.blindTestCoverUrl || "",
        },
        settings: room.settings,
        players,
        currentRound: await currentRoundPayload(room),
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
        startedAt: room.startedAt,
        expiresAt: room.expiresAt,
    };
}

export function playerCount(room: any) {
    return (room?.players || []).filter((player: any) => player.role === "player").length;
}

export function activePlayers(room: any) {
    return (room?.players || []).filter((player: any) => player.role === "player");
}
