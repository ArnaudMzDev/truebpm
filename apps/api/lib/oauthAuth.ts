import "@/lib/loadModels";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { createRemoteJWKSet, jwtVerify } from "jose";
import User from "@/models/User";
import { signToken } from "@/lib/auth";

type OAuthProvider = "apple" | "google";

type OAuthProfile = {
    provider: OAuthProvider;
    providerId: string;
    email: string;
    emailVerified: boolean;
    displayName?: string;
};

type OAuthResult = {
    token: string;
    user: any;
};

const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

const USER_SELECT =
    "_id pseudo email emailVerifiedAt avatarUrl bannerUrl bio followers following followersList followingList notesCount createdAt";

function cleanString(value: unknown, maxLength = 120) {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function boolish(value: unknown) {
    return value === true || value === "true" || value === "1";
}

function getAppleAudience() {
    return (
        process.env.APPLE_OAUTH_CLIENT_ID ||
        process.env.APPLE_BUNDLE_ID ||
        "fr.truebpm.app"
    );
}

function getGoogleAudiences() {
    const values = [
        process.env.GOOGLE_OAUTH_CLIENT_IDS,
        process.env.GOOGLE_IOS_CLIENT_ID,
        process.env.GOOGLE_ANDROID_CLIENT_ID,
        process.env.GOOGLE_WEB_CLIENT_ID,
    ]
        .filter(Boolean)
        .flatMap((value) => String(value).split(","))
        .map((value) => value.trim())
        .filter(Boolean);

    return Array.from(new Set(values));
}

function pseudoFromProfile(profile: OAuthProfile) {
    const base =
        cleanString(profile.displayName, 30) ||
        cleanString(profile.email.split("@")[0], 30) ||
        "TrueBPM";

    const cleaned = base
        .replace(/[^\p{L}\p{N}_.-]+/gu, "")
        .slice(0, 30);

    return cleaned.length >= 2 ? cleaned : `TBPM${crypto.randomInt(1000, 9999)}`;
}

function formatBanRemaining(bannedUntil: Date | null) {
    if (!bannedUntil) return "durée indéterminée";

    const ms = bannedUntil.getTime() - Date.now();
    if (ms <= 0) return "";

    const minutes = Math.ceil(ms / 60000);
    if (minutes < 60) return `${minutes} min`;

    const hours = Math.ceil(minutes / 60);
    if (hours < 24) return `${hours} h`;

    const days = Math.ceil(hours / 24);
    return `${days} j`;
}

export function buildOAuthBanPayload(userDoc: any) {
    const bannedUntil = userDoc?.bannedUntil ? new Date(userDoc.bannedUntil) : null;
    const active = !!userDoc?.isBanned && (!bannedUntil || bannedUntil.getTime() > Date.now());
    if (!active) return null;

    const reason = cleanString(userDoc.banReason, 500);
    const remaining = formatBanRemaining(bannedUntil);
    const details = [];

    if (reason) details.push(`Raison : ${reason}`);
    if (remaining) details.push(`Durée restante : ${remaining}`);

    return {
        error: details.length
            ? `Ce compte est suspendu. ${details.join(". ")}.`
            : "Ce compte est suspendu.",
        ban: {
            reason,
            bannedUntil: bannedUntil?.toISOString() || null,
            remaining,
        },
    };
}

export async function verifyAppleIdentityToken(identityToken: string, fallbackEmail?: string, fallbackName?: string) {
    const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
        issuer: "https://appleid.apple.com",
        audience: getAppleAudience(),
    });

    const providerId = cleanString(payload.sub);
    if (!providerId) throw new Error("APPLE_TOKEN_INVALID");

    return {
        provider: "apple" as const,
        providerId,
        email: cleanString(payload.email || fallbackEmail).toLowerCase(),
        emailVerified: boolish(payload.email_verified) || !!fallbackEmail,
        displayName: cleanString(fallbackName),
    };
}

