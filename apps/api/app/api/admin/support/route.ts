import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdminRequest } from "@/lib/adminAuth";
import SupportTicket from "@/models/SupportTicket";

export const dynamic = "force-dynamic";

function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clampLimit(value: string | null) {
    const n = Number(value || 40);
    if (!Number.isFinite(n)) return 40;
    return Math.max(10, Math.min(100, Math.floor(n)));
}

export async function GET(req: Request) {
    const auth = requireAdminRequest(req);
    if (auth.response) return auth.response;

    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const q = (searchParams.get("q") || "").trim();
        const status = searchParams.get("status") || "active";
        const limit = clampLimit(searchParams.get("limit"));
        const cursor = searchParams.get("cursor");

        const query: any = {};
        if (status === "active") query.status = { $in: ["open", "in_review"] };
        if (["open", "in_review", "resolved", "closed"].includes(status)) query.status = status;
        if (cursor) query._id = { $lt: cursor };

        if (q) {
            const regex = new RegExp(escapeRegex(q).slice(0, 120), "i");
            query.$or = [
                { subject: regex },
                { message: regex },
                { userPseudo: regex },
                { userEmail: regex },
            ];
        }

        const tickets: any[] = await SupportTicket.find(query)
            .sort({ priority: -1, _id: -1 })
            .limit(limit + 1)
            .populate("userId", "pseudo email avatarUrl isBanned")
            .lean();

        let nextCursor: string | null = null;
        if (tickets.length > limit) {
            const next = tickets.pop();
            nextCursor = next?._id?.toString?.() || null;
        }

        const counts = await SupportTicket.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } },
        ]);

        return NextResponse.json({ tickets, counts, nextCursor });
    } catch (e) {
        console.error("GET /api/admin/support error:", e);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}
