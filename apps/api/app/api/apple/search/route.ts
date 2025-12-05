import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const term = searchParams.get("term");
    const type = searchParams.get("type") || "songs";

    if (!term) {
        return NextResponse.json({ error: "Missing term" }, { status: 400 });
    }

    const devToken = await fetch(process.env.NEXT_PUBLIC_API_URL + "/api/apple/token").then(r => r.json()).then(d => d.token);

    const res = await fetch(
        `https://api.music.apple.com/v1/catalog/fr/search?term=${encodeURIComponent(term)}&types=${type}&limit=25`,
        {
            headers: {
                Authorization: `Bearer ${devToken}`,
            },
        }
    );

    const data = await res.json();
    return NextResponse.json(data);
}