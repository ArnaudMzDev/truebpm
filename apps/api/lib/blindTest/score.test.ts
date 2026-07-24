import assert from "node:assert/strict";
import test from "node:test";
import { calculateBlindTestScore } from "./score";

test("attribue les points artiste, titre et rapidité côté serveur", () => {
    const score = calculateBlindTestScore({
        asksTitle: true,
        asksArtist: true,
        titleCorrect: true,
        artistCorrect: true,
        elapsedMs: 5000,
        durationMs: 20000,
        difficulty: "normal",
        streakBeforeRound: 0,
        hintCount: 0,
        answerMode: "free",
    });

    assert.equal(score.artist, 500);
    assert.equal(score.title, 500);
    assert.equal(score.speed, 375);
    assert.equal(score.nextStreak, 1);
    assert.equal(score.total, 1515);
});

test("applique la pénalité d'indice et le coefficient QCM", () => {
    const free = calculateBlindTestScore({
        asksTitle: true,
        asksArtist: false,
        titleCorrect: true,
        artistCorrect: false,
        elapsedMs: 10000,
        durationMs: 20000,
        difficulty: "normal",
        streakBeforeRound: 1,
        hintCount: 0,
        answerMode: "free",
    });
    const qcm = calculateBlindTestScore({
        asksTitle: true,
        asksArtist: false,
        titleCorrect: true,
        artistCorrect: false,
        elapsedMs: 10000,
        durationMs: 20000,
        difficulty: "normal",
        streakBeforeRound: 1,
        hintCount: 1,
        answerMode: "qcm",
    });

    assert.ok(qcm.total < free.total);
    assert.equal(qcm.hintPenalty, 125);
});

test("ne donne aucun point après expiration ou pour une mauvaise réponse", () => {
    const score = calculateBlindTestScore({
        asksTitle: true,
        asksArtist: true,
        titleCorrect: false,
        artistCorrect: false,
        elapsedMs: 25000,
        durationMs: 20000,
        difficulty: "expert",
        streakBeforeRound: 8,
        hintCount: 2,
        answerMode: "free",
    });

    assert.equal(score.total, 0);
    assert.equal(score.nextStreak, 0);
});
