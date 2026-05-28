import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
    return NextResponse.json(
        {
            error: "La reconnaissance ShazamKit est native côté iOS.",
            nativeOnly: true,
        },
        { status: 410 }
    );
}
