import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import mongoose from "mongoose";

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        await connectDB();

        const userId = params.id;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return NextResponse.json(
                { error: "ID utilisateur invalide." },
                { status: 400 }
            );
        }

        const { searchParams } = new URL(req.url);
        const limit = Number(searchParams.get("limit") || 20);
        const cursor = searchParams.get("cursor");
        const search = searchParams.get("search") || "";

        const user = await User.findById(userId)
            .populate({
                path: "followingList",
                select: "pseudo avatarUrl",
                match: search
                    ? { pseudo: { $regex: search, $options: "i" } }
                    : {},
            })
            .lean();

        if (!user) {
            return NextResponse.json(
                { error: "Utilisateur introuvable." },
                { status: 404 }
            );
        }

        let following = user.followingList || [];

        if (cursor) {
            following = following.filter(
                (u: any) => u._id.toString() < cursor
            );
        }

        const sliced = following.slice(0, limit + 1);
        let nextCursor = null;

        if (sliced.length > limit) {
            const last = sliced.pop();
            nextCursor = last?._id.toString();
        }

        return NextResponse.json({
            users: sliced,
            nextCursor,
        });
    } catch (err) {
        console.error("❌ GET following error:", err);
        return NextResponse.json(
            { error: "Erreur interne serveur." },
            { status: 500 }
        );
    }
}