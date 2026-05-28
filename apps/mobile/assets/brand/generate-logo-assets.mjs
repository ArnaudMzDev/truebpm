import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const OUT_DIR = new URL(".", import.meta.url).pathname;
mkdirSync(OUT_DIR, { recursive: true });

const colors = {
    ink: "#050608",
    surface: "#0A0B10",
    white: "#FFFFFF",
    soft: "#DCE1EC",
    purple: "#9B5CFF",
    purpleDark: "#5E17EB",
    violetDeep: "#230A58",
    magenta: "#D84DFF",
};

function text(value, x, y, size, opts = {}) {
    const {
        fill = colors.white,
        weight = 850,
        anchor = "start",
        spacing = 0,
        family = "Inter, SF Pro Display, Arial, sans-serif",
    } = opts;

    return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}" text-anchor="${anchor}">${value}</text>`;
}

function rect(x, y, w, h, r, fill, opts = {}) {
    const { stroke = "none", sw = 0, opacity = 1 } = opts;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"/>`;
}

function circle(cx, cy, r, fill, opts = {}) {
    const { stroke = "none", sw = 0, opacity = 1 } = opts;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"/>`;
}

function defs() {
    return `
        <defs>
            <linearGradient id="bpm-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="${colors.purple}"/>
                <stop offset="100%" stop-color="${colors.purpleDark}"/>
            </linearGradient>
            <linearGradient id="icon-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="${colors.purple}"/>
                <stop offset="58%" stop-color="${colors.purpleDark}"/>
                <stop offset="100%" stop-color="${colors.violetDeep}"/>
            </linearGradient>
            <radialGradient id="icon-glow" cx="50%" cy="32%" r="68%">
                <stop offset="0%" stop-color="${colors.magenta}" stop-opacity="0.42"/>
                <stop offset="52%" stop-color="${colors.purple}" stop-opacity="0.18"/>
                <stop offset="100%" stop-color="${colors.ink}" stop-opacity="0"/>
            </radialGradient>
            <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="18" result="blur"/>
                <feMerge>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>
    `;
}

function beatBars(x, y, scale = 1, fill = "url(#bpm-gradient)", opacity = 1) {
    const widths = [10, 10, 10, 10];
    const heights = [34, 58, 44, 72];
    return widths
        .map((w, index) => {
            const gap = 12 * scale;
            const h = heights[index] * scale;
            return rect(x + index * (w * scale + gap), y - h, w * scale, h, 999, fill, { opacity });
        })
        .join("");
}

function wordmarkSvg() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="640" viewBox="0 0 2400 640">
    ${defs()}
    ${text("True", 120, 378, 260, { fill: colors.white, weight: 800, spacing: 1 })}
    ${text("BPM", 665, 378, 260, { fill: "url(#bpm-gradient)", weight: 800, spacing: 1 })}
</svg>`;
}

function wordmarkDarkSvg() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="900" viewBox="0 0 2400 900">
    ${defs()}
    ${rect(0, 0, 2400, 900, 0, colors.ink)}
    ${text("True", 560, 535, 300, { fill: colors.white, weight: 800, spacing: 1 })}
    ${text("BPM", 1188, 535, 300, { fill: "url(#bpm-gradient)", weight: 800, spacing: 1 })}
</svg>`;
}

function markSvg() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    ${defs()}
    ${rect(112, 112, 800, 800, 224, colors.ink, { stroke: "#211C32", sw: 10 })}
    ${circle(512, 390, 340, "url(#icon-glow)")}
    ${text("T", 292, 610, 360, { fill: colors.white, weight: 800, spacing: 1 })}
    ${text("B", 510, 610, 360, { fill: "url(#bpm-gradient)", weight: 800, spacing: 1 })}
</svg>`;
}

function appIconSvg() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    ${defs()}
    ${rect(0, 0, 1024, 1024, 0, colors.ink)}
    ${text("T", 154, 604, 250, { fill: colors.white, weight: 800, spacing: 1 })}
    ${text("BPM", 320, 604, 250, { fill: "url(#bpm-gradient)", weight: 800, spacing: 1 })}
</svg>`;
}

const files = [
    ["truebpm-wordmark.svg", wordmarkSvg(), "2400", "640"],
    ["truebpm-wordmark-on-dark.svg", wordmarkDarkSvg(), "2400", "900"],
    ["truebpm-mark.svg", markSvg(), "1024", "1024"],
    ["truebpm-app-icon.svg", appIconSvg(), "1024", "1024"],
];

for (const [name, svg, width, height] of files) {
    const svgPath = join(OUT_DIR, name);
    const pngPath = join(OUT_DIR, name.replace(".svg", ".png"));
    writeFileSync(svgPath, svg, "utf8");
    execFileSync("rsvg-convert", ["-w", width, "-h", height, svgPath, "-o", pngPath]);
}

writeFileSync(
    join(OUT_DIR, "README.md"),
    `# TrueBPM Logo Kit

Logo basé sur le loading screen actuel : \`True\` blanc + \`BPM\` violet.
Version volontairement typographique : aucun pictogramme, aucune barre, aucun élément décoratif.

Exports :
- truebpm-wordmark.svg / .png : logo transparent horizontal
- truebpm-wordmark-on-dark.svg / .png : version présentation sur fond noir
- truebpm-mark.svg / .png : marque carrée TB
- truebpm-app-icon.svg / .png : proposition d’icône app 1024x1024

Pour régénérer :
\`\`\`bash
node apps/mobile/assets/brand/generate-logo-assets.mjs
\`\`\`
`,
    "utf8"
);
