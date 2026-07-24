import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import { questionRequirements, validSessionId } from "@/lib/blindTest/session";
import BlindTestSession from "@/models/BlindTestSession";
import BlindTestTrack from "@/models/BlindTestTrack";

export const dynamic = "force-dynamic";

function firstVisibleLetter(value: string) {
    return Array.from(value.trim()).find((character) => /[\p{L}\p{N}]/u.test(character))?.toUpperCase() || "?";
}

export async function POST(req: Request, { params }: { params: { sessionId: string } }) {
    try {
        await connectDB();
        const userId = await requireUserId(req);
        if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        if (!validSessionId(params.sessionId)) {
            return NextResponse.json({ error: "Partie invalide." }, { status: 400 });
        }

        const session: any = await BlindTestSession.findOne({
            _id: params.sessionId,
            userId,
            status: "active",
        }).lean();
        if (!session) return NextResponse.json({ error: "Partie active introuvable." }, { status: 404 });

        const round = session.rounds?.[session.currentRound];
        if (!round || round.answeredAt) {
            return NextResponse.json({ error: "Cette manche est terminée." }, { status: 409 });
        }
        if (Date.now() > new Date(round.endsAt).getTime()) {
            return NextResponse.json({ error: "Le temps est écoulé." }, { status: 409 });
        }

        const track: any = await BlindTestTrack.findById(round.trackId).lean();
        if (!track) return NextResponse.json({ error: "Morceau introuvable." }, { status: 404 });
        const requirements = questionRequirements(round.questionType);
        const used = new Set<string>(round.hintsUsed || []);

        let key = "";
        let label = "";
        let value = "";
        if (requirements.asksTitle && !used.has("title-first-letter")) {
            key = "title-first-letter";
            label = "Première lettre du titre";
            value = firstVisibleLetter(track.title);
        } else if (requirements.asksArtist && !used.has("artist-first-letter")) {
            key = "artist-first-letter";
            label = "Première lettre de l’artiste";
            value = firstVisibleLetter(track.artist);
        } else if (track.year && !used.has("year")) {
            key = "year";
            label = "Année de sortie";
            value = String(track.year);
        } else if (track.album && !used.has("album")) {
            key = "album";
            label = "Album";
            value = track.album;
        }

        if (!key) return NextResponse.json({ error: "Plus aucun indice disponible." }, { status: 409 });

        const roundPath = `rounds.${session.currentRound}`;
        const updated = await BlindTestSession.findOneAndUpdate(
            {
                _id: session._id,
                userId,
                status: "active",
                currentRound: session.currentRound,
                [`${roundPath}.answeredAt`]: null,
                [`${roundPath}.hintsUsed`]: { $ne: key },
            },
            { $addToSet: { [`${roundPath}.hintsUsed`]: key } },
            { new: true }
        ).lean();

        if (!updated) return NextResponse.json({ error: "Cet indice a déjà été utilisé." }, { status: 409 });
        return NextResponse.json({ hint: { key, label, value, penalty: 125 } });
    } catch (error) {
        console.error("POST /api/blind-test/sessions/:id/hint error:", error);
        return NextResponse.json({ error: "Impossible d’afficher un indice." }, { status: 500 });
    }
}
