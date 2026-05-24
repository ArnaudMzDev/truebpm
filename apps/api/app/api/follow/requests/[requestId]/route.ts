import "@/lib/loadModels";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import FollowRequest from "@/models/FollowRequest";
import User from "@/models/User";
import { createNotification } from "@/lib/notifications";

export async function PATCH(
    req: Request,
    { params }: { params: { requestId: string } }
) {
    try {
        await connectDB();

        const meId = await requireUserId(req);
        if (!meId) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        const { requestId } = params;
        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return NextResponse.json({ error: "requestId invalide." }, { status: 400 });
        }

        const body = await req.json().catch(() => null);
        const action = body?.action as "accept" | "decline" | undefined;

        if (!action || !["accept", "decline"].includes(action)) {
            return NextResponse.json({ error: "Action invalide." }, { status: 400 });
        }

        const requestDoc: any = await FollowRequest.findById(requestId);
        if (!requestDoc) {
            return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
        }

        if (String(requestDoc.targetUserId) !== String(meId)) {
            return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
        }

        if (requestDoc.status !== "pending") {
            return NextResponse.json(
                { error: "Cette demande a déjà été traitée." },
                { status: 400 }
            );
        }

        if (action === "decline") {
            requestDoc.status = "declined";
            await requestDoc.save();

            return NextResponse.json(
                { success: true, status: "declined" },
                { status: 200 }
            );
        }

        const requesterObjectId = new mongoose.Types.ObjectId(String(requestDoc.requesterId));
        const targetObjectId = new mongoose.Types.ObjectId(String(meId));

        await Promise.all([
            User.updateOne(
                { _id: requesterObjectId },
                {
                    $addToSet: { followingList: targetObjectId },
                }
            ),
            User.updateOne(
                { _id: targetObjectId },
                {
                    $addToSet: { followersList: requesterObjectId },
                }
            ),
        ]);

        const [requester, target] = await Promise.all([
            User.findById(requesterObjectId).select("followingList").lean(),
            User.findById(targetObjectId).select("followersList").lean(),
        ]);

        await Promise.all([
            User.updateOne(
                { _id: requesterObjectId },
                { $set: { following: Array.isArray(requester?.followingList) ? requester.followingList.length : 0 } }
            ),
            User.updateOne(
                { _id: targetObjectId },
                { $set: { followers: Array.isArray(target?.followersList) ? target.followersList.length : 0 } }
            ),
        ]);

        requestDoc.status = "accepted";
        await requestDoc.save();

        await createNotification({
            recipientId: String(requestDoc.requesterId),
            actorId: String(meId),
            type: "follow_accept",
        });

        return NextResponse.json(
            { success: true, status: "accepted" },
            { status: 200 }
        );
    } catch (e) {
        console.error("❌ PATCH /api/user/follow-requests/[requestId] error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}