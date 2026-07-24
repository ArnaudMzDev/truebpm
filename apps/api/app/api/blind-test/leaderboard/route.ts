import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import { ensureOfficialBlindTests } from "@/lib/blindTest/catalog";
import BlindTest from "@/models/BlindTest";
import BlindTestSession from "@/models/BlindTestSession";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        await connectDB();
        const userId = await requireUserId(req);
        if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const slug = (searchParams.get("blindTestId") || "hits-france").trim();
        await ensureOfficialBlindTests();
        const blindTest = await BlindTest.findOne({ slug, active: true }).select("_id slug title").lean();
        if (!blindTest) return NextResponse.json({ error: "Blind test introuvable." }, { status: 404 });

        const scores = await BlindTestSession.aggregate([
            { $match: { blindTestId: blindTest._id, status: "completed" } },
            {
                $group: {
                    _id: "$userId",
                    score: { $max: "$score" },
                    games: { $sum: 1 },
                    bestStreak: { $max: "$bestStreak" },
                },
            },
            { $sort: { score: -1, bestStreak: -1 } },
            { $limit: 20 },
        ]);
        const users = await User.find({ _id: { $in: scores.map((score) => score._id) } })
            .select("pseudo avatarUrl")
            .lean();
        const usersById = new Map(users.map((user: any) => [String(user._id), user]));

        const entries = scores.map((score, index) => {
            const user: any = usersById.get(String(score._id));
            return {
                rank: index + 1,
                userId: String(score._id),
                pseudo: user?.pseudo || "Utilisateur",
                avatarUrl: user?.avatarUrl || "",
                score: score.score || 0,
                games: score.games || 0,
                bestStreak: score.bestStreak || 0,
                isMe: String(score._id) === String(userId),
            };
        });

        let me = entries.find((entry) => entry.isMe) || null;
        if (!me) {
            const personal = await BlindTestSession.findOne({
                userId: new mongoose.Types.ObjectId(userId),
                blindTestId: blindTest._id,
                status: "completed",
            })
                .sort({ score: -1 })
                .select("score bestStreak")
                .lean();
            if (personal) {
                const higher = await BlindTestSession.aggregate([
                    { $match: { blindTestId: blindTest._id, status: "completed" } },
                    { $group: { _id: "$userId", score: { $max: "$score" } } },
                    { $match: { score: { $gt: personal.score || 0 } } },
                    { $count: "count" },
                ]);
                me = {
                    rank: (higher[0]?.count || 0) + 1,
                    userId,
                    pseudo: "Moi",
                    avatarUrl: "",
                    score: personal.score || 0,
                    games: 0,
                    bestStreak: personal.bestStreak || 0,
                    isMe: true,
                };
            }
        }

        return NextResponse.json({
            blindTest: { slug: blindTest.slug, title: blindTest.title },
            entries,
            me,
        });
    } catch (error) {
        console.error("GET /api/blind-test/leaderboard error:", error);
        return NextResponse.json({ error: "Impossible de charger le classement." }, { status: 500 });
    }
}
