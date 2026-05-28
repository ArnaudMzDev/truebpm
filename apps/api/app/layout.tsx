import "./globals.css";

export const metadata = {
    title: "TrueBPM Admin",
    robots: "noindex,nofollow",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="fr">
            <body>{children}</body>
        </html>
    );
}
