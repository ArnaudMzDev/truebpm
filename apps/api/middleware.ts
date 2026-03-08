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

function withInjectedUserId(req: NextRequest, userId: string) {
    const headers = new Headers(req.headers);
    headers.set("x-user-id", userId);

    return NextResponse.next({
        request: { headers },
    });
}

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const method = req.method;

    // -----------------------------
    // ✅ PUBLIC
    // -----------------------------
    if (pathname.startsWith("/api/auth")) return NextResponse.next();
    if (pathname.startsWith("/api/health")) return NextResponse.next();

    if (pathname.startsWith("/api/apple")) return NextResponse.next();
    if (pathname.startsWith("/api/music")) return NextResponse.next();
    if (method === "GET" && pathname.startsWith("/api/search")) return NextResponse.next();

    // -----------------------------
    // ✅ PUBLIC but token-aware
    // -----------------------------

    // Feed
    if (method === "GET" && pathname === "/api/posts") {
        const userId = await getUserIdFromAuth(req);
        return userId ? withInjectedUserId(req, userId) : NextResponse.next();
    }

    // Post detail
    if (method === "GET" && /^\/api\/posts\/[0-9a-fA-F]{24}$/.test(pathname)) {
        const userId = await getUserIdFromAuth(req);
        return userId ? withInjectedUserId(req, userId) : NextResponse.next();
    }

    // Post comments list
    if (method === "GET" && /^\/api\/posts\/[0-9a-fA-F]{24}\/comments$/.test(pathname)) {
        const userId = await getUserIdFromAuth(req);
        return userId ? withInjectedUserId(req, userId) : NextResponse.next();
    }

    // Comment replies / thread
    if (
        method === "GET" &&
        (
            /^\/api\/comments\/[0-9a-fA-F]{24}\/replies$/.test(pathname) ||
            /^\/api\/comments\/[0-9a-fA-F]{24}\/thread$/.test(pathname)
        )
    ) {
        const userId = await getUserIdFromAuth(req);
        return userId ? withInjectedUserId(req, userId) : NextResponse.next();
    }

    // Posts by user
    if (method === "GET" && pathname.startsWith("/api/posts/user/")) {
        const parts = pathname.split("/").filter(Boolean);
        const id = parts[3];

        if (id && isObjectId(id)) {
            const userId = await getUserIdFromAuth(req);
            return userId ? withInjectedUserId(req, userId) : NextResponse.next();
        }
    }

    // Public user routes
    if (method === "GET" && pathname.startsWith("/api/user/")) {
        const parts = pathname.split("/").filter(Boolean);
        const third = parts[2];

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
    // 🔐 PRIVATE
    // -----------------------------
    const userId = await getUserIdFromAuth(req);

    if (!userId) {
        return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    return withInjectedUserId(req, userId);
}

export const config = {
    matcher: ["/api/:path*"],
};