import Notification from "@/models/Notification";
import User from "@/models/User";
import { sendPushToUser } from "@/lib/push";

type CreateNotificationInput = {
    recipientId: string;
    actorId: string;
    type:
        | "follow"
        | "follow_request"
        | "follow_accept"
        | "like_post"
        | "comment_post"
        | "reply_comment"
        | "like_comment"
        | "repost_post"
        | "like_note"
        | "new_post"
        | "new_note"
        | "same_entity_post";
    postId?: string | null;
    commentId?: string | null;
};

export const DEFAULT_NOTIFICATION_SETTINGS = {
    enabled: true,
    follows: true,
    likes: true,
    comments: true,
    reposts: true,
    postsFromFollowing: true,
    notesFromFollowing: true,
    sameMusic: true,
    artistReleases: true,
};

type NotificationSettings = typeof DEFAULT_NOTIFICATION_SETTINGS;

function normalizeNotificationSettings(settings: any): NotificationSettings {
    return {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...(settings && typeof settings === "object" ? settings : {}),
    };
}

function getSettingKeyForType(type: CreateNotificationInput["type"]): keyof NotificationSettings {
    switch (type) {
        case "follow":
        case "follow_request":
        case "follow_accept":
            return "follows";
        case "like_post":
        case "like_comment":
        case "like_note":
            return "likes";
        case "comment_post":
        case "reply_comment":
            return "comments";
        case "repost_post":
            return "reposts";
        case "new_post":
            return "postsFromFollowing";
        case "new_note":
            return "notesFromFollowing";
        case "same_entity_post":
            return "sameMusic";
        default:
            return "enabled";
    }
}

async function canDeliverNotification(input: CreateNotificationInput) {
    const recipient: any = await User.findById(input.recipientId)
        .select("_id notificationSettings mutedNotificationUsers")
        .lean();

    if (!recipient) return false;

    const mutedUsers = Array.isArray(recipient.mutedNotificationUsers)
        ? recipient.mutedNotificationUsers
        : [];
    const mutedActor = mutedUsers.some((id: any) => String(id) === String(input.actorId));
    if (mutedActor) return false;

    const settings = normalizeNotificationSettings(recipient.notificationSettings);
    const settingKey = getSettingKeyForType(input.type);
    return settings.enabled !== false && settings[settingKey] !== false;
}

function buildBody(actorPseudo: string, type: CreateNotificationInput["type"]) {
    switch (type) {
        case "follow":
            return `${actorPseudo} a commencé à te suivre`;
        case "follow_request":
            return `${actorPseudo} a demandé à te suivre`;
        case "follow_accept":
            return `${actorPseudo} a accepté ta demande d'abonnement`;
        case "like_post":
            return `${actorPseudo} a aimé ton post`;
        case "comment_post":
            return `${actorPseudo} a commenté ton post`;
        case "reply_comment":
            return `${actorPseudo} a répondu à ton commentaire`;
        case "like_comment":
            return `${actorPseudo} a aimé ton commentaire`;
        case "repost_post":
            return `${actorPseudo} a reposté ton post`;
        case "like_note":
            return `${actorPseudo} a aimé ta note`;
        case "new_post":
            return `${actorPseudo} a publié un nouvel avis`;
        case "new_note":
            return `${actorPseudo} a changé sa note du moment`;
        case "same_entity_post":
            return `${actorPseudo} a aussi donné son avis sur un son que tu as noté`;
        default:
            return `${actorPseudo} a interagi avec toi`;
    }
}

export async function createNotification(input: CreateNotificationInput) {
    const { recipientId, actorId, type, postId = null, commentId = null } = input;

    if (!recipientId || !actorId) return null;
    if (String(recipientId) === String(actorId)) return null;
    if (!(await canDeliverNotification(input))) return null;

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

export async function notifyFollowers(input: {
    actorId: string;
    type: Extract<CreateNotificationInput["type"], "new_post" | "new_note">;
    postId?: string | null;
    limit?: number;
}) {
    const { actorId, type, postId = null, limit = 50 } = input;
    if (!actorId) return { sent: 0 };

    const actor: any = await User.findById(actorId).select("followersList").lean();
    const followers = Array.isArray(actor?.followersList) ? actor.followersList : [];
    const recipientIds = followers
        .map((id: any) => String(id))
        .filter((id: string) => id && id !== String(actorId))
        .slice(0, limit);

    const results = await Promise.allSettled(
        recipientIds.map((recipientId: string) =>
            createNotification({
                recipientId,
                actorId,
                type,
                postId,
            })
        )
    );

    return {
        sent: results.filter((result) => result.status === "fulfilled").length,
        attempted: recipientIds.length,
    };
}
