import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

function isObjectId(id: string) {
    return /^[0-9a-fA-F]{24}$/.test(id);
}

async function verifyJwtEdge(token: string) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET missing");

    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key);
    const id = payload?.id;

    if (typeof id !== "string" || !isObjectId(id)) return null;
    return id;
}

/**
 * Si Bearer présent et valide -> inject x-user-id
 * Sinon -> null
 */
async function getUserIdFromAuth(req: NextRequest): Promise<string | null> {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return null;

    try {
        return await verifyJwtEdge(token);
    } catch {
        return null;
    }
}

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const method = req.method;

    // -----------------------------
    // ✅ PUBLIC (no auth required)
    // -----------------------------
    if (pathname.startsWith("/api/auth")) return NextResponse.next();
    if (pathname.startsWith("/api/health")) return NextResponse.next();

    // ✅ Posts feed: PUBLIC mais token-aware
    if (method === "GET" && pathname === "/api/posts") {
        const userId = await getUserIdFromAuth(req);
        if (!userId) return NextResponse.next();

        const headers = new Headers(req.headers);
        headers.set("x-user-id", userId);
        return NextResponse.next({ request: { headers } });
    }

    // ✅ Post detail: PUBLIC mais token-aware (pour coeur rouge en détail)
    if (method === "GET" && /^\/api\/posts\/[0-9a-fA-F]{24}$/.test(pathname)) {
        const userId = await getUserIdFromAuth(req);
        if (!userId) return NextResponse.next();

        const headers = new Headers(req.headers);
        headers.set("x-user-id", userId);
        return NextResponse.next({ request: { headers } });
    }

    // ✅ Posts by user: PUBLIC mais token-aware
    if (method === "GET" && pathname.startsWith("/api/posts/user/")) {
        const parts = pathname.split("/").filter(Boolean); // ["api","posts","user",":id"]
        const id = parts[3];
        if (id && isObjectId(id)) {
            const userId = await getUserIdFromAuth(req);
            if (!userId) return NextResponse.next();

            const headers = new Headers(req.headers);
            headers.set("x-user-id", userId);
            return NextResponse.next({ request: { headers } });
        }
    }

    // Search public
    if (method === "GET" && pathname.startsWith("/api/search")) {
        return NextResponse.next();
    }

    // User public: /api/user/:id (+ followers/following)
    if (method === "GET" && pathname.startsWith("/api/user/")) {
        const parts = pathname.split("/").filter(Boolean); // ["api","user",":id",...]
        const third = parts[2];

        // privé
        if (third === "me" || third === "profile") {
            // continue -> auth required
        } else if (third && isObjectId(third)) {
            const fourth = parts[3];
            if (!fourth || fourth === "followers" || fourth === "following") {
                return NextResponse.next();
            }
        }
    }

    // -----------------------------
    // 🔐 PRIVATE (auth required)
    // -----------------------------
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
        return NextResponse.json({ error: "Token manquant." }, { status: 401 });
    }

    try {
        const userId = await verifyJwtEdge(token);
        if (!userId) {
            return NextResponse.json({ error: "Token invalide ou expiré." }, { status: 401 });
        }

        const headers = new Headers(req.headers);
        headers.set("x-user-id", userId);

        return NextResponse.next({ request: { headers } });
    } catch (err) {
        console.error("❌ Middleware JWT error:", err);
        return NextResponse.json({ error: "Token invalide ou expiré." }, { status: 401 });
    }
}

export const config = {
    matcher: ["/api/:path*"],
};