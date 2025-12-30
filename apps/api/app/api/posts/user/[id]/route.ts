import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import User from "@/models/User";
import mongoose from "mongoose";

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        await connectDB();

        const userId = params.id;

        // Vérifier que l'ID est valide
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return NextResponse.json(
                { error: "ID utilisateur invalide." },
                { status: 400 }
            );
        }

        // Vérifier que le user existe
        const exists = await User.exists({ _id: userId });
        if (!exists) {
            return NextResponse.json(
                { error: "Utilisateur introuvable." },
                { status: 404 }
            );
        }

        const { searchParams } = new URL(req.url);

        const limitParam = searchParams.get("limit");
        const cursorParam = searchParams.get("cursor");

        const limit = Math.min(Number(limitParam) || 15, 50);

        const query: any = { userId };

        if (cursorParam && mongoose.Types.ObjectId.isValid(cursorParam)) {
            query._id = { $lt: cursorParam };
        }

        const posts = await Post.find(query)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate("userId", "pseudo avatarUrl")
            .lean();

        let nextCursor: string | null = null;

        if (posts.length > limit) {
            const nextItem = posts.pop();
            nextCursor = nextItem?._id.toString() ?? null;
        }

        return NextResponse.json(
            { posts, nextCursor },
            { status: 200 }
        );

    } catch (err) {
        console.error("❌ GET /posts/user/[id] error:", err);
        return NextResponse.json(
            { error: "Erreur interne serveur." },
            { status: 500 }
        );
    }
}