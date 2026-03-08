import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import PushToken from "@/models/PushToken";

export async function POST(req: Request) {
    try {
        await connectDB();

        const meId = await requireUserId(req);
        if (!meId) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        const body = await req.json().catch(() => null);
        const token = typeof body?.token === "string" ? body.token.trim() : "";
        const platform =
            body?.platform === "ios" || body?.platform === "android"
                ? body.platform
                : "unknown";
        const deviceName = typeof body?.deviceName === "string" ? body.deviceName.trim() : "";

        if (!token) {
            return NextResponse.json({ error: "token requis." }, { status: 400 });
        }

        await PushToken.findOneAndUpdate(
            { userId: meId, token },
            {
                $set: {
                    platform,
                    deviceName,
                    isActive: true,
                    lastSeenAt: new Date(),
                },
            },
            { upsert: true, new: true }
        );

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (e) {
        console.error("POST /api/push-tokens/register error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}