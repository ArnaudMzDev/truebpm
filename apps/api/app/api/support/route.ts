import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { cleanMultilineText, cleanText } from "@/lib/sanitize";
import SupportTicket from "@/models/SupportTicket";
import User from "@/models/User";

export const dynamic = "force-dynamic";

const allowedCategories = new Set(["bug", "abuse", "account", "legal", "other"]);

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
        const categoryRaw = cleanText(body?.category, 40);
        const category = allowedCategories.has(categoryRaw) ? categoryRaw : "other";
        const subject = cleanText(body?.subject, 140);
        const message = cleanMultilineText(body?.message, 4000);

        if (subject.length < 4) {
            return NextResponse.json(
                { error: "Ajoute un sujet un peu plus précis." },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        if (message.length < 10) {
            return NextResponse.json(
                { error: "Décris le problème en quelques mots." },
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

        const ticket = await SupportTicket.create({
            userId,
            category,
            subject,
            message,
            userPseudo: user.pseudo || "",
            userEmail: user.email || "",
            priority: category === "abuse" ? "high" : "normal",
        });

        return NextResponse.json(
            {
                success: true,
                ticket: {
                    _id: ticket._id,
                    status: ticket.status,
                    createdAt: ticket.createdAt,
                },
            },
            { status: 201, headers: { "Cache-Control": "no-store" } }
        );
    } catch (e) {
        console.error("POST /api/support error:", e);
        return NextResponse.json(
            { error: "Erreur serveur." },
            { status: 500, headers: { "Cache-Control": "no-store" } }
        );
    }
}
