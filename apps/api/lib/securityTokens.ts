import crypto from "crypto";

export function createSecurityToken() {
    return crypto.randomBytes(32).toString("base64url");
}

export function createVerificationCode() {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashSecurityToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

export function minutesFromNow(minutes: number) {
    return new Date(Date.now() + minutes * 60_000);
}
