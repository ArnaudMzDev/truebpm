import jwt from "jsonwebtoken";

// ----------------------------
// SIGN TOKEN
// ----------------------------
export function signToken(id: string) {
    return jwt.sign({ id }, process.env.JWT_SECRET!, {
        expiresIn: "7d",
    });
}

// ----------------------------
// VERIFY TOKEN pour route.ts
// ----------------------------
export async function verifyToken(req: Request): Promise<string | null> {
    try {
        // 1) Récupération du header Authorization
        const header = req.headers.get("authorization");

        if (!header) return null;

        // 2) Le header doit être "Bearer xxx"
        const token = header.split(" ")[1];
        if (!token) return null;

        // 3) Vérification du token
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };

        return decoded.id;
    } catch (err) {
        console.log("❌ verifyToken error:", err);
        return null;
    }
}