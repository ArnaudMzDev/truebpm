import "@/lib/loadModels";
import { clearAdminSessionResponse, requireAdminRequest, writeAdminAuditLog } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    const auth = requireAdminRequest(req, { csrf: true });
    if (auth.response) return auth.response;

    await connectDB();
    await writeAdminAuditLog({
        req,
        adminId: auth.session!.adminId,
        action: "admin_logout",
        targetType: "admin",
        targetId: auth.session!.adminId,
    });

    return clearAdminSessionResponse();
}
