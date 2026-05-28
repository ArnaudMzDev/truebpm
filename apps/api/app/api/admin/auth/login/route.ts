import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { createAdminSessionResponse, getRequestAuditMeta, verifyAdminPassword, writeAdminAuditLog } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);
        const password = typeof body?.password === "string" ? body.password : "";

        const ok = await verifyAdminPassword(password);
        if (!ok) {
            return NextResponse.json({ error: "Accès admin refusé." }, { status: 401 });
        }

        await connectDB();

        const { response, adminId } = createAdminSessionResponse(({ csrfToken, adminId: id }) => {
            return {
                success: true,
                csrfToken,
                admin: { id },
            };
        });

        const auditMeta = getRequestAuditMeta(req);
        await writeAdminAuditLog({
            req,
            adminId,
            action: "admin_login",
            targetType: "admin",
            targetId: adminId,
            metadata: auditMeta,
        });

        return response;
    } catch (e: any) {
        const message = e?.message || "";
        if (message.includes("ADMIN_")) {
            return NextResponse.json(
                { error: "Configuration admin manquante côté serveur." },
                { status: 503 }
            );
        }
        console.error("POST /api/admin/auth/login error:", e);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}
