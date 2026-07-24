import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import { getSessionResult, serializeSession, validSessionId } from "@/lib/blindTest/session";
import BlindTestSession from "@/models/BlindTestSession";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { sessionId: string } }) {
    try {
        await connectDB();
        const userId = await requireUserId(req);
        if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        if (!validSessionId(params.sessionId)) {
            return NextResponse.json({ error: "Partie invalide." }, { status: 400 });
        }

        const session = await BlindTestSession.findOne({ _id: params.sessionId, userId }).lean();
        if (!session) return NextResponse.json({ error: "Partie introuvable." }, { status: 404 });

        if (session.status === "completed") {
            return NextResponse.json({ result: await getSessionResult(session) });
        }

        return NextResponse.json({ session: await serializeSession(session) });
    } catch (error) {
        console.error("GET /api/blind-test/sessions/:id error:", error);
        return NextResponse.json({ error: "Impossible de charger la partie." }, { status: 500 });
    }
}
