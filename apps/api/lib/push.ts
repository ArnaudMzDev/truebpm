import PushToken from "@/models/PushToken";

type PushPayload = {
    recipientId: string;
    title: string;
    body: string;
    data?: Record<string, any>;
};

type ExpoMessage = {
    to: string;
    sound: "default";
    title: string;
    body: string;
    data?: Record<string, any>;
};

export async function sendPushToUser(payload: PushPayload) {
    const { recipientId, title, body, data = {} } = payload;

    const tokens = await PushToken.find({
        userId: recipientId,
        isActive: true,
    })
        .select("token")
        .lean();

    const pushTokens = tokens
        .map((t: any) => String(t.token || "").trim())
        .filter(Boolean);

    if (!pushTokens.length) return { sent: 0 };

    const messages: ExpoMessage[] = pushTokens.map((token) => ({
        to: token,
        sound: "default",
        title,
        body,
        data,
    }));

    try {
        const res = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(messages),
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
            console.log("Expo push send error:", json);
            return { sent: 0, error: json };
        }

        return { sent: messages.length, response: json };
    } catch (e: any) {
        console.log("sendPushToUser error:", e?.message || e);
        return { sent: 0, error: e?.message || "push_failed" };
    }
}