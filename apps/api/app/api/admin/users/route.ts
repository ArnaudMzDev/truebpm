import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdminRequest } from "@/lib/adminAuth";
import User from "@/models/User";
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
        const status = searchParams.get("status") || "all";
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
            query.$or = [{ pseudo: regex }, { email: regex }, { bio: regex }];
        }
        if (status === "online") query.isOnline = true;
        if (status === "banned") query.isBanned = true;
        if (status === "private") query.isPrivate = true;
        if (cursor) query._id = { $lt: cursor };

        const rows: any[] = await User.find(query)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .select("_id pseudo email avatarUrl bannerUrl bio followers following notesCount isOnline lastSeenAt isPrivate messagePrivacy isBanned bannedAt bannedUntil banReason bannedBy createdAt")
            .lean();

        const page = paginateSlice(rows, limit, (item: any) => item?._id?.toString?.());

        return pageResponse({ users: page.data }, page.pageInfo);
    } catch (e) {
        console.error("GET /api/admin/users error:", e);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}
