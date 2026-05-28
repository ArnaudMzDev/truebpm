import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const OUT_DIR = new URL(".", import.meta.url).pathname;
const PNG_DIR = join(OUT_DIR, "png");
const SVG_DIR = join(OUT_DIR, "svg");
const SOURCE_DIR = join(OUT_DIR, "source");

rmSync(PNG_DIR, { recursive: true, force: true });
rmSync(SVG_DIR, { recursive: true, force: true });
mkdirSync(PNG_DIR, { recursive: true });
mkdirSync(SVG_DIR, { recursive: true });

const WIDTH = 1290;
const HEIGHT = 2796;
const PHONE_W = 944;
const PHONE_H = 2052;
const PHONE_X = Math.round((WIDTH - PHONE_W) / 2);
const PHONE_Y = 690;

const colors = {
    bg: "#030407",
    bg2: "#080A10",
    surface: "#0D1119",
    stroke: "#252B39",
    text: "#F8F8FF",
    soft: "#C8CEDA",
    muted: "#7B8495",
    purple: "#9A55FF",
    purpleDeep: "#5E17EB",
    violet: "#7A2CFF",
    blue: "#181C2A",
};

const pages = [
    {
        file: "01-profile",
        source: "01-profile.png",
        kicker: "PROFIL MUSICAL",
        title: ["Affiche ton", "univers musical."],
        body: "Artistes favoris, son epingle, notes et identite sociale au meme endroit.",
        offset: -8,
    },
    {
        file: "02-search",
        source: "02-search.png",
        kicker: "RECHERCHE",
        title: ["Trouve le son", "en quelques secondes."],
        body: "Recherche, tendances et reconnaissance native Apple ShazamKit.",
        offset: 10,
    },
    {
        file: "03-create",
        source: "03-create.png",
        kicker: "CREATION",
        title: ["Note simple", "ou multi-criteres."],
        body: "Publie un avis musical precis, lisible et rapide a partager.",
        offset: -4,
    },
    {
        file: "04-post-detail",
        source: "04-post-detail.png",
        kicker: "AVIS",
        title: ["Des notes", "qui lancent la discussion."],
        body: "Un post rassemble score, extrait audio, reactions et commentaires.",
        offset: 8,
    },
    {
        file: "05-player",
        source: "05-player.png",
        kicker: "PREVIEW AUDIO",
        title: ["Ecoute avant", "de noter."],
        body: "Lance l'extrait, ressens le morceau, puis partage ton avis.",
        offset: -10,
    },
    {
        file: "06-comments",
        source: "06-comments.png",
        kicker: "DISCUSSION",
        title: ["Reagis aux avis", "de tes potes."],
        body: "Commentaires, partages et reactions gardent la musique vivante.",
        offset: 6,
    },
];

