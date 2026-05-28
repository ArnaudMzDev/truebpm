import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import AdminAuditLog from "@/models/AdminAuditLog";
import { cleanText } from "@/lib/sanitize";

const ADMIN_SESSION_COOKIE = "truebpm_admin_session";
const ADMIN_CSRF_COOKIE = "truebpm_admin_csrf";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

type AdminSessionPayload = {
    kind: "admin";
    adminId: string;
    csrfToken: string;
};

export type AdminSession = {
    adminId: string;
    csrfToken: string;
};

function getSessionSecret() {
    const secret = process.env.ADMIN_SESSION_SECRET || process.env.JWT_SECRET;
    if (!secret) throw new Error("ADMIN_SESSION_SECRET or JWT_SECRET is missing");
    if (process.env.NODE_ENV === "production" && secret.length < 32) {
        throw new Error("ADMIN_SESSION_SECRET must be at least 32 characters in production");
    }
    return secret;
}

function getCookie(req: Request, name: string) {
    const cookieHeader = req.headers.get("cookie") || "";
    const cookies = cookieHeader.split(";").map((part) => part.trim());
    const match = cookies.find((part) => part.startsWith(`${name}=`));
    if (!match) return "";
    return decodeURIComponent(match.slice(name.length + 1));
}

function serializeCookie(name: string, value: string, options: { httpOnly?: boolean; maxAge?: number }) {
    const parts = [
        `${name}=${encodeURIComponent(value)}`,
        "Path=/",
        "SameSite=Strict",
    ];

    if (options.httpOnly) parts.push("HttpOnly");
    if (typeof options.maxAge === "number") parts.push(`Max-Age=${options.maxAge}`);
    if (process.env.NODE_ENV === "production") parts.push("Secure");

    return parts.join("; ");
}

function timingSafeEqual(a: string, b: string) {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
}

export async function verifyAdminPassword(password: string) {
    const candidate = cleanText(password, 256);
    if (!candidate) return false;

    const hash = process.env.ADMIN_PASSWORD_HASH;
    if (hash) return bcrypt.compare(candidate, hash);

    const plainSecret = process.env.ADMIN_SECRET;
    if (!plainSecret) return false;
    if (process.env.NODE_ENV === "production" && plainSecret.length < 24) {
        throw new Error("ADMIN_SECRET must be at least 24 characters in production");
    }

    return timingSafeEqual(candidate, plainSecret);
}

export function createAdminSessionResponse(
    body: unknown | ((session: { csrfToken: string; adminId: string }) => unknown)
) {
    const csrfToken = crypto.randomBytes(32).toString("base64url");
    const adminId = "primary-admin";
    const token = jwt.sign(
        { kind: "admin", adminId, csrfToken },
        getSessionSecret(),
        { algorithm: "HS256", expiresIn: SESSION_MAX_AGE_SECONDS }
    );

    const payload = typeof body === "function" ? body({ csrfToken, adminId }) : body;
    const res = NextResponse.json(payload, { status: 200 });
    res.headers.append(
        "Set-Cookie",
        serializeCookie(ADMIN_SESSION_COOKIE, token, { httpOnly: true, maxAge: SESSION_MAX_AGE_SECONDS })
    );
    res.headers.append(
        "Set-Cookie",
        serializeCookie(ADMIN_CSRF_COOKIE, csrfToken, { maxAge: SESSION_MAX_AGE_SECONDS })
    );
    return { response: res, csrfToken, adminId };
}

export function clearAdminSessionResponse(body: unknown = { success: true }) {
    const res = NextResponse.json(body, { status: 200 });
    res.headers.append("Set-Cookie", serializeCookie(ADMIN_SESSION_COOKIE, "", { httpOnly: true, maxAge: 0 }));
    res.headers.append("Set-Cookie", serializeCookie(ADMIN_CSRF_COOKIE, "", { maxAge: 0 }));
    return res;
}

export function verifyAdminSession(req: Request): AdminSession | null {
    const token = getCookie(req, ADMIN_SESSION_COOKIE);
    if (!token || token.length > 4096) return null;

    try {
        const payload = jwt.verify(token, getSessionSecret(), { algorithms: ["HS256"] }) as AdminSessionPayload;
        if (payload?.kind !== "admin" || !payload.adminId || !payload.csrfToken) return null;
        return {
            adminId: payload.adminId,
            csrfToken: payload.csrfToken,
        };
    } catch {
        return null;
    }
}

function getAllowedAdminOrigins() {
    return (process.env.ADMIN_ALLOWED_ORIGINS || process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ORIGIN || "")
        .split(",")
        .map((origin) => origin.trim().replace(/\/$/, ""))
        .filter(Boolean);
}

function isLocalDevOrigin(origin: URL) {
    if (process.env.NODE_ENV === "production") return false;

    return (
        origin.hostname === "localhost" ||
        origin.hostname === "127.0.0.1" ||
        origin.hostname === "::1" ||
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(origin.hostname) ||
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(origin.hostname) ||
        /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(origin.hostname)
    );
}

function verifyOrigin(req: Request) {
    const origin = req.headers.get("origin");
    if (!origin) return true;

    try {
        const originUrl = new URL(origin);
        const requestUrl = new URL(req.url);
        const allowedOrigins = getAllowedAdminOrigins();
        const headerHost = req.headers.get("host");
        const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
        const acceptedHosts = new Set([requestUrl.host, headerHost, forwardedHost].filter(Boolean));

        if (acceptedHosts.has(originUrl.host)) return true;
        if (allowedOrigins.includes(originUrl.origin)) return true;

        return isLocalDevOrigin(originUrl);
    } catch {
        return false;
    }
}

export function requireAdminRequest(req: Request, options: { csrf?: boolean } = {}) {
    const session = verifyAdminSession(req);
    if (!session) {
        return {
            session: null,
            response: NextResponse.json({ error: "Admin non authentifié." }, { status: 401 }),
        };
    }

    if (!verifyOrigin(req)) {
        return {
            session: null,
            response: NextResponse.json({ error: "Origine admin refusée." }, { status: 403 }),
        };
    }

    if (options.csrf) {
        const csrfHeader = req.headers.get("x-admin-csrf") || "";
        if (!csrfHeader || csrfHeader !== session.csrfToken) {
            return {
                session: null,
                response: NextResponse.json({ error: "Protection CSRF invalide." }, { status: 403 }),
            };
        }
    }

    return { session, response: null };
}

export function getRequestAuditMeta(req: Request) {
    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return {
        ip: forwarded || req.headers.get("x-real-ip") || "",
        userAgent: cleanText(req.headers.get("user-agent") || "", 300),
    };
}

export async function writeAdminAuditLog(input: {
    req: Request;
    adminId: string;
    action: string;
    targetType: string;
    targetId: string;
    reason?: string;
    metadata?: Record<string, unknown>;
}) {
    const meta = getRequestAuditMeta(input.req);
    await AdminAuditLog.create({
        adminId: input.adminId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: cleanText(input.reason || "", 500),
        metadata: input.metadata || {},
        ip: meta.ip,
        userAgent: meta.userAgent,
    });
}
