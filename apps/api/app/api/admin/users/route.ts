import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdminRequest } from "@/lib/adminAuth";
import User from "@/models/User";

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
        const status = searchParams.get("status") || "all";
        const limit = clampLimit(searchParams.get("limit"));
        const cursor = searchParams.get("cursor");

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

        let nextCursor: string | null = null;
        if (rows.length > limit) {
            const next = rows.pop();
            nextCursor = next?._id?.toString?.() || null;
        }

        return NextResponse.json({ users: rows, nextCursor });
    } catch (e) {
        console.error("GET /api/admin/users error:", e);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}
