import Notification from "@/models/Notification";
import User from "@/models/User";
import { sendPushToUser } from "@/lib/push";

type CreateNotificationInput = {
    recipientId: string;
    actorId: string;
    type: "follow" | "like_post" | "comment_post" | "reply_comment" | "repost_post";
    postId?: string | null;
    commentId?: string | null;
};

function buildBody(actorPseudo: string, type: CreateNotificationInput["type"]) {
    switch (type) {
        case "follow":
            return `${actorPseudo} a commencé à te suivre`;
        case "like_post":
            return `${actorPseudo} a aimé ton post`;
        case "comment_post":
            return `${actorPseudo} a commenté ton post`;
        case "reply_comment":
            return `${actorPseudo} a répondu à ton commentaire`;
        case "repost_post":
            return `${actorPseudo} a reposté ton post`;
        default:
            return `${actorPseudo} a interagi avec toi`;
    }
}

export async function createNotification(input: CreateNotificationInput) {
    const { recipientId, actorId, type, postId = null, commentId = null } = input;

    if (!recipientId || !actorId) return null;
    if (String(recipientId) === String(actorId)) return null;

    const notif = await Notification.create({
        recipientId,
        actorId,
        type,
        postId,
        commentId,
        isRead: false,
    });

    try {
        const actor: any = await User.findById(actorId).select("pseudo").lean();
        const actorPseudo = actor?.pseudo || "Quelqu’un";

        await sendPushToUser({
            recipientId: String(recipientId),
            title: "TrueBPM",
            body: buildBody(actorPseudo, type),
            data: {
                type: "social",
                notifType: type,
                actorId: String(actorId),
                postId: postId ? String(postId) : null,
                commentId: commentId ? String(commentId) : null,
            },
        });
    } catch (e: any) {
        console.log("createNotification push error:", e?.message || e);
    }

    return notif;
}