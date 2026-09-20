import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdminRequest } from "@/lib/adminAuth";
import SupportTicket from "@/models/SupportTicket";
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
        const status = searchParams.get("status") || "active";
        const { limit, cursor, invalidCursor } = parsePagination(searchParams, {
            defaultLimit: 40,
            maxLimit: 100,
            minLimit: 10,
        });

        if (invalidCursor) {
            return NextResponse.json({ error: "Curseur invalide." }, { status: 400 });
        }

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
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate("userId", "pseudo email avatarUrl isBanned")
            .lean();

        const page = paginateSlice(tickets, limit, (item: any) => item?._id?.toString?.());

        const counts = await SupportTicket.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } },
        ]);

        return pageResponse({ tickets: page.data, counts }, page.pageInfo);
    } catch (e) {
        console.error("GET /api/admin/support error:", e);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}
