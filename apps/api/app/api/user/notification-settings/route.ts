import "@/lib/loadModels";
import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import User from "@/models/User";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const SETTING_KEYS = Object.keys(DEFAULT_NOTIFICATION_SETTINGS) as Array<keyof typeof DEFAULT_NOTIFICATION_SETTINGS>;

function normalizeSettings(settings: any) {
    return {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...(settings && typeof settings === "object" ? settings : {}),
    };
}

function sanitizePatch(body: any) {
    const patch: Record<string, boolean> = {};
    if (!body || typeof body !== "object") return patch;

    for (const key of SETTING_KEYS) {
        if (typeof body[key] === "boolean") {
            patch[`notificationSettings.${key}`] = body[key];
        }
    }

    return patch;
}

export async function GET(req: Request) {
    try {
        await connectDB();

        const userId = await requireUserId(req);
        const user: any = await User.findById(userId)
            .select("_id notificationSettings mutedNotificationUsers")
            .lean();

        if (!user) {
            return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
        }

        return NextResponse.json(
            {
                settings: normalizeSettings(user.notificationSettings),
                mutedUsersCount: Array.isArray(user.mutedNotificationUsers)
                    ? user.mutedNotificationUsers.length
                    : 0,
            },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    } catch (err) {
        console.error("GET /api/user/notification-settings error:", err);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        await connectDB();

        const userId = await requireUserId(req);
        const body = await req.json().catch(() => null);
        const patch = sanitizePatch(body);

        const user: any = Object.keys(patch).length
            ? await User.findByIdAndUpdate(userId, { $set: patch }, { new: true })
                .select("_id notificationSettings mutedNotificationUsers")
                .lean()
            : await User.findById(userId)
                .select("_id notificationSettings mutedNotificationUsers")
                .lean();

        if (!user) {
            return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
        }

        return NextResponse.json(
            {
                success: true,
                settings: normalizeSettings(user.notificationSettings),
                mutedUsersCount: Array.isArray(user.mutedNotificationUsers)
                    ? user.mutedNotificationUsers.length
                    : 0,
            },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    } catch (err) {
        console.error("PATCH /api/user/notification-settings error:", err);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}
