import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import { blindTestFlags } from "@/lib/blindTest/flags";
import { ensureBlindTestCover, ensureOfficialBlindTests } from "@/lib/blindTest/catalog";
import BlindTestSession from "@/models/BlindTestSession";
import BlindTestTrack from "@/models/BlindTestTrack";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        await connectDB();
        const userId = await requireUserId(req);
        if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        if (!blindTestFlags.global) {
            return NextResponse.json({ error: "Le Blind Test est temporairement indisponible." }, { status: 503 });
        }

        const [blindTests, recentSessions, activeSession, statsRows] = await Promise.all([
            ensureOfficialBlindTests(),
            BlindTestSession.find({ userId, status: "completed" })
                .sort({ completedAt: -1 })
                .limit(5)
                .select("blindTestSlug blindTestTitle score rules.roundCount completedAt")
                .lean(),
            BlindTestSession.findOne({ userId, status: "active" })
                .sort({ updatedAt: -1 })
                .select("blindTestSlug blindTestTitle currentRound rules.roundCount updatedAt")
                .lean(),
            BlindTestSession.aggregate([
                { $match: { userId: new mongoose.Types.ObjectId(userId), status: "completed" } },
                {
                    $group: {
                        _id: null,
                        games: { $sum: 1 },
                        bestScore: { $max: "$score" },
                        averageScore: { $avg: "$score" },
                    },
                },
            ]),
        ]);
        const categorySlugs: string[] = blindTests.map((blindTest: any) => String(blindTest.slug));
        const coverTracks = await BlindTestTrack.find({
            available: true,
            artworkUrl: { $ne: "" },
        })
            .sort({ lastCheckedAt: -1 })
            .limit(120)
            .select("artworkUrl sourceCategories")
            .lean();
        const coversBySlug = new Map<string, string>();
        coverTracks.forEach((track: any) => {
            (track.sourceCategories || []).forEach((slug: string) => {
                if (!coversBySlug.has(slug) && track.artworkUrl) {
                    coversBySlug.set(slug, track.artworkUrl);
                }
            });
        });
        await Promise.all(blindTests.map(async (blindTest: any) => {
            const savedCover = String(blindTest.coverUrl || "");
            if (savedCover) {
                coversBySlug.set(String(blindTest.slug), savedCover);
                return;
            }
            if (coversBySlug.has(String(blindTest.slug))) return;
            const generatedCover = await ensureBlindTestCover(blindTest);
            if (generatedCover) coversBySlug.set(String(blindTest.slug), generatedCover);
        }));
        const fallbackCovers: string[] = Array.from(
            new Set<string>(coverTracks.map((track: any) => String(track.artworkUrl || "")).filter(Boolean))
        );
        categorySlugs.forEach((slug: string, index: number) => {
            if (coversBySlug.has(slug) || fallbackCovers.length === 0) return;
            const slugSeed = slug.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);
            coversBySlug.set(slug, fallbackCovers[(slugSeed + index) % fallbackCovers.length]);
        });

        const stats = statsRows[0] || { games: 0, bestScore: 0, averageScore: 0 };
        return NextResponse.json({
            flags: blindTestFlags,
            categories: blindTests.map((blindTest: any) => ({
                id: String(blindTest._id),
                slug: blindTest.slug,
                title: blindTest.title,
                description: blindTest.description,
                difficulty: blindTest.difficulty,
                region: blindTest.region,
                tags: blindTest.tags,
                featured: !!blindTest.featured,
                coverUrl: coversBySlug.get(blindTest.slug) || "",
                roundCounts: blindTest.supportedRoundCounts,
                gamesCount: blindTest.gamesCount || 0,
                averageScore: blindTest.gamesCount
                    ? Math.round((blindTest.scoreTotal || 0) / blindTest.gamesCount)
                    : 0,
                bestScore: blindTest.bestScore || 0,
            })),
            recent: recentSessions.map((session: any) => ({
                id: String(session._id),
                slug: session.blindTestSlug,
                title: session.blindTestTitle,
                score: session.score || 0,
                roundCount: session.rules?.roundCount || 0,
                completedAt: session.completedAt,
            })),
            active: activeSession
                ? {
                    id: String(activeSession._id),
                    slug: activeSession.blindTestSlug,
                    title: activeSession.blindTestTitle,
                    currentRound: activeSession.currentRound || 0,
                    roundCount: activeSession.rules?.roundCount || 0,
                    updatedAt: activeSession.updatedAt,
                }
                : null,
            stats: {
                games: stats.games || 0,
                bestScore: stats.bestScore || 0,
                averageScore: Math.round(stats.averageScore || 0),
            },
        });
    } catch (error) {
        console.error("GET /api/blind-test/catalog error:", error);
        return NextResponse.json({ error: "Impossible de charger les blind tests." }, { status: 500 });
    }
}
