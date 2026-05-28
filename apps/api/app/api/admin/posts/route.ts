import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdminRequest } from "@/lib/adminAuth";
import Post from "@/models/Post";

export const dynamic = "force-dynamic";

function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clampLimit(value: string | null) {
    const n = Number(value || 30);
    if (!Number.isFinite(n)) return 30;
    return Math.max(10, Math.min(100, Math.floor(n)));
}

export async function GET(req: Request) {
    const auth = requireAdminRequest(req);
    if (auth.response) return auth.response;

    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const q = (searchParams.get("q") || "").trim();
        const type = searchParams.get("type") || "all";
        const limit = clampLimit(searchParams.get("limit"));
        const cursor = searchParams.get("cursor");

        const query: any = {};
        if (q) {
            const regex = new RegExp(escapeRegex(q).slice(0, 120), "i");
            query.$or = [{ trackTitle: regex }, { artist: regex }, { comment: regex }, { repostComment: regex }];
        }
        if (type === "post" || type === "repost") query.type = type;
        if (cursor) query._id = { $lt: cursor };

        const rows: any[] = await Post.find(query)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate("userId", "pseudo email avatarUrl isBanned")
            .populate("repostedBy", "pseudo email avatarUrl isBanned")
            .populate({
                path: "repostOf",
                select: "_id trackTitle artist coverUrl userId",
                populate: { path: "userId", select: "pseudo avatarUrl isBanned" },
            })
            .lean();

        let nextCursor: string | null = null;
        if (rows.length > limit) {
            const next = rows.pop();
            nextCursor = next?._id?.toString?.() || null;
        }

        return NextResponse.json({ posts: rows, nextCursor });
    } catch (e) {
        console.error("GET /api/admin/posts error:", e);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}
