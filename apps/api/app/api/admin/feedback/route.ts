import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdminRequest } from "@/lib/adminAuth";
import Feedback from "@/models/Feedback";
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
        const area = searchParams.get("area") || "all";
        const { limit, cursor, invalidCursor } = parsePagination(searchParams, {
            defaultLimit: 40,
            maxLimit: 100,
            minLimit: 10,
        });

        if (invalidCursor) {
            return NextResponse.json({ error: "Curseur invalide." }, { status: 400 });
        }

        const query: any = {};
        if (status === "active") query.status = { $in: ["new", "reviewed", "planned"] };
        if (["new", "reviewed", "planned", "done", "archived"].includes(status)) query.status = status;
        if (["home", "posting", "search", "profile", "messages", "admin", "overall"].includes(area)) query.area = area;
        if (cursor) query._id = { $lt: cursor };

        if (q) {
            const regex = new RegExp(escapeRegex(q).slice(0, 120), "i");
            query.$or = [
                { subject: regex },
                { message: regex },
                { improvement: regex },
                { userPseudo: regex },
                { userEmail: regex },
            ];
        }

        const feedback: any[] = await Feedback.find(query)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate("userId", "pseudo email avatarUrl isBanned")
            .lean();

        const page = paginateSlice(feedback, limit, (item: any) => item?._id?.toString?.());

        const [statusCounts, areaCounts, averageRating] = await Promise.all([
            Feedback.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
            Feedback.aggregate([{ $group: { _id: "$area", count: { $sum: 1 } } }]),
            Feedback.aggregate([{ $group: { _id: null, rating: { $avg: "$rating" } } }]),
        ]);

        return pageResponse(
            {
                feedback: page.data,
                statusCounts,
                areaCounts,
                averageRating: averageRating[0]?.rating || 0,
            },
            page.pageInfo
        );
    } catch (e) {
        console.error("GET /api/admin/feedback error:", e);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}
