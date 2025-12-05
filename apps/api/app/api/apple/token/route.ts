import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function GET() {
    try {
        const keyId = process.env.APPLE_MUSIC_KEY_ID!;
        const teamId = process.env.APPLE_MUSIC_TEAM_ID!;
        const privateKey = process.env.APPLE_MUSIC_PRIVATE_KEY!;

        const token = jwt.sign(
            {
                iss: teamId,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600 * 24 * 180, // 6 mois
            },
            privateKey,
            {
                algorithm: "ES256",
                header: {
                    alg: "ES256",
                    kid: keyId,
                },
            }
        );

        return NextResponse.json({ token });
    } catch (err) {
        console.error("Apple Music Token Error:", err);
        return NextResponse.json({ error: "Token generation failed" }, { status: 500 });
    }
}