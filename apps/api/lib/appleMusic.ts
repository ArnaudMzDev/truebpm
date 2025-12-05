import jwt from "jsonwebtoken";

export function generateAppleMusicToken() {
    const TEAM_ID = process.env.APPLE_MUSIC_TEAM_ID!;
    const KEY_ID = process.env.APPLE_MUSIC_KEY_ID!;
    const PRIVATE_KEY = process.env.APPLE_MUSIC_PRIVATE_KEY!.replace(/\\n/g, "\n");

    const token = jwt.sign(
        {
            iss: TEAM_ID,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12, // 12h
        },
        PRIVATE_KEY,
        {
            algorithm: "ES256",
            header: {
                alg: "ES256",
                kid: KEY_ID,
            },
        }
    );

    return token;
}