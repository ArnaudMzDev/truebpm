import "@/lib/loadModels";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { targetId: string } }) {
    try {
        await connectDB();

        const userId = await requireUserId(req);
        const { targetId } = params;

        if (!mongoose.Types.ObjectId.isValid(targetId)) {
            return NextResponse.json({ error: "ID utilisateur invalide." }, { status: 400 });
        }

        if (String(userId) === String(targetId)) {
            return NextResponse.json(
                { error: "Tu ne peux pas couper tes propres notifications." },
                { status: 400 }
            );
        }

        const body = await req.json().catch(() => null);
        const muted = body?.muted !== false;
        const targetObjectId = new mongoose.Types.ObjectId(targetId);

        const update = muted
            ? { $addToSet: { mutedNotificationUsers: targetObjectId } }
            : { $pull: { mutedNotificationUsers: targetObjectId } };

        const user: any = await User.findByIdAndUpdate(userId, update, { new: true })
            .select("_id mutedNotificationUsers")
            .lean();

        if (!user) {
            return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
        }

        const mutedUsers = Array.isArray(user.mutedNotificationUsers)
            ? user.mutedNotificationUsers
            : [];

        return NextResponse.json(
            {
                success: true,
                muted: mutedUsers.some((id: any) => String(id) === String(targetId)),
            },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    } catch (err) {
        console.error("PATCH /api/user/notification-mutes/[targetId] error:", err);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}
