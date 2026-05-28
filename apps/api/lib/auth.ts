import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import RevokedToken from "@/models/RevokedToken";
import User from "@/models/User";

type JwtPayload = { id: string };

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is missing");
    if (process.env.NODE_ENV === "production" && secret.length < 32) {
        throw new Error("JWT_SECRET must be at least 32 characters in production");
    }
    return secret;
}

export function signToken(id: string) {
    return jwt.sign({ id }, getJwtSecret(), { expiresIn: "7d", algorithm: "HS256" });
}

export async function verifyToken(req: Request): Promise<string | null> {
    try {
        const header = req.headers.get("authorization");
        if (!header) return null;

        const [scheme, token] = header.split(" ");
        if (!scheme || !token) return null;
        if (scheme.toLowerCase() !== "bearer") return null;
        if (token.length > 4096) return null;

        const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as JwtPayload;
        if (!decoded?.id || !mongoose.Types.ObjectId.isValid(decoded.id)) return null;

        const revoked = await RevokedToken.exists({ token });
        if (revoked) return null;

        const user = await User.findById(decoded.id).select("_id isBanned bannedUntil").lean();
        if (!user) return null;

        const bannedUntil = (user as any).bannedUntil ? new Date((user as any).bannedUntil) : null;
        const banActive = !!(user as any).isBanned && (!bannedUntil || bannedUntil.getTime() > Date.now());
        if (banActive) return null;

        if ((user as any).isBanned && bannedUntil && bannedUntil.getTime() <= Date.now()) {
            await User.updateOne(
                { _id: decoded.id },
                { $set: { isBanned: false }, $unset: { bannedUntil: "", banReason: "", bannedAt: "", bannedBy: "" } }
            ).catch(() => {});
        }

        return decoded.id;
    } catch {
        return null;
    }
}
