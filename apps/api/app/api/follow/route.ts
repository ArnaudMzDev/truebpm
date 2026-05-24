import "@/lib/loadModels";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import FollowRequest from "@/models/FollowRequest";
import { verifyToken } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        await connectDB();

        const meId = await verifyToken(req);
        if (!meId) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        const body = await req.json().catch(() => null);
        const targetId = body?.targetId as string | undefined;

        if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
            return NextResponse.json({ error: "targetId invalide." }, { status: 400 });
        }

        if (String(meId) === String(targetId)) {
            return NextResponse.json(
                { error: "Impossible de se follow soi-même." },
                { status: 400 }
            );
        }

        const [me, target] = await Promise.all([
            User.findById(meId).exec(),
            User.findById(targetId).exec(),
        ]);

        if (!me || !target) {
            return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
        }

        if (!Array.isArray((me as any).followingList)) (me as any).followingList = [];
        if (!Array.isArray((target as any).followersList)) (target as any).followersList = [];

        const isFollowing = (me as any).followingList.some(
            (id: any) => String(id) === String(target._id)
        );

        // ✅ UNFOLLOW
        if (isFollowing) {
            (me as any).followingList = (me as any).followingList.filter(
                (id: any) => String(id) !== String(target._id)
            );

            (target as any).followersList = (target as any).followersList.filter(
                (id: any) => String(id) !== String(me._id)
            );

            me.following = (me as any).followingList.length;
            target.followers = (target as any).followersList.length;

            await Promise.all([
                me.save(),
                target.save(),
                FollowRequest.deleteMany({
                    requesterId: me._id,
                    targetUserId: target._id,
                }),
            ]);

            return NextResponse.json(
                {
                    success: true,
                    status: "unfollowed",
                    targetFollowers: target.followers,
                    meFollowing: me.following,
                },
                { status: 200 }
            );
        }

        // ✅ COMPTE PRIVÉ = DEMANDE, PAS FOLLOW DIRECT
        if (target.isPrivate) {
            const existingRequest: any = await FollowRequest.findOne({
                requesterId: me._id,
                targetUserId: target._id,
            }).exec();

            if (existingRequest) {
                if (existingRequest.status === "pending") {
                    return NextResponse.json(
                        {
                            success: true,
                            status: "requested",
                            targetFollowers: target.followers,
                            meFollowing: me.following,
                        },
                        { status: 200 }
                    );
                }

                existingRequest.status = "pending";
                await existingRequest.save();

                return NextResponse.json(
                    {
                        success: true,
                        status: "requested",
                        targetFollowers: target.followers,
                        meFollowing: me.following,
                    },
                    { status: 200 }
                );
            }

            await FollowRequest.create({
                requesterId: me._id,
                targetUserId: target._id,
                status: "pending",
            });

            return NextResponse.json(
                {
                    success: true,
                    status: "requested",
                    targetFollowers: target.followers,
                    meFollowing: me.following,
                },
                { status: 200 }
            );
        }

        // ✅ COMPTE PUBLIC = FOLLOW DIRECT
        (me as any).followingList.push(target._id);
        (target as any).followersList.push(me._id);

        me.following = (me as any).followingList.length;
        target.followers = (target as any).followersList.length;

        await Promise.all([
            me.save(),
            target.save(),
            FollowRequest.deleteMany({
                requesterId: me._id,
                targetUserId: target._id,
            }),
        ]);

        return NextResponse.json(
            {
                success: true,
                status: "followed",
                targetFollowers: target.followers,
                meFollowing: me.following,
            },
            { status: 200 }
        );
    } catch (err) {
        console.error("FOLLOW ERROR:", err);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}