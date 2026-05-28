import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const auth = requireAdminRequest(req);
    if (auth.response) return auth.response;

    return NextResponse.json({
        authenticated: true,
        csrfToken: auth.session!.csrfToken,
        admin: { id: auth.session!.adminId },
    });
}