function esc(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function text(value, x, y, size, opts = {}) {
    const {
        fill = colors.text,
        weight = 800,
        anchor = "start",
        opacity = 1,
        spacing = 0,
        family = "Inter, SF Pro Display, Helvetica Neue, Arial, sans-serif",
    } = opts;

    return `<text x="${x}" y="${y}" fill="${fill}" opacity="${opacity}" font-family="${family}" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}" text-anchor="${anchor}">${esc(value)}</text>`;
}

function rect(x, y, w, h, r, fill, opts = {}) {
    const { stroke = "none", sw = 0, opacity = 1 } = opts;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" opacity="${opacity}" stroke="${stroke}" stroke-width="${sw}"/>`;
}

function circle(cx, cy, r, fill, opts = {}) {
    const { opacity = 1 } = opts;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${opacity}"/>`;
}

function compose(page) {
    const sourcePath = join(SOURCE_DIR, page.source);

    if (!existsSync(sourcePath)) {
        throw new Error(`Capture introuvable: ${sourcePath}`);
    }

    const imageHref = `data:image/png;base64,${readFileSync(sourcePath).toString("base64")}`;
    const phoneX = PHONE_X + page.offset;
    const haloX = page.offset > 0 ? "72%" : "28%";

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
        <radialGradient id="ambient-a" cx="${haloX}" cy="17%" r="62%">
            <stop offset="0%" stop-color="${colors.purple}" stop-opacity="0.48"/>
            <stop offset="42%" stop-color="${colors.purpleDeep}" stop-opacity="0.16"/>
            <stop offset="100%" stop-color="${colors.bg}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="ambient-b" cx="16%" cy="74%" r="54%">
            <stop offset="0%" stop-color="${colors.violet}" stop-opacity="0.24"/>
            <stop offset="100%" stop-color="${colors.bg}" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="phone-stroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#41495C"/>
            <stop offset="44%" stop-color="#1E2431"/>
            <stop offset="100%" stop-color="#5D36A9"/>
        </linearGradient>
        <filter id="phone-shadow" x="-25%" y="-12%" width="150%" height="135%">
            <feDropShadow dx="0" dy="48" stdDeviation="44" flood-color="#000000" flood-opacity="0.72"/>
            <feDropShadow dx="0" dy="0" stdDeviation="28" flood-color="${colors.purpleDeep}" flood-opacity="0.16"/>
        </filter>
        <clipPath id="screen-clip-${page.file}">
            <rect x="${phoneX}" y="${PHONE_Y}" width="${PHONE_W}" height="${PHONE_H}" rx="78"/>
        </clipPath>
    </defs>

    ${rect(0, 0, WIDTH, HEIGHT, 0, colors.bg)}
    ${rect(0, 0, WIDTH, HEIGHT, 0, "url(#ambient-a)")}
    ${rect(0, 0, WIDTH, HEIGHT, 0, "url(#ambient-b)")}
    ${rect(0, 0, WIDTH, HEIGHT, 0, "#000000", { opacity: 0.1 })}

    ${circle(1092, 138, 5, colors.purple, { opacity: 0.62 })}
    ${circle(1140, 138, 5, colors.purple, { opacity: 0.34 })}
    ${circle(1188, 138, 5, colors.purple, { opacity: 0.18 })}

    ${text("TrueBPM", 82, 150, 46, { weight: 950, spacing: -1 })}
    ${text(page.kicker, 82, 262, 34, { weight: 950, spacing: 4, fill: colors.purple })}
    ${text(page.title[0], 82, 386, 106, { weight: 950 })}
    ${text(page.title[1], 82, 510, page.title[1].length > 22 ? 92 : 106, { weight: 950 })}
    ${text(page.body, 84, 598, 38, { weight: 760, fill: colors.soft })}

    <g filter="url(#phone-shadow)">
        ${rect(phoneX - 36, PHONE_Y + 220, 10, 154, 5, "#171C28")}
        ${rect(phoneX - 36, PHONE_Y + 416, 10, 226, 5, "#171C28")}
        ${rect(phoneX - 36, PHONE_Y + 676, 10, 226, 5, "#171C28")}
        ${rect(phoneX + PHONE_W + 26, PHONE_Y + 504, 10, 286, 5, "#171C28")}
        ${rect(phoneX - 30, PHONE_Y - 30, PHONE_W + 60, PHONE_H + 60, 118, "#020306", { stroke: "url(#phone-stroke)", sw: 6 })}
        ${rect(phoneX - 15, PHONE_Y - 15, PHONE_W + 30, PHONE_H + 30, 98, "#111722", { stroke: "#394153", sw: 3 })}
        ${rect(phoneX - 5, PHONE_Y - 5, PHONE_W + 10, PHONE_H + 10, 86, "#020306")}
        <image href="${imageHref}" x="${phoneX}" y="${PHONE_Y}" width="${PHONE_W}" height="${PHONE_H}" preserveAspectRatio="xMidYMid slice" clip-path="url(#screen-clip-${page.file})"/>
        ${rect(phoneX, PHONE_Y, PHONE_W, PHONE_H, 78, "transparent", { stroke: "#303849", sw: 2 })}
        ${rect(phoneX + PHONE_W / 2 - 94, PHONE_Y + 28, 188, 42, 21, "#010204", { opacity: 0.68 })}
    </g>
</svg>`;
}

for (const page of pages) {
    const svg = compose(page);
    const svgPath = join(SVG_DIR, `${page.file}.svg`);
    const pngPath = join(PNG_DIR, `${page.file}.png`);

    writeFileSync(svgPath, svg, "utf8");
    execFileSync("rsvg-convert", ["-w", String(WIDTH), "-h", String(HEIGHT), svgPath, "-o", pngPath]);
}

execFileSync("magick", [
    "montage",
    ...pages.map((page) => join(PNG_DIR, `${page.file}.png`)),
    "-thumbnail",
    "260x",
    "-background",
    "#030407",
    "-geometry",
    "+18+18",
    join(OUT_DIR, "contact-sheet.png"),
]);

writeFileSync(
    join(OUT_DIR, "README.md"),
    `# TrueBPM App Store Screenshots

Exports PNG 6.7 pouces : ${WIDTH} x ${HEIGHT}.

Ce pack utilise les vraies captures de l'app stockees dans source/.

Fichiers :
- png/01-profile.png
- png/02-search.png
- png/03-create.png
- png/04-post-detail.png
- png/05-player.png
- png/06-comments.png

Sources SVG modifiables dans svg/.

Pour regenerer :
\`\`\`bash
node apps/mobile/store-assets/app-store/generate-screenshots.mjs
\`\`\`
`,
    "utf8"
);
