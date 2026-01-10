// apps/api/app/api/posts/[postId]/repost/route.ts
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

        // On récupère le post visé
        const target: any = await Post.findById(postId).select("_id type repostOf repostedBy").lean();
        if (!target) return NextResponse.json({ error: "Post introuvable." }, { status: 404 });

        // ✅ Si on appuie sur un repost, on toggle sur le post ORIGINAL
        const baseId =
            target.type === "repost" && target.repostOf
                ? new mongoose.Types.ObjectId(target.repostOf)
                : new mongoose.Types.ObjectId(postId);

        const base: any = await Post.findById(baseId).select("_id type").lean();
        if (!base) return NextResponse.json({ error: "Post introuvable." }, { status: 404 });

        // Interdit de repost un repost comme "base"
        if (base.type === "repost") {
            return NextResponse.json({ error: "Impossible de repost un repost." }, { status: 400 });
        }

        // Existe déjà ?
        const existing: any = await Post.findOne({ type: "repost", repostOf: baseId, repostedBy: meId })
            .select("_id")
            .lean();

        if (existing?._id) {
            // ✅ UNREPOST
            await Post.deleteOne({ _id: existing._id });

            await Post.updateOne(
                { _id: baseId },
                { $pull: { reposts: me }, $inc: { repostsCount: -1 } }
            );

            const fresh: any = await Post.findById(baseId).select("reposts repostsCount").lean();
            const arr = Array.isArray(fresh?.reposts) ? fresh.reposts : [];
            const repostsCount = typeof fresh?.repostsCount === "number" ? fresh.repostsCount : arr.length;

            return NextResponse.json(
                { status: "unreposted", repostedByMe: false, repostsCount: Math.max(0, repostsCount) },
                { status: 200 }
            );
        }

        // ✅ REPOST
        const body = await req.json().catch(() => null);
        const repostComment = typeof body?.comment === "string" ? body.comment.trim() : "";

        const created = await Post.create({
            type: "repost",
            repostOf: baseId,
            repostedBy: meId,

            // ✅ IMPORTANT: pour que ça apparaisse sur le profil via query userId
            userId: meId,

            repostComment,
        });

        await Post.updateOne(
            { _id: baseId },
            { $addToSet: { reposts: me }, $inc: { repostsCount: 1 } }
        );

        const fresh: any = await Post.findById(baseId).select("reposts repostsCount").lean();
        const arr = Array.isArray(fresh?.reposts) ? fresh.reposts : [];
        const repostsCount = typeof fresh?.repostsCount === "number" ? fresh.repostsCount : arr.length;

        return NextResponse.json(
            { status: "reposted", repostedByMe: true, repostsCount, repostId: created._id.toString() },
            { status: 201 }
        );
    } catch (e) {
        console.error("❌ POST /api/posts/[postId]/repost error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}