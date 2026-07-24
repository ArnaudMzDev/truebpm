import assert from "node:assert/strict";
import test from "node:test";
import { buildRounds, nextRoundTransitionFilter } from "./session";

test("la transition de manche compare la date de réponse exacte", () => {
    const answeredAt = new Date("2026-06-21T12:00:00.000Z");
    const filter = nextRoundTransitionFilter(
        {
            _id: "session-id",
            currentRound: 0,
            rounds: [{ answeredAt }, { startedAt: null }],
        },
        "user-id",
        1
    );

    assert.deepEqual(filter["rounds.0.answeredAt"], answeredAt);
    assert.equal(filter["rounds.1.startedAt"], null);
    assert.equal(filter.currentRound, 0);
});

test("les choix QCM gardent leur artwork aligné avec leur libellé", () => {
    const tracks = [
        { _id: "1", title: "Titre A", artist: "Artiste A", artworkUrl: "cover-a" },
        { _id: "2", title: "Titre B", artist: "Artiste B", artworkUrl: "cover-b" },
        { _id: "3", title: "Titre C", artist: "Artiste C", artworkUrl: "cover-c" },
        { _id: "4", title: "Titre D", artist: "Artiste D", artworkUrl: "cover-d" },
    ];
    const [round] = buildRounds(tracks, "qcm", "title");
    const expectedArtwork = new Map(tracks.map((track) => [track.title, track.artworkUrl]));

    assert.equal(round.options.length, 4);
    assert.equal(round.optionArtworks.length, 4);
    round.options.forEach((option: string, index: number) => {
        assert.equal(round.optionArtworks[index], expectedArtwork.get(option));
    });
});
