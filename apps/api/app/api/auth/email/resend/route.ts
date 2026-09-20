import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { sendEmailVerification } from "@/lib/emailVerification";

export const dynamic = "force-dynamic";

const GENERIC_RESPONSE = {
    success: true,
    message: "Si ce compte existe et n'est pas vérifié, un nouvel email a été envoyé.",
};

export async function POST(req: Request) {
    try {
        await connectDB();

        const body = await req.json().catch(() => null);
        const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

        if (!email || email.length > 320) {
            return NextResponse.json(GENERIC_RESPONSE, { status: 200, headers: { "Cache-Control": "no-store" } });
        }

        const user: any = await User.findOne({ email })
            .select("_id email pseudo emailVerifiedAt")
            .lean();

        if (!user || user.emailVerifiedAt) {
            return NextResponse.json(GENERIC_RESPONSE, { status: 200, headers: { "Cache-Control": "no-store" } });
        }

        await sendEmailVerification({
            userId: String(user._id),
            email: user.email,
            pseudo: user.pseudo || "",
        });

        return NextResponse.json(GENERIC_RESPONSE, { status: 200, headers: { "Cache-Control": "no-store" } });
    } catch (err) {
        console.error("POST /api/auth/email/resend error:", err);
        return NextResponse.json(GENERIC_RESPONSE, { status: 200, headers: { "Cache-Control": "no-store" } });
    }
}
