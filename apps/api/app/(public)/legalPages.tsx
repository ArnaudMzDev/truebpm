import type { CSSProperties, ReactNode } from "react";

type LegalPageProps = {
    kicker: string;
    title: string;
    intro: string;
    children: ReactNode;
};

type SectionProps = {
    title: string;
    children: ReactNode;
};

export function LegalPage({ kicker, title, intro, children }: LegalPageProps) {
    return (
        <main style={styles.page}>
            <section style={styles.hero}>
                <a href="/" style={styles.brand}>TrueBPM</a>
                <p style={styles.kicker}>{kicker}</p>
                <h1 style={styles.title}>{title}</h1>
                <p style={styles.intro}>{intro}</p>
            </section>

            <section style={styles.content}>
                {children}
            </section>
        </main>
    );
}

export function LegalSection({ title, children }: SectionProps) {
    return (
        <article style={styles.section}>
            <h2 style={styles.sectionTitle}>{title}</h2>
            <div style={styles.sectionBody}>{children}</div>
        </article>
    );
}

const styles: Record<string, CSSProperties> = {
    page: {
        minHeight: "100vh",
        background:
            "radial-gradient(circle at 18% 8%, rgba(139, 92, 246, 0.34), transparent 34%), #030407",
        color: "#f8f8ff",
        padding: "56px 20px 80px",
    },
    hero: {
        width: "min(920px, 100%)",
        margin: "0 auto 36px",
    },
    brand: {
        color: "#f8f8ff",
        display: "inline-block",
        fontSize: 22,
        fontWeight: 950,
        letterSpacing: -0.5,
        marginBottom: 52,
        textDecoration: "none",
    },
    kicker: {
        color: "#9a55ff",
        fontSize: 13,
        fontWeight: 950,
        letterSpacing: 4,
        margin: "0 0 14px",
        textTransform: "uppercase",
    },
    title: {
        fontSize: "clamp(44px, 8vw, 88px)",
        letterSpacing: -2,
        lineHeight: 0.96,
        margin: "0 0 24px",
        maxWidth: 780,
    },
    intro: {
        color: "#c8ceda",
        fontSize: "clamp(18px, 2vw, 24px)",
        fontWeight: 650,
        lineHeight: 1.45,
        maxWidth: 760,
        margin: 0,
    },
    content: {
        width: "min(920px, 100%)",
        margin: "0 auto",
        borderTop: "1px solid rgba(255,255,255,0.12)",
    },
    section: {
        borderBottom: "1px solid rgba(255,255,255,0.12)",
        display: "grid",
        gap: 18,
        gridTemplateColumns: "minmax(180px, 0.38fr) 1fr",
        padding: "28px 0",
    },
    sectionTitle: {
        color: "#fff",
        fontSize: 20,
        fontWeight: 900,
        letterSpacing: -0.2,
        margin: 0,
    },
    sectionBody: {
        color: "#c8ceda",
        fontSize: 16,
        fontWeight: 550,
        lineHeight: 1.65,
    },
};
