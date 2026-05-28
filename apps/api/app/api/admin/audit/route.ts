import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdminRequest } from "@/lib/adminAuth";
import AdminAuditLog from "@/models/AdminAuditLog";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const auth = requireAdminRequest(req);
    if (auth.response) return auth.response;

    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const limit = Math.max(20, Math.min(100, Number(searchParams.get("limit") || 50)));

        const audit = await AdminAuditLog.find({})
            .sort({ _id: -1 })
            .limit(limit)
            .lean();

        return NextResponse.json({ audit });
    } catch (e) {
        console.error("GET /api/admin/audit error:", e);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}
