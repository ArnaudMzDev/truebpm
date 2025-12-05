// apps/api/app/api/music/token/route.ts
import jwt from "jsonwebtoken";

export async function GET() {
    try {
        const TEAM_ID = process.env.APPLE_TEAM_ID!;
        const KEY_ID = process.env.APPLE_KEY_ID!;
        const PRIVATE_KEY = process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n");

        const token = jwt.sign(
            {
                iss: TEAM_ID,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 15777000, // 6 months
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

        return Response.json({ token });
    } catch (err) {
        console.error("Apple Token Error:", err);
        return Response.json({ error: "Token generation failed" }, { status: 500 });
    }
}