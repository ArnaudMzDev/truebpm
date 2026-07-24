import { API_URL } from "./config";
import { getStoredToken } from "./authStorage";

export type BlindTestDifficulty = "easy" | "normal" | "hard" | "expert";
export type BlindTestAnswerMode = "free" | "qcm" | "mixed";
export type BlindTestTarget = "title" | "artist" | "both" | "mixed";
export type BlindTestQuestionType = "title" | "artist" | "both" | "qcm-title" | "qcm-artist";

export type BlindTestSuggestion = {
    id: string;
    type: "song" | "artist";
    title: string;
    artist: string;
    coverUrl: string;
};

export type BlindTestCategory = {
    id: string;
    slug: string;
    title: string;
    description: string;
    difficulty: BlindTestDifficulty;
    region: "france" | "international" | "mixed";
    tags: string[];
    featured: boolean;
    coverUrl: string;
    roundCounts: number[];
    gamesCount: number;
    averageScore: number;
    bestScore: number;
};

export type BlindTestReveal = {
    correct: {
        title: string;
        artist: string;
        album: string;
        year: number | null;
        artworkUrl: string;
        previewUrl: string;
    };
    submitted: { title: string; artist: string };
    titleCorrect: boolean;
    artistCorrect: boolean;
    timedOut: boolean;
    score: {
        artist?: number;
        title?: number;
        speed?: number;
        streak?: number;
        noHint?: number;
        hintPenalty?: number;
        total?: number;
    };
};

export type BlindTestSession = {
    sessionId: string;
    status: "active" | "completed" | "abandoned";
    blindTest: { id: string; slug: string; title: string };
    rules: {
        roundCount: number;
        difficulty: BlindTestDifficulty;
        answerMode: BlindTestAnswerMode;
        target: BlindTestTarget;
        roundDurationMs: number;
    };
    score: number;
    streak: number;
    bestStreak: number;
    round: {
        index: number;
        number: number;
        total: number;
        questionType: BlindTestQuestionType;
        options: string[];
        optionArtworks?: string[];
        previewUrl: string;
        startedAt: string;
        endsAt: string;
        answered: boolean;
        hintsUsed: string[];
    };
    reveal?: BlindTestReveal;
};

export type BlindTestResult = {
    sessionId: string;
    blindTest: { id: string; slug: string; title: string };
    rules: BlindTestSession["rules"];
    score: number;
    roundCount: number;
    titlesFound: number;
    artistsFound: number;
    accuracy: number;
    titleAccuracy: number;
    artistAccuracy: number;
    averageTimeMs: number;
    bestStreak: number;
    rank: number;
    personalBest: number;
    isPersonalBest: boolean;
    completedAt: string;
    rounds: Array<{ index: number; questionType: BlindTestQuestionType } & BlindTestReveal>;
};

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await getStoredToken();
    if (!token) throw new Error("Session expirée. Reconnecte-toi.");

    const response = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(init?.headers || {}),
        },
    });
    const text = await response.text();
    let data: any = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            if (__DEV__) {
                console.log("Blind Test non-JSON response:", response.status, text.slice(0, 160));
            }
            throw new Error(
                response.status === 404
                    ? "Le Blind Test n’est pas disponible sur ce serveur. Vérifie l’adresse de l’API."
                    : "L’API TrueBPM ne répond pas correctement. Réessaie dans un instant."
            );
        }
    }
    if (!response.ok) throw new Error(data?.error || "Action impossible.");
    return data as T;
}

export async function searchBlindTestSuggestions(
    kind: "title" | "artist",
    query: string,
    signal?: AbortSignal
): Promise<BlindTestSuggestion[]> {
    const cleanQuery = query.trim();
    if (cleanQuery.length < 2) return [];

    const params = new URLSearchParams({
        type: kind === "title" ? "song" : "artist",
        q: cleanQuery,
    });
    const response = await fetch(`${API_URL}/api/search/apple?${params.toString()}`, {
        headers: { Accept: "application/json" },
        signal,
    });
    const text = await response.text();
    let data: any = null;

    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        throw new Error("Les suggestions musicales sont momentanément indisponibles.");
    }

    if (!response.ok || !Array.isArray(data?.items)) {
        throw new Error(data?.error || "Les suggestions musicales sont momentanément indisponibles.");
    }

    return data.items
        .map((item: any): BlindTestSuggestion | null => {
            if (kind === "artist") {
                const name = String(item?.name || item?.title || "").trim();
                if (!name) return null;
                return {
                    id: String(item?.id || `artist:${name.toLowerCase()}`),
                    type: "artist",
                    title: name,
                    artist: name,
                    coverUrl: String(item?.cover || ""),
                };
            }

            const title = String(item?.title || "").trim();
            const artist = String(item?.artist || "").trim();
            if (!title) return null;
            return {
                id: String(item?.id || `song:${title}:${artist}`),
                type: "song",
                title,
                artist,
                coverUrl: String(item?.cover || ""),
            };
        })
        .filter((item: BlindTestSuggestion | null): item is BlindTestSuggestion => !!item)
        .slice(0, 5);
}

export function getBlindTestCatalog() {
    return apiRequest<{
        categories: BlindTestCategory[];
        recent: Array<{
            id: string;
            slug: string;
            title: string;
            score: number;
            roundCount: number;
            completedAt: string;
        }>;
        active: null | {
            id: string;
            slug: string;
            title: string;
            currentRound: number;
            roundCount: number;
            updatedAt: string;
        };
        stats: { games: number; bestScore: number; averageScore: number };
    }>("/api/blind-test/catalog");
}

export function startBlindTest(input: {
    blindTestId: string;
    roundCount: number;
    difficulty: BlindTestDifficulty;
    answerMode: BlindTestAnswerMode;
    target: BlindTestTarget;
}) {
    return apiRequest<{ session: BlindTestSession }>("/api/blind-test/sessions", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function getBlindTestSession(sessionId: string) {
    return apiRequest<{ session?: BlindTestSession; result?: BlindTestResult }>(
        `/api/blind-test/sessions/${encodeURIComponent(sessionId)}`
    );
}

export function submitBlindTestAnswer(
    sessionId: string,
    input: { roundIndex: number; title?: string; artist?: string; choice?: string }
) {
    return apiRequest<{
        completed: boolean;
        session?: BlindTestSession;
        result?: BlindTestResult;
    }>(`/api/blind-test/sessions/${encodeURIComponent(sessionId)}/answer`, {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function continueBlindTest(sessionId: string) {
    return apiRequest<{ session: BlindTestSession }>(
        `/api/blind-test/sessions/${encodeURIComponent(sessionId)}/next`,
        { method: "POST", body: "{}" }
    );
}

export function requestBlindTestHint(sessionId: string) {
    return apiRequest<{
        hint: { key: string; label: string; value: string; penalty: number };
    }>(`/api/blind-test/sessions/${encodeURIComponent(sessionId)}/hint`, {
        method: "POST",
        body: "{}",
    });
}

export function getBlindTestLeaderboard(blindTestId: string) {
    return apiRequest<{
        blindTest: { slug: string; title: string };
        entries: Array<{
            rank: number;
            userId: string;
            pseudo: string;
            avatarUrl: string;
            score: number;
            games: number;
            bestStreak: number;
            isMe: boolean;
        }>;
        me: null | {
            rank: number;
            score: number;
            bestStreak: number;
        };
    }>(`/api/blind-test/leaderboard?blindTestId=${encodeURIComponent(blindTestId)}`);
}
