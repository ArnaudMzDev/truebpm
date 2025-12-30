// apps/api/app/api/posts/route.ts

import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import mongoose from "mongoose";

export async function GET(req: Request) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);

        const limitParam = searchParams.get("limit");
        const cursor = searchParams.get("cursor");
        const userId = searchParams.get("userId");

        const limit = Math.min(Number(limitParam) || 15, 50);

        const query: any = {};

        // ✅ userId défensif
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            query.userId = userId;
        }

        // ✅ cursor défensif
        if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
            query._id = { $lt: cursor };
        }

        const posts = await Post.find(query)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate("userId", "pseudo avatarUrl")
            .lean();

        let nextCursor: string | null = null;

        if (posts.length > limit) {
            const nextItem = posts.pop();
            nextCursor = nextItem?._id?.toString() ?? null;
        }

        return NextResponse.json(
            {
                posts,
                nextCursor,
            },
            { status: 200 }
        );
    } catch (err) {
        console.error("❌ GET /api/posts error:", err);
        return NextResponse.json(
            { error: "Erreur interne serveur." },
            { status: 500 }
        );
    }
}