export async function verifyGoogleIdToken(idToken: string) {
    const audiences = getGoogleAudiences();
    if (!audiences.length) throw new Error("GOOGLE_OAUTH_NOT_CONFIGURED");

    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
        audience: audiences,
    });

    const issuer = cleanString(payload.iss);
    if (issuer !== "https://accounts.google.com" && issuer !== "accounts.google.com") {
        throw new Error("GOOGLE_TOKEN_INVALID");
    }

    const providerId = cleanString(payload.sub);
    const email = cleanString(payload.email).toLowerCase();
    if (!providerId || !email) throw new Error("GOOGLE_TOKEN_INVALID");

    return {
        provider: "google" as const,
        providerId,
        email,
        emailVerified: boolish(payload.email_verified),
        displayName: cleanString(payload.name || payload.given_name),
    };
}

function oauthAccount(profile: OAuthProfile) {
    return {
        provider: profile.provider,
        providerId: profile.providerId,
        email: profile.email,
        linkedAt: new Date(),
    };
}

async function createOAuthPasswordHash(profile: OAuthProfile) {
    const raw = `oauth:${profile.provider}:${profile.providerId}:${crypto.randomUUID()}`;
    return bcrypt.hash(raw, 12);
}

async function serializeOAuthSession(userId: any): Promise<OAuthResult> {
    const userDoc = await User.findById(userId).select("_id sessionVersion isBanned bannedUntil banReason").lean();
    if (!userDoc) throw new Error("USER_NOT_FOUND");

    const banPayload = buildOAuthBanPayload(userDoc);
    if (banPayload) {
        const error = new Error("ACCOUNT_BANNED") as Error & { payload?: any };
        error.payload = banPayload;
        throw error;
    }

    const token = signToken(String(userDoc._id), Number((userDoc as any).sessionVersion || 0));
    const user = await User.findById(userDoc._id).select(USER_SELECT).lean();
    if (!user) throw new Error("USER_NOT_FOUND");

    return { token, user };
}

export async function findOrCreateOAuthUser(profile: OAuthProfile) {
    const existingByProvider = await User.findOne({
        oauthAccounts: {
            $elemMatch: {
                provider: profile.provider,
                providerId: profile.providerId,
            },
        },
    }).select("_id");

    if (existingByProvider) {
        return serializeOAuthSession(existingByProvider._id);
    }

    if (!profile.email) {
        throw new Error("OAUTH_EMAIL_REQUIRED");
    }

    const now = new Date();
    const existingByEmail = await User.findOne({ email: profile.email });

    if (existingByEmail) {
        const update: any = {
            $addToSet: { oauthAccounts: oauthAccount(profile) },
            $unset: { loginLockedUntil: "" },
            $set: { loginFailedCount: 0 },
        };

        if (profile.emailVerified && !existingByEmail.emailVerifiedAt) {
            update.$set.emailVerifiedAt = now;
        }

        await User.updateOne({ _id: existingByEmail._id }, update);
        return serializeOAuthSession(existingByEmail._id);
    }

    const user = await User.create({
        pseudo: pseudoFromProfile(profile),
        email: profile.email,
        password: await createOAuthPasswordHash(profile),
        emailVerifiedAt: profile.emailVerified ? now : null,
        oauthAccounts: [oauthAccount(profile)],
        legalAcceptedAt: now,
        termsVersion: "2026-05-26",
        privacyVersion: "2026-05-26",
    });

    return serializeOAuthSession(user._id);
}

export function oauthErrorResponse(err: unknown) {
    const error = err as Error & { payload?: any };

    if (error?.message === "ACCOUNT_BANNED" && error.payload) {
        return { body: error.payload, status: 403 };
    }

    if (error?.message === "GOOGLE_OAUTH_NOT_CONFIGURED") {
        return {
            body: { error: "Connexion Google non configurée côté serveur." },
            status: 500,
        };
    }

    if (error?.message === "OAUTH_EMAIL_REQUIRED") {
        return {
            body: { error: "Impossible de récupérer l'adresse e-mail du compte." },
            status: 400,
        };
    }

    return {
        body: { error: "Connexion sociale impossible." },
        status: 401,
    };
}
