import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import {
    findOrCreateOAuthUser,
    oauthErrorResponse,
    verifyAppleIdentityToken,
} from "@/lib/oauthAuth";

export const dynamic = "force-dynamic";

function appleDisplayName(fullName: any) {
    if (!fullName || typeof fullName !== "object") return "";

    return [fullName.givenName, fullName.familyName]
        .filter((value) => typeof value === "string" && value.trim())
        .join(" ")
        .trim();
}

export async function POST(req: Request) {
    try {
        await connectDB();

        const body = await req.json().catch(() => null);
        const identityToken = typeof body?.identityToken === "string" ? body.identityToken : "";
        if (!identityToken) {
            return NextResponse.json({ error: "Token Apple manquant." }, { status: 400 });
        }

        const profile = await verifyAppleIdentityToken(
            identityToken,
            body?.email,
            appleDisplayName(body?.fullName)
        );
        const session = await findOrCreateOAuthUser(profile);

        return NextResponse.json({ success: true, ...session }, { status: 200 });
    } catch (err) {
        console.error("❌ POST /api/auth/oauth/apple error:", err);
        const response = oauthErrorResponse(err);
        return NextResponse.json(response.body, { status: response.status });
    }
}
