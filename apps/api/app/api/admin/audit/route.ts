import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdminRequest } from "@/lib/adminAuth";
import AdminAuditLog from "@/models/AdminAuditLog";
import { pageResponse, paginateSlice, parsePagination } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const auth = requireAdminRequest(req);
    if (auth.response) return auth.response;

    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const { limit, cursor, invalidCursor } = parsePagination(searchParams, {
            defaultLimit: 50,
            maxLimit: 100,
            minLimit: 20,
        });

        if (invalidCursor) {
            return NextResponse.json({ error: "Curseur invalide." }, { status: 400 });
        }

        const query: any = {};
        if (cursor) query._id = { $lt: cursor };

        const audit = await AdminAuditLog.find(query)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .lean();

        const page = paginateSlice(audit, limit, (item: any) => item?._id?.toString?.());

        return pageResponse({ audit: page.data }, page.pageInfo);
    } catch (e) {
        console.error("GET /api/admin/audit error:", e);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}
