import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Post } from "@/models";

export async function GET() {
    try {
        await connectDB();

        const posts = await Post.find()
            .populate("userId", "pseudo avatarUrl")
            .sort({ createdAt: -1 });

        return NextResponse.json({ posts });
    } catch (err) {
        console.error("❌ Feed error:", err);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}