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
            .select("_id pseudo email avatarUrl bannerUrl bio followers following followersList followingList notesCount createdAt")
            .lean();

        if (!user) {
            return NextResponse.json(
                { error: "Utilisateur introuvable." },
                { status: 404, headers: { "Cache-Control": "no-store" } }
            );
        }

        return NextResponse.json(
            { user },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    } catch (err) {
        console.error("❌ GET /api/user/me error:", err);
        return NextResponse.json(
            { error: "Erreur interne du serveur." },
            { status: 500, headers: { "Cache-Control": "no-store" } }
        );
    }
}