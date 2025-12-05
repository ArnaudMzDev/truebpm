import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

export function middleware(req: NextRequest) {
    const protectedRoutes = ["/api/user/me"]; // tu pourras en ajouter

    if (protectedRoutes.includes(req.nextUrl.pathname)) {
        const token = req.headers.get("authorization")?.replace("Bearer ", "");

        if (!token) {
            return NextResponse.json(
                { error: "Token manquant." },
                { status: 401 }
            );
        }

        try {
            jwt.verify(token, process.env.JWT_SECRET!);
            return NextResponse.next();
        } catch (err) {
            return NextResponse.json(
                { error: "Token invalide ou expiré." },
                { status: 401 }
            );
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/api/user/:path*"],
};