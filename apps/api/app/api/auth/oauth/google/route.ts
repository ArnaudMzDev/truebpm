import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import {
    findOrCreateOAuthUser,
    oauthErrorResponse,
    verifyGoogleIdToken,
} from "@/lib/oauthAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        await connectDB();

        const body = await req.json().catch(() => null);
        const idToken = typeof body?.idToken === "string" ? body.idToken : "";
        if (!idToken) {
            return NextResponse.json({ error: "Token Google manquant." }, { status: 400 });
        }

        const profile = await verifyGoogleIdToken(idToken);
        const session = await findOrCreateOAuthUser(profile);

        return NextResponse.json({ success: true, ...session }, { status: 200 });
    } catch (err) {
        console.error("❌ POST /api/auth/oauth/google error:", err);
        const response = oauthErrorResponse(err);
        return NextResponse.json(response.body, { status: response.status });
    }
}
