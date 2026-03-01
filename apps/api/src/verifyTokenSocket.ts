// apps/api/src/verifyTokenSocket.ts
import jwt, { JwtPayload } from "jsonwebtoken";

function cleanToken(raw: any): string | null {
    if (!raw || typeof raw !== "string") return null;
    let t = raw.trim();
    if (!t) return null;

    // support "Bearer xxx"
    if (t.toLowerCase().startsWith("bearer ")) t = t.slice(7).trim();

    // support token stocké avec guillemets
    if (
        (t.startsWith('"') && t.endsWith('"')) ||
        (t.startsWith("'") && t.endsWith("'"))
    ) {
        t = t.slice(1, -1).trim();
    }

    return t || null;
}

export async function verifyTokenSocket(rawToken: any): Promise<string> {
    const token = cleanToken(rawToken);
    if (!token) throw new Error("No token");

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is missing");

    let decoded: string | JwtPayload;
    try {
        decoded = jwt.verify(token, secret) as any;
    } catch (e: any) {
        console.log("socket auth failed:", e?.message || e);
        throw new Error("Unauthorized");
    }

    const payload = typeof decoded === "string" ? null : decoded;

    // ✅ ton token = { id }
    const userId = (payload as any)?.id || (payload as any)?.sub;
    if (!userId) throw new Error("Token payload has no id");

    return String(userId);
}