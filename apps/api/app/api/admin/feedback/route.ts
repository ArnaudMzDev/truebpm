import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdminRequest } from "@/lib/adminAuth";
import Feedback from "@/models/Feedback";

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
        const area = searchParams.get("area") || "all";
        const limit = clampLimit(searchParams.get("limit"));
        const cursor = searchParams.get("cursor");

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
            .sort({ priority: -1, rating: 1, _id: -1 })
            .limit(limit + 1)
            .populate("userId", "pseudo email avatarUrl isBanned")
            .lean();

        let nextCursor: string | null = null;
        if (feedback.length > limit) {
            const next = feedback.pop();
            nextCursor = next?._id?.toString?.() || null;
        }

        const [statusCounts, areaCounts, averageRating] = await Promise.all([
            Feedback.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
            Feedback.aggregate([{ $group: { _id: "$area", count: { $sum: 1 } } }]),
            Feedback.aggregate([{ $group: { _id: null, rating: { $avg: "$rating" } } }]),
        ]);

        return NextResponse.json({
            feedback,
            statusCounts,
            areaCounts,
            averageRating: averageRating[0]?.rating || 0,
            nextCursor,
        });
    } catch (e) {
        console.error("GET /api/admin/feedback error:", e);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}
