import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import { blindTestFlags } from "@/lib/blindTest/flags";
import { ensureOfficialBlindTests, getPlayableTracks } from "@/lib/blindTest/catalog";
import { buildRounds, parseGameRules, roundTimes, serializeSession } from "@/lib/blindTest/session";
import BlindTest from "@/models/BlindTest";
import BlindTestSession from "@/models/BlindTestSession";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        await connectDB();
        const userId = await requireUserId(req);
        if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        if (!blindTestFlags.global) {
            return NextResponse.json({ error: "Le Blind Test est temporairement indisponible." }, { status: 503 });
        }

        const body = await req.json().catch(() => null);
        const slug = typeof body?.blindTestId === "string" ? body.blindTestId.trim() : "";
        if (!slug || slug.length > 80) {
            return NextResponse.json({ error: "Blind test invalide." }, { status: 400 });
        }

        const recentStarts = await BlindTestSession.countDocuments({
            userId,
            createdAt: { $gte: new Date(Date.now() - 60_000) },
        });
        if (recentStarts >= 5) {
            return NextResponse.json({ error: "Trop de parties lancées. Réessaie dans une minute." }, { status: 429 });
        }

        await ensureOfficialBlindTests();
        const blindTest = await BlindTest.findOne({ slug, active: true }).lean();
        if (!blindTest) return NextResponse.json({ error: "Blind test introuvable." }, { status: 404 });

        const rules = parseGameRules(body);
        if (!blindTest.supportedRoundCounts?.includes(rules.roundCount)) {
            return NextResponse.json({ error: "Nombre de manches non pris en charge." }, { status: 400 });
        }

        const tracks = await getPlayableTracks(blindTest, rules.roundCount);
        const rounds = buildRounds(tracks, rules.answerMode, rules.target);
        const firstRoundTimes = roundTimes(rules.roundDurationMs);
        rounds[0] = { ...rounds[0], ...firstRoundTimes };

        await BlindTestSession.updateMany(
            { userId, status: "active" },
            { $set: { status: "abandoned" } }
        );

        const session = await BlindTestSession.create({
            userId,
            blindTestId: blindTest._id,
            blindTestSlug: blindTest.slug,
            blindTestTitle: blindTest.title,
            rules,
            rounds,
            currentRound: 0,
            score: 0,
            currentStreak: 0,
            bestStreak: 0,
        });

        return NextResponse.json({ session: await serializeSession(session.toObject()) }, { status: 201 });
    } catch (error: any) {
        console.error("POST /api/blind-test/sessions error:", error);
        const message = error?.message === "Pas assez d’extraits vérifiés pour lancer cette partie."
            ? error.message
            : "Impossible de lancer la partie.";
        return NextResponse.json({ error: message }, { status: message === error?.message ? 503 : 500 });
    }
}
