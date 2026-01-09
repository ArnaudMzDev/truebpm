import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import mongoose from "mongoose";

export async function POST(req: Request, { params }: { params: { postId: string } }) {
    try {
        await connectDB();

        const meId = req.headers.get("x-user-id");
        if (!meId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

        const { postId } = params;
        if (!mongoose.Types.ObjectId.isValid(postId) || !mongoose.Types.ObjectId.isValid(meId)) {
            return NextResponse.json({ error: "ID invalide." }, { status: 400 });
        }

        const me = new mongoose.Types.ObjectId(meId);

        const post: any = await Post.findById(postId).select("reposts").lean();
        if (!post) return NextResponse.json({ error: "Post introuvable." }, { status: 404 });

        const repostsArr = Array.isArray(post.reposts) ? post.reposts : [];
        const already = repostsArr.some((id: any) => id?.toString?.() === me.toString());

        if (already) {
            await Post.updateOne({ _id: postId }, { $pull: { reposts: me } });
        } else {
            await Post.updateOne({ _id: postId }, { $addToSet: { reposts: me } });
        }

        const fresh: any = await Post.findById(postId).select("reposts").lean();
        const freshReposts = Array.isArray(fresh?.reposts) ? fresh.reposts : [];
        const repostsCount = freshReposts.length;

        return NextResponse.json(
            { status: already ? "unreposted" : "reposted", repostsCount },
            { status: 200 }
        );
    } catch (e) {
        console.error("❌ POST /api/posts/[postId]/repost error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}