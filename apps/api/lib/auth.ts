import jwt from "jsonwebtoken";

type JwtPayload = { id: string };

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is missing");
    return secret;
}

export function signToken(id: string) {
    return jwt.sign({ id }, getJwtSecret(), { expiresIn: "7d" });
}

export async function verifyToken(req: Request): Promise<string | null> {
    try {
        const header = req.headers.get("authorization");
        if (!header) return null;

        const parts = header.split(" ");
        if (parts.length < 2) return null;

        const scheme = parts[0];
        const token = parts[1];

        if (scheme.toLowerCase() !== "bearer") return null;
        if (!token) return null;

        const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
        return decoded?.id ?? null;
    } catch {
        return null;
    }
}