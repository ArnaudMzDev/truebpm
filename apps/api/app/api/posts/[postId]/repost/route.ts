import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import mongoose from "mongoose";
import { requireUserId } from "@/lib/requestAuth";
import { createNotification } from "@/lib/notifications";

export async function POST(req: Request, { params }: { params: { postId: string } }) {
    try {
        await connectDB();

        const meId = await requireUserId(req);
        if (!meId) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        const { postId } = params;
        if (!mongoose.Types.ObjectId.isValid(postId) || !mongoose.Types.ObjectId.isValid(meId)) {
            return NextResponse.json({ error: "ID invalide." }, { status: 400 });
        }

        const me = new mongoose.Types.ObjectId(meId);

        const target: any = await Post.findById(postId)
            .select("_id type repostOf repostedBy")
            .lean();

        if (!target) {
            return NextResponse.json({ error: "Post introuvable." }, { status: 404 });
        }

        const baseId =
            target.type === "repost" && target.repostOf
                ? new mongoose.Types.ObjectId(target.repostOf)
                : new mongoose.Types.ObjectId(postId);

        const baseDoc: any = await Post.findById(baseId)
            .select("_id type userId")
            .lean();

        if (!baseDoc) {
            return NextResponse.json({ error: "Post introuvable." }, { status: 404 });
        }

        if (baseDoc.type === "repost") {
            return NextResponse.json({ error: "Impossible de repost un repost." }, { status: 400 });
        }

        const existing: any = await Post.findOne({
            type: "repost",
            repostOf: baseId,
            repostedBy: meId,
        })
            .select("_id")
            .lean();

        if (existing?._id) {
            await Post.deleteOne({ _id: existing._id });

            await Post.updateOne(
                { _id: baseId },
                { $pull: { reposts: me } }
            );

            const fresh: any = await Post.findById(baseId).select("reposts").lean();
            const arr = Array.isArray(fresh?.reposts) ? fresh.reposts : [];
            const repostedByMe = arr.some((id: any) => id?.toString?.() === me.toString());
            const repostsCount = arr.length;

            await Post.updateOne(
                { _id: baseId },
                { $set: { repostsCount } }
            );

            return NextResponse.json(
                { status: "unreposted", repostedByMe, repostsCount },
                { status: 200 }
            );
        }

        const body = await req.json().catch(() => null);
        const repostComment = typeof body?.comment === "string" ? body.comment.trim() : "";

        const created = await Post.create({
            type: "repost",
            repostOf: baseId,
            repostedBy: meId,
            userId: meId,
            repostComment,
        });

        await Post.updateOne(
            { _id: baseId },
            { $addToSet: { reposts: me } }
        );

        const fresh: any = await Post.findById(baseId).select("reposts").lean();
        const arr = Array.isArray(fresh?.reposts) ? fresh.reposts : [];
        const repostedByMe = arr.some((id: any) => id?.toString?.() === me.toString());
        const repostsCount = arr.length;

        await Post.updateOne(
            { _id: baseId },
            { $set: { repostsCount } }
        );

        await createNotification({
            recipientId: String(baseDoc.userId),
            actorId: String(me),
            type: "repost_post",
            postId: String(baseId),
        });

        return NextResponse.json(
            {
                status: "reposted",
                repostedByMe,
                repostsCount,
                repostId: created._id.toString(),
            },
            { status: 201 }
        );
    } catch (e) {
        console.error("❌ POST /api/posts/[postId]/repost error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}