import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import mongoose from "mongoose";
import { pageResponse, paginateSlice, parsePagination } from "@/lib/pagination";

export const dynamic = "force-dynamic";

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
        const { limit, cursor, invalidCursor } = parsePagination(searchParams, {
            defaultLimit: 20,
            maxLimit: 50,
        });
        const search = (searchParams.get("search") || "").trim();

        if (invalidCursor) {
            return NextResponse.json({ error: "Curseur invalide." }, { status: 400 });
        }

        const user = await User.findById(userId).lean();
        if (!user) {
            return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
        }

        const followersIds = user.followersList || [];
        if (followersIds.length === 0) {
            return pageResponse(
                { users: [] },
                { nextCursor: null, hasMore: false, limit, count: 0 },
                { status: 200 }
            );
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

        const page = paginateSlice(followers, limit, (item: any) => item?._id?.toString?.());

        return pageResponse({ users: page.data }, page.pageInfo);
    } catch (err) {
        console.error("❌ GET followers error:", err);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}
