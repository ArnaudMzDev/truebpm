import jwt, { JwtPayload } from "jsonwebtoken";
import mongoose from "mongoose";
import RevokedToken from "@/models/RevokedToken";
import User from "@/models/User";

function cleanToken(raw: any): string | null {
    if (!raw || typeof raw !== "string") return null;
    let t = raw.trim();
    if (!t) return null;

    if (t.toLowerCase().startsWith("bearer ")) t = t.slice(7).trim();

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
    if (process.env.NODE_ENV === "production" && secret.length < 32) {
        throw new Error("JWT_SECRET must be at least 32 characters in production");
    }

    let decoded: string | JwtPayload;
    try {
        decoded = jwt.verify(token, secret, { algorithms: ["HS256"] }) as JwtPayload | string;
    } catch (e: any) {
        throw new Error("Unauthorized");
    }

    const payload = typeof decoded === "string" ? null : decoded;
    const userId = (payload as any)?.id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error("Token payload missing id");
    }

    const revoked = await RevokedToken.exists({ token });
    if (revoked) throw new Error("Unauthorized");

    const user = await User.findById(userId).select("_id isBanned bannedUntil").lean();
    if (!user) throw new Error("Unauthorized");

    const bannedUntil = (user as any).bannedUntil ? new Date((user as any).bannedUntil) : null;
    const banActive = !!(user as any).isBanned && (!bannedUntil || bannedUntil.getTime() > Date.now());
    if (banActive) throw new Error("Unauthorized");

    return String(userId);
}
