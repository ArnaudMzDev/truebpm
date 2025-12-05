import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        await connectDB();

        const posts = await Post.find({ userId: params.id })
            .sort({ createdAt: -1 });

        return NextResponse.json({ posts }, { status: 200 });
    } catch (err) {
        console.error("❌ User posts error:", err);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}