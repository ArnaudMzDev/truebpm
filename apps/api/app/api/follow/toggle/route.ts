import "@/lib/loadModels";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requireUserId } from "@/lib/requestAuth";
import User from "@/models/User";
import FollowRequest from "@/models/FollowRequest";

function isObjectId(id: string) {
    return mongoose.Types.ObjectId.isValid(id);
}

export async function POST(req: Request) {
    try {
        await connectDB();

        const meId = await requireUserId(req);
        if (!meId) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        const body = await req.json().catch(() => null);
        const targetUserId = body?.targetUserId as string | undefined;

        if (!targetUserId || !isObjectId(targetUserId)) {
            return NextResponse.json({ error: "targetUserId invalide." }, { status: 400 });
        }

        if (String(meId) === String(targetUserId)) {
            return NextResponse.json(
                { error: "Impossible de se suivre soi-même." },
                { status: 400 }
            );
        }

        const [meUser, targetUser] = await Promise.all([
            User.findById(meId).select("_id following followingList").lean(),
            User.findById(targetUserId).select("_id isPrivate followers followersList").lean(),
        ]);

        if (!meUser || !targetUser) {
            return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
        }

        const alreadyFollowing =
            Array.isArray((meUser as any).followingList) &&
            (meUser as any).followingList.some((id: any) => String(id) === String(targetUserId));

        if (alreadyFollowing) {
            await Promise.all([
                User.updateOne(
                    { _id: meId },
                    {
                        $pull: { followingList: new mongoose.Types.ObjectId(targetUserId) },
                        $inc: { following: -1 },
                    }
                ),
                User.updateOne(
                    { _id: targetUserId },
                    {
                        $pull: { followersList: new mongoose.Types.ObjectId(meId) },
                        $inc: { followers: -1 },
                    }
                ),
                FollowRequest.deleteMany({
                    requesterId: meId,
                    targetUserId,
                }),
            ]);

            return NextResponse.json(
                { success: true, status: "none" },
                { status: 200 }
            );
        }

        if ((targetUser as any).isPrivate) {
            const existingRequest = await FollowRequest.findOne({
                requesterId: meId,
                targetUserId,
                status: "pending",
            }).lean();

            if (existingRequest) {
                await FollowRequest.deleteOne({ _id: existingRequest._id });

                return NextResponse.json(
                    { success: true, status: "none" },
                    { status: 200 }
                );
            }

            await FollowRequest.findOneAndUpdate(
                {
                    requesterId: meId,
                    targetUserId,
                },
                {
                    $set: {
                        requesterId: meId,
                        targetUserId,
                        status: "pending",
                    },
                },
                {
                    new: true,
                    upsert: true,
                    setDefaultsOnInsert: true,
                }
            );

            return NextResponse.json(
                { success: true, status: "requested" },
                { status: 200 }
            );
        }

        await Promise.all([
            User.updateOne(
                { _id: meId },
                {
                    $addToSet: { followingList: new mongoose.Types.ObjectId(targetUserId) },
                    $inc: { following: 1 },
                }
            ),
            User.updateOne(
                { _id: targetUserId },
                {
                    $addToSet: { followersList: new mongoose.Types.ObjectId(meId) },
                    $inc: { followers: 1 },
                }
            ),
            FollowRequest.deleteMany({
                requesterId: meId,
                targetUserId,
            }),
        ]);

        return NextResponse.json(
            { success: true, status: "following" },
            { status: 200 }
        );
    } catch (e) {
        console.error("❌ POST /api/follow/toggle error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}