import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdminRequest } from "@/lib/adminAuth";
import Post from "@/models/Post";
import { pageResponse, paginateSlice, parsePagination } from "@/lib/pagination";

export const dynamic = "force-dynamic";

function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: Request) {
    const auth = requireAdminRequest(req);
    if (auth.response) return auth.response;

    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const q = (searchParams.get("q") || "").trim();
        const type = searchParams.get("type") || "all";
        const { limit, cursor, invalidCursor } = parsePagination(searchParams, {
            defaultLimit: 30,
            maxLimit: 100,
            minLimit: 10,
        });

        if (invalidCursor) {
            return NextResponse.json({ error: "Curseur invalide." }, { status: 400 });
        }

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

        const page = paginateSlice(rows, limit, (item: any) => item?._id?.toString?.());

        return pageResponse({ posts: page.data }, page.pageInfo);
    } catch (e) {
        console.error("GET /api/admin/posts error:", e);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}
