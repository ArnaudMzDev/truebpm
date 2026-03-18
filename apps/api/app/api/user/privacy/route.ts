import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { verifyToken } from "@/lib/auth";

export async function GET(req: Request) {
    try {
        await connectDB();

        const userId = await verifyToken(req);
        if (!userId) {
            return NextResponse.json(
                { error: "Non authentifié." },
                { status: 401, headers: { "Cache-Control": "no-store" } }
            );
        }

        const user = await User.findById(userId)
            .select("_id isPrivate messagePrivacy")
            .lean();

        if (!user) {
            return NextResponse.json(
                { error: "Utilisateur introuvable." },
                { status: 404, headers: { "Cache-Control": "no-store" } }
            );
        }

        return NextResponse.json(
            {
                privacy: {
                    isPrivate: !!user.isPrivate,
                    messagePrivacy: user.messagePrivacy || "everyone",
                },
            },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    } catch (err) {
        console.error("❌ GET /api/user/privacy error:", err);
        return NextResponse.json(
            { error: "Erreur interne serveur." },
            { status: 500, headers: { "Cache-Control": "no-store" } }
        );
    }
}

export async function PATCH(req: Request) {
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

        const isPrivate =
            typeof body?.isPrivate === "boolean" ? body.isPrivate : undefined;

        const messagePrivacy =
            typeof body?.messagePrivacy === "string"
                ? body.messagePrivacy.trim()
                : undefined;

        const update: Record<string, any> = {};

        if (typeof isPrivate === "boolean") {
            update.isPrivate = isPrivate;
        }

        if (messagePrivacy !== undefined) {
            if (!["everyone", "following"].includes(messagePrivacy)) {
                return NextResponse.json(
                    { error: "Valeur de confidentialité des messages invalide." },
                    { status: 400, headers: { "Cache-Control": "no-store" } }
                );
            }

            update.messagePrivacy = messagePrivacy;
        }

        if (Object.keys(update).length === 0) {
            return NextResponse.json(
                { error: "Aucune modification fournie." },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: update },
            { new: true }
        )
            .select("_id isPrivate messagePrivacy")
            .lean();

        if (!user) {
            return NextResponse.json(
                { error: "Utilisateur introuvable." },
                { status: 404, headers: { "Cache-Control": "no-store" } }
            );
        }

        return NextResponse.json(
            {
                success: true,
                privacy: {
                    isPrivate: !!user.isPrivate,
                    messagePrivacy: user.messagePrivacy || "everyone",
                },
            },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    } catch (err) {
        console.error("❌ PATCH /api/user/privacy error:", err);
        return NextResponse.json(
            { error: "Erreur interne serveur." },
            { status: 500, headers: { "Cache-Control": "no-store" } }
        );
    }
}