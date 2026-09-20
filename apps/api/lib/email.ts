type EmailInput = {
    to: string;
    subject: string;
    text: string;
    html?: string;
};

function getEmailFrom() {
    return process.env.EMAIL_FROM || "TrueBPM <noreply@truebpm.fr>";
}

export function getPublicAppUrl() {
    return (
        process.env.PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        "https://truebpm.fr"
    ).replace(/\/$/, "");
}

export async function sendTransactionalEmail(input: EmailInput) {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
        if (process.env.NODE_ENV !== "production") {
            console.log("Email non envoyé, RESEND_API_KEY manquant:", {
                to: input.to,
                subject: input.subject,
                text: input.text,
            });
        }
        return { sent: false, skipped: true };
    }

    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from: getEmailFrom(),
            to: input.to,
            subject: input.subject,
            text: input.text,
            html: input.html,
        }),
    });

    if (!res.ok) {
        const error = await res.text().catch(() => "");
        throw new Error(`Email provider error: ${res.status} ${error.slice(0, 200)}`);
    }

    return { sent: true };
}
