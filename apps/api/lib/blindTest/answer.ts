const VERSION_WORDS =
    /\b(remaster(?:ed)?|radio edit|edit|remix|mix|version|live|acoustic|instrumental|deluxe|bonus track|mono|stereo)\b/i;

export function normalizeAnswer(value: unknown) {
    if (typeof value !== "string") return "";

    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[’‘`´]/g, "'")
        .replace(/\b(featuring|feat\.?|ft\.?)\b/g, " feat ")
        .replace(/&/g, " and ")
        .replace(/[–—-]/g, " ")
        .replace(/['.]/g, "")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function stripTitleVersion(value: string) {
    const withoutParenthetical = value.replace(/\s*[([]([^\])]+)[\])]/g, (match, content) =>
        VERSION_WORDS.test(content) ? "" : match
    );

    const dashParts = withoutParenthetical.split(/\s+[–—-]\s+/);
    if (dashParts.length > 1 && VERSION_WORDS.test(dashParts[dashParts.length - 1])) {
        dashParts.pop();
    }

    return dashParts.join(" - ").trim();
}

export function buildTitleAliases(title: string, aliases: string[] = []) {
    return uniqueNormalized([title, stripTitleVersion(title), ...aliases]);
}

export function buildArtistAliases(artist: string, aliases: string[] = []) {
    const primary = artist.split(/\b(?:feat(?:uring)?|ft)\.?\b/i)[0]?.trim();
    const collaborators = artist
        .split(/\s+(?:&|and|x)\s+|\s*,\s*/i)
        .map((part) => part.trim())
        .filter((part) => part.length >= 3);

    return uniqueNormalized([artist, primary, ...collaborators, ...aliases]);
}

function uniqueNormalized(values: Array<string | undefined>) {
    return Array.from(
        new Set(values.map(normalizeAnswer).filter((value) => value.length >= 2))
    );
}

export function levenshteinDistance(left: string, right: string) {
    if (left === right) return 0;
    if (!left.length) return right.length;
    if (!right.length) return left.length;

    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

    for (let i = 1; i <= left.length; i += 1) {
        const current = [i];
        for (let j = 1; j <= right.length; j += 1) {
            const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
            current[j] = Math.min(
                current[j - 1] + 1,
                previous[j] + 1,
                previous[j - 1] + substitutionCost
            );
        }
        previous = current;
    }

    return previous[right.length];
}

function allowedDistance(length: number) {
    if (length <= 4) return 0;
    if (length <= 7) return 1;
    if (length <= 12) return 2;
    return Math.min(3, Math.floor(length * 0.16));
}

export function matchesAnswer(
    submitted: unknown,
    expected: string,
    aliases: string[] = [],
    kind: "title" | "artist" = "title"
) {
    const answer = normalizeAnswer(submitted);
    if (answer.length < 2) return false;

    const candidates =
        kind === "artist"
            ? buildArtistAliases(expected, aliases)
            : buildTitleAliases(expected, aliases);

    return candidates.some((candidate) => {
        if (answer === candidate) return true;
        if (answer.length < 4 || candidate.length < 4) return false;

        const maxDistance = allowedDistance(Math.max(answer.length, candidate.length));
        if (Math.abs(answer.length - candidate.length) > maxDistance) return false;

        return levenshteinDistance(answer, candidate) <= maxDistance;
    });
}
