import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { verifyToken } from "@/lib/auth";
import mongoose from "mongoose";

export async function GET(req: Request) {
    try {
        await connectDB();

        const meId = await verifyToken(req);
        if (!meId || !mongoose.Types.ObjectId.isValid(meId)) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        const url = new URL(req.url);
        const limit = Math.min(
            20,
            Math.max(1, Number(url.searchParams.get("limit") || 8))
        );

        const me: any = await User.findById(meId)
            .select("_id followingList")
            .lean();

        if (!me) {
            return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
        }

        const excludedIds = [
            new mongoose.Types.ObjectId(meId),
            ...((me.followingList || [])
                .filter((id: any) => mongoose.Types.ObjectId.isValid(String(id)))
                .map((id: any) => new mongoose.Types.ObjectId(String(id)))),
        ];

        const suggestions = await User.find({
            _id: { $nin: excludedIds },
        })
            .select("_id pseudo avatarUrl bio followers following notesCount")
            .sort({ followers: -1, notesCount: -1, createdAt: -1 })
            .limit(limit)
            .lean();

        return NextResponse.json({ users: suggestions }, { status: 200 });
    } catch (err) {
        console.error("❌ GET /api/user/suggestions error:", err);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}