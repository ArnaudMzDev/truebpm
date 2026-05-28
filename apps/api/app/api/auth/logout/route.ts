import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import jwt from "jsonwebtoken";
import RevokedToken from "@/models/RevokedToken";

export const dynamic = "force-dynamic";

type JwtPayload = { id: string; exp?: number };

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is missing");
    if (process.env.NODE_ENV === "production" && secret.length < 32) {
        throw new Error("JWT_SECRET must be at least 32 characters in production");
    }
    return secret;
}

export async function POST(req: Request) {
    try {
        await connectDB();

        const header = req.headers.get("authorization") || "";
        const [scheme, token] = header.split(" ");
        if (scheme?.toLowerCase() !== "bearer" || !token || token.length > 4096) {
            return NextResponse.json({ error: "Missing token" }, { status: 401 });
        }

        const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as JwtPayload;
        if (!decoded?.id) {
            return NextResponse.json({ error: "Invalid token" }, { status: 401 });
        }

        // exp est en secondes epoch
        const expSeconds = decoded.exp;
        const expDate = expSeconds ? new Date(expSeconds * 1000) : new Date(Date.now() + 7 * 24 * 3600 * 1000);

        await RevokedToken.updateOne(
            { token },
            { $setOnInsert: { token, exp: expDate } },
            { upsert: true }
        );

        return NextResponse.json({ success: true });
    } catch (e: any) {
        // si le token est déjà expiré, on peut répondre success quand même
        if (e?.name === "TokenExpiredError") {
            return NextResponse.json({ success: true });
        }
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
