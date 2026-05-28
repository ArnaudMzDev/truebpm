import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { cleanMultilineText, cleanText } from "@/lib/sanitize";
import Feedback from "@/models/Feedback";
import User from "@/models/User";

export const dynamic = "force-dynamic";

const allowedAreas = new Set(["home", "posting", "search", "profile", "messages", "admin", "overall"]);
const allowedSentiments = new Set(["love", "good", "mixed", "frustrated"]);

function clampRating(value: unknown) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 4;
    return Math.max(1, Math.min(5, Math.round(n)));
}

export async function POST(req: Request) {
    try {
        await connectDB();

        const userId = await verifyToken(req);
        if (!userId) {
            return NextResponse.json(
                { error: "Non authentifié." },
                { status: 401, headers: { "Cache-Control": "no-store" } }
            );
        }

        const body = await req.json().catch(() => null);
        const areaRaw = cleanText(body?.area, 40);
        const sentimentRaw = cleanText(body?.sentiment, 40);
        const rating = clampRating(body?.rating);
        const subject = cleanText(body?.subject, 140);
        const message = cleanMultilineText(body?.message, 4000);
        const improvement = cleanMultilineText(body?.improvement, 4000);
        const contactAllowed = body?.contactAllowed !== false;

        if (subject.length < 4) {
            return NextResponse.json(
                { error: "Ajoute un sujet un peu plus précis." },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        if (message.length < 10) {
            return NextResponse.json(
                { error: "Ajoute un feedback un peu plus détaillé." },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        const user: any = await User.findById(userId).select("pseudo email").lean();
        if (!user) {
            return NextResponse.json(
                { error: "Utilisateur introuvable." },
                { status: 404, headers: { "Cache-Control": "no-store" } }
            );
        }

        const feedback = await Feedback.create({
            userId,
            area: allowedAreas.has(areaRaw) ? areaRaw : "overall",
            sentiment: allowedSentiments.has(sentimentRaw) ? sentimentRaw : "good",
            rating,
            subject,
            message,
            improvement,
            contactAllowed,
            priority: rating <= 2 || sentimentRaw === "frustrated" ? "high" : "normal",
            userPseudo: user.pseudo || "",
            userEmail: user.email || "",
        });

        return NextResponse.json(
            {
                success: true,
                feedback: {
                    _id: feedback._id,
                    status: feedback.status,
                    createdAt: feedback.createdAt,
                },
            },
            { status: 201, headers: { "Cache-Control": "no-store" } }
        );
    } catch (e) {
        console.error("POST /api/feedback error:", e);
        return NextResponse.json(
            { error: "Erreur serveur." },
            { status: 500, headers: { "Cache-Control": "no-store" } }
        );
    }
}
