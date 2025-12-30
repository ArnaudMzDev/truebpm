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
            return NextResponse.json({ error: "ID invalide" }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const limit = Number(searchParams.get("limit") || 20);
        const cursor = searchParams.get("cursor");
        const search = searchParams.get("search") || "";

        const user = await User.findById(userId).lean();
        if (!user) {
            return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
        }

        const followersIds = user.followersList || [];
        if (followersIds.length === 0) {
            return NextResponse.json({ users: [], nextCursor: null });
        }

        const query: any = {
            _id: { $in: followersIds },
        };

        if (cursor) {
            query._id.$lt = cursor;
        }

        if (search) {
            query.pseudo = { $regex: search, $options: "i" };
        }

        const followers = await User.find(query)
            .select("pseudo avatarUrl followers following")
            .sort({ _id: -1 })
            .limit(limit + 1)
            .lean();

        let nextCursor = null;
        if (followers.length > limit) {
            const last = followers.pop();
            nextCursor = last?._id.toString();
        }

        return NextResponse.json({
            users: followers,
            nextCursor,
        });
    } catch (err) {
        console.error("❌ GET followers error:", err);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}