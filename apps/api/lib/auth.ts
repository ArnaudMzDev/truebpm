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

        const [scheme, token] = header.split(" ");
        if (!scheme || !token) return null;
        if (scheme.toLowerCase() !== "bearer") return null;

        const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
        return decoded?.id ?? null;
    } catch {
        return null;
    }
}