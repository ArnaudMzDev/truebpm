import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";

export async function GET(req: Request, { params }: any) {
    try {
        await connectDB();
        const { postId } = params;

        const post = await Post.findById(postId);

        if (!post)
            return NextResponse.json(
                { error: "Post introuvable." },
                { status: 404 }
            );

        return NextResponse.json({ post }, { status: 200 });
    } catch (err) {
        console.error("❌ POST get error:", err);
        return NextResponse.json(
            { error: "Erreur serveur." },
            { status: 500 }
        );
    }
}