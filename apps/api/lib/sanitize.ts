export function cleanText(value: unknown, maxLength: number) {
    if (typeof value !== "string") return "";
    return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function cleanMultilineText(value: unknown, maxLength: number) {
    if (typeof value !== "string") return "";
    return value
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, maxLength);
}

export function cleanHttpUrl(value: unknown, maxLength = 2048) {
    if (typeof value !== "string") return "";
    const raw = value.trim();
    if (!raw || raw.length > maxLength) return "";

    try {
        const url = new URL(raw);
        if (url.protocol !== "https:" && url.protocol !== "http:") return "";
        return url.toString();
    } catch {
        return "";
    }
}
