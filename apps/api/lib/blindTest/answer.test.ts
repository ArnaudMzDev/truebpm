import assert from "node:assert/strict";
import test from "node:test";
import {
    buildArtistAliases,
    buildTitleAliases,
    levenshteinDistance,
    matchesAnswer,
    normalizeAnswer,
} from "./answer";

test("normalise accents, ponctuation, tirets et featuring", () => {
    assert.equal(normalizeAnswer("L’Été - feat. Jäy-Z"), "lete feat jay z");
    assert.equal(normalizeAnswer("Aya & Damso"), "aya and damso");
});

test("accepte une version de titre raisonnable sans comparaison includes", () => {
    const aliases = buildTitleAliases("Get Lucky (Radio Edit)");
    assert.equal(matchesAnswer("Get Lucky", "Get Lucky (Radio Edit)", aliases, "title"), true);
    assert.equal(matchesAnswer("Lucky", "Get Lucky (Radio Edit)", aliases, "title"), false);
});

test("accepte un alias artiste et une faute légère", () => {
    const aliases = buildArtistAliases("The Weeknd feat. Daft Punk", ["Weeknd"]);
    assert.equal(matchesAnswer("The Weeknd", "The Weeknd feat. Daft Punk", aliases, "artist"), true);
    assert.equal(matchesAnswer("The Weekend", "The Weeknd feat. Daft Punk", aliases, "artist"), true);
});

test("refuse les réponses trop courtes et trop éloignées", () => {
    assert.equal(matchesAnswer("a", "Angèle", [], "artist"), false);
    assert.equal(matchesAnswer("Stromae", "Angèle", [], "artist"), false);
});

test("calcule correctement la distance de Levenshtein", () => {
    assert.equal(levenshteinDistance("stromae", "stomae"), 1);
    assert.equal(levenshteinDistance("album", "artiste"), 6);
});
