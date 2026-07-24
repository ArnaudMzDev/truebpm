import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import { cleanHttpUrl, cleanText } from "@/lib/sanitize";
import ArtistRelease from "@/models/ArtistRelease";

export const dynamic = "force-dynamic";

function serializeRelease(item: any) {
    return {
        _id: String(item._id),
        artistId: item.artistId,
        artistName: item.artistName,
        itemId: item.itemId,
        itemType: item.itemType,
        title: item.title,
        coverUrl: item.coverUrl || "",
        previewUrl: item.previewUrl || "",
        releaseDate: item.releaseDate || "",
        listenedAt: item.listenedAt ? item.listenedAt.toISOString?.() || item.listenedAt : null,
    };
}

function normalizeManualRelease(input: any) {
    const itemType = cleanText(input?.entityType || input?.itemType, 20);
    const itemId = cleanText(input?.entityId || input?.itemId || input?.id, 180);
    const title = cleanText(input?.title || input?.name, 180);
    const artistName = cleanText(input?.artist || input?.artistName, 180);

    if ((itemType !== "song" && itemType !== "album") || !itemId || !title) {
        return null;
    }

    return {
        artistId: `manual:${(artistName || "unknown").toLowerCase().replace(/[^a-z0-9]+/gi, "-").slice(0, 80)}`,
        artistName: artistName || "Artiste inconnu",
        itemId,
        itemType,
        title,
        coverUrl: cleanHttpUrl(input?.coverUrl || input?.cover),
        previewUrl: cleanHttpUrl(input?.previewUrl),
    };
}

export async function GET(req: Request) {
    try {
        await connectDB();

        const userId = await requireUserId(req);
        if (!userId) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const limit = Math.min(Math.max(Number(searchParams.get("limit") || 100), 1), 100);

        const [toListen, listened] = await Promise.all([
            ArtistRelease.find({ userId, listenedAt: null })
                .sort({ releaseDate: -1, createdAt: -1 })
                .limit(limit)
                .lean(),
            ArtistRelease.find({ userId, listenedAt: { $ne: null } })
                .sort({ listenedAt: -1, releaseDate: -1 })
                .limit(limit)
                .lean(),
        ]);

        return NextResponse.json(
            {
                toListen: toListen.map(serializeRelease),
                listened: listened.map(serializeRelease),
            },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    } catch (err) {
        console.error("GET /api/artist-releases/me error:", err);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await connectDB();

        const userId = await requireUserId(req);
        if (!userId) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        const body = await req.json().catch(() => null);
        const item = normalizeManualRelease(body?.item || body);
        const listened = body?.listened === true;

        if (!item) {
            return NextResponse.json({ error: "Morceau ou album invalide." }, { status: 400 });
        }

        const existing = await ArtistRelease.findOne({ userId, itemId: item.itemId })
            .select({ listenedAt: 1 })
            .lean();
        const alreadyInTargetList =
            existing &&
            (listened ? existing.listenedAt !== null : existing.listenedAt === null);

        if (!alreadyInTargetList) {
            const targetCount = await ArtistRelease.countDocuments({
                userId,
                listenedAt: listened ? { $ne: null } : null,
            });

            if (targetCount >= 100) {
                return NextResponse.json(
                    { error: "Cette liste contient déjà 100 sons." },
                    { status: 400 }
                );
            }
        }

        const release = await ArtistRelease.findOneAndUpdate(
            { userId, itemId: item.itemId },
            {
                $set: {
                    ...item,
                    source: "manual",
                    listenedAt: listened ? new Date() : null,
                },
                $setOnInsert: {
                    userId,
                    releaseDate: new Date().toISOString().slice(0, 10),
                    notifiedAt: null,
                },
            },
            { new: true, upsert: true }
        ).lean();

        return NextResponse.json(
            { success: true, release: serializeRelease(release) },
            { status: 201, headers: { "Cache-Control": "no-store" } }
        );
    } catch (err) {
        console.error("POST /api/artist-releases/me error:", err);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        await connectDB();

        const userId = await requireUserId(req);
        if (!userId) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        const body = await req.json().catch(() => null);
        const releaseId = typeof body?.releaseId === "string" ? body.releaseId : "";
        const listened = body?.listened === true;

        if (!releaseId) {
            return NextResponse.json({ error: "Sortie invalide." }, { status: 400 });
        }

        const release = await ArtistRelease.findOneAndUpdate(
            { _id: releaseId, userId },
            { $set: { listenedAt: listened ? new Date() : null } },
            { new: true }
        ).lean();

        if (!release) {
            return NextResponse.json({ error: "Sortie introuvable." }, { status: 404 });
        }

        return NextResponse.json(
            { success: true, release: serializeRelease(release) },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    } catch (err) {
        console.error("PATCH /api/artist-releases/me error:", err);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        await connectDB();

        const userId = await requireUserId(req);
        if (!userId) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        const body = await req.json().catch(() => null);
        const releaseId = typeof body?.releaseId === "string" ? body.releaseId : "";

        if (!releaseId) {
            return NextResponse.json({ error: "Sortie invalide." }, { status: 400 });
        }

        const result = await ArtistRelease.deleteOne({ _id: releaseId, userId });
        if (result.deletedCount < 1) {
            return NextResponse.json({ error: "Sortie introuvable." }, { status: 404 });
        }

        return NextResponse.json(
            { success: true },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    } catch (err) {
        console.error("DELETE /api/artist-releases/me error:", err);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}
