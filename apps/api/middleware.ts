import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

type RatePolicy = {
    windowMs: number;
    max: number;
};

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function isObjectId(id: string) {
    return /^[0-9a-fA-F]{24}$/.test(id);
}

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET missing");
    if (process.env.NODE_ENV === "production" && secret.length < 32) {
        throw new Error("JWT_SECRET must be at least 32 characters in production");
    }
    return secret;
}

async function verifyJwtEdge(token: string) {
    if (!token || token.length > 4096) return null;

    const key = new TextEncoder().encode(getJwtSecret());
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    const id = payload?.id;

    if (typeof id !== "string" || !isObjectId(id)) return null;
    return id;
}

function setSecurityHeaders(res: NextResponse) {
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("Referrer-Policy", "no-referrer");
    res.headers.set("Cross-Origin-Resource-Policy", "same-origin");
    res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
    res.headers.set(
        "Permissions-Policy",
        "camera=(), geolocation=(), payment=(), usb=(), browsing-topics=()"
    );
    res.headers.set("Cache-Control", "no-store");

    if (process.env.NODE_ENV === "production") {
        res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    return res;
}

function secureNext(init?: Parameters<typeof NextResponse.next>[0]) {
    return setSecurityHeaders(NextResponse.next(init));
}

function secureJson(body: unknown, init?: ResponseInit) {
    return setSecurityHeaders(NextResponse.json(body, init));
}

function secureEmpty(init?: ResponseInit) {
    return setSecurityHeaders(new NextResponse(null, init));
}

function getAllowedOrigins() {
    return (process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ORIGIN || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
}

function isAllowedDevOrigin(origin: string) {
    if (process.env.NODE_ENV === "production") return false;
    return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin);
}

function isAllowedOrigin(origin: string, allowedOrigins = getAllowedOrigins()) {
    return allowedOrigins.includes(origin) || isAllowedDevOrigin(origin);
}

function applyCors(req: NextRequest, res: NextResponse) {
    const origin = req.headers.get("origin");
    if (!origin) return res;

    if (isAllowedOrigin(origin)) {
        res.headers.set("Access-Control-Allow-Origin", origin);
        res.headers.set("Access-Control-Allow-Credentials", "true");
        res.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
        res.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    }
    res.headers.append("Vary", "Origin");
    return res;
}

function getClientIp(req: NextRequest) {
    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return forwarded || req.headers.get("x-real-ip") || "unknown";
}

function getRatePolicy(pathname: string, method: string): RatePolicy {
    if (method === "OPTIONS") return { windowMs: 60_000, max: 120 };
    if (pathname === "/api/auth/login") return { windowMs: 60_000, max: 8 };
    if (pathname === "/api/auth/register") return { windowMs: 60_000, max: 4 };
    if (pathname.startsWith("/api/uploads/")) return { windowMs: 60_000, max: 8 };
    if (pathname.startsWith("/api/search") || pathname.startsWith("/api/apple") || pathname.startsWith("/api/music")) {
        return { windowMs: 60_000, max: 90 };
    }
    if (method !== "GET" && method !== "HEAD") return { windowMs: 60_000, max: 60 };
    return { windowMs: 60_000, max: 180 };
}

function checkRateLimit(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const policy = getRatePolicy(pathname, req.method);
    const now = Date.now();
    const bucketKey = `${getClientIp(req)}:${req.method}:${pathname}`;
    const current = rateBuckets.get(bucketKey);

    if (!current || current.resetAt <= now) {
        rateBuckets.set(bucketKey, { count: 1, resetAt: now + policy.windowMs });
        return null;
    }

    current.count += 1;
    if (current.count <= policy.max) return null;

    const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return secureJson(
        { error: "Trop de requêtes. Réessaie dans quelques secondes." },
        {
            status: 429,
            headers: { "Retry-After": String(retryAfter) },
        }
    );
}

function checkBodySize(req: NextRequest) {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return null;

    const contentLength = Number(req.headers.get("content-length") || 0);
    if (!Number.isFinite(contentLength) || contentLength <= 0) return null;

    const maxBytes = req.nextUrl.pathname.startsWith("/api/uploads/")
        ? 6 * 1024 * 1024
        : 256 * 1024;

    if (contentLength <= maxBytes) return null;

    return secureJson(
        { error: "Requête trop volumineuse." },
        { status: 413 }
    );
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

    return secureNext({
        request: { headers },
    });
}

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const method = req.method;
    const allowedOrigins = getAllowedOrigins();

    if (method === "OPTIONS") {
        const origin = req.headers.get("origin");
        if (!origin || isAllowedOrigin(origin, allowedOrigins)) {
            return applyCors(req, secureEmpty({ status: 204 }));
        }
        return secureJson({ error: "Origine non autorisée." }, { status: 403 });
    }

    const bodyLimitResponse = checkBodySize(req);
    if (bodyLimitResponse) return applyCors(req, bodyLimitResponse);

    const rateLimitResponse = checkRateLimit(req);
    if (rateLimitResponse) return applyCors(req, rateLimitResponse);

    // -----------------------------
    // ✅ PUBLIC
    // -----------------------------
    if (pathname.startsWith("/api/auth")) return applyCors(req, secureNext());
    if (pathname.startsWith("/api/admin")) return applyCors(req, secureNext());
    if (pathname.startsWith("/api/health")) return applyCors(req, secureNext());

    if (pathname.startsWith("/api/apple")) return applyCors(req, secureNext());
    if (pathname.startsWith("/api/music")) return applyCors(req, secureNext());
    if (method === "GET" && pathname.startsWith("/api/search")) return applyCors(req, secureNext());

    // -----------------------------
    // ✅ PUBLIC but token-aware
    // -----------------------------

    // Feed
    if (method === "GET" && pathname === "/api/posts") {
        const userId = await getUserIdFromAuth(req);
        return applyCors(req, userId ? withInjectedUserId(req, userId) : secureNext());
    }

    // Post detail
    if (method === "GET" && /^\/api\/posts\/[0-9a-fA-F]{24}$/.test(pathname)) {
        const userId = await getUserIdFromAuth(req);
        return applyCors(req, userId ? withInjectedUserId(req, userId) : secureNext());
    }

    // Post comments list
    if (method === "GET" && /^\/api\/posts\/[0-9a-fA-F]{24}\/comments$/.test(pathname)) {
        const userId = await getUserIdFromAuth(req);
        return applyCors(req, userId ? withInjectedUserId(req, userId) : secureNext());
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
        return applyCors(req, userId ? withInjectedUserId(req, userId) : secureNext());
    }

    // Posts by user
    if (method === "GET" && pathname.startsWith("/api/posts/user/")) {
        const parts = pathname.split("/").filter(Boolean);
        const id = parts[3];

        if (id && isObjectId(id)) {
            const userId = await getUserIdFromAuth(req);
            return applyCors(req, userId ? withInjectedUserId(req, userId) : secureNext());
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
                return applyCors(req, secureNext());
            }
        }
    }

    // -----------------------------
    // 🔐 PRIVATE
    // -----------------------------
    const userId = await getUserIdFromAuth(req);

    if (!userId) {
        return applyCors(req, secureJson({ error: "Non authentifié." }, { status: 401 }));
    }

    return applyCors(req, withInjectedUserId(req, userId));
}

export const config = {
    matcher: ["/api/:path*"],
};
