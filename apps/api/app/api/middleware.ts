import "@/lib/loadModels";
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // On ne protège que l'API
    if (!pathname.startsWith("/api")) {
        return NextResponse.next();
    }

    // Routes publiques (pas d'auth)
    const publicRoutes = [
        "/api/auth/login",
        "/api/auth/register",
        "/api/health",
        "/api/apple/token",
        "/api/apple/search",
        "/api/search/apple",
        "/api/music/token",
        "/api/music/search",
    ];

    if (publicRoutes.some((p) => pathname.startsWith(p))) {
        return NextResponse.next();
    }

    // Vérif token + injection x-user-id
    const userId = await verifyToken(req);

    if (!userId) {
        return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const headers = new Headers(req.headers);
    headers.set("x-user-id", userId);

    return NextResponse.next({
        request: { headers },
    });
}

export const config = {
    matcher: ["/api/:path*"],
};