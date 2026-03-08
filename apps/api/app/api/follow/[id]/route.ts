import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { verifyToken } from "@/lib/auth";
import mongoose from "mongoose";
import { createNotification } from "@/lib/notifications";

export async function POST(req: Request, ctx: { params: { id: string } }) {
    try {
        await connectDB();

        const meId = await verifyToken(req);
        if (!meId) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }

        const targetId = ctx.params.id;

        if (!mongoose.Types.ObjectId.isValid(targetId)) {
            return NextResponse.json({ error: "id invalide." }, { status: 400 });
        }
        if (meId === targetId) {
            return NextResponse.json({ error: "Impossible de se follow soi-même." }, { status: 400 });
        }

        const me = await User.findById(meId);
        const target = await User.findById(targetId);

        if (!me || !target) {
            return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
        }

        const targetObjId = new mongoose.Types.ObjectId(targetId);

        const alreadyFollowing = (me.followingList || []).some((x: any) =>
            x?.equals ? x.equals(targetObjId) : x?.toString?.() === targetId
        );

        if (alreadyFollowing) {
            // UNFOLLOW
            me.followingList = (me.followingList || []).filter((x: any) =>
                x?.equals ? !x.equals(targetObjId) : x?.toString?.() !== targetId
            );

            target.followersList = (target.followersList || []).filter((x: any) =>
                x?.equals ? !x.equals(me._id) : x?.toString?.() !== meId
            );

            me.following = Math.max(0, (me.following || 0) - 1);
            target.followers = Math.max(0, (target.followers || 0) - 1);

            await Promise.all([me.save(), target.save()]);
            await createNotification({
                recipientId: String(target._id),
                actorId: String(me._id),
                type: "follow",
            });

            return NextResponse.json(
                {
                    status: "unfollowed",
                    following: false,
                    meFollowing: me.following,
                    targetFollowers: target.followers,
                },
                { status: 200 }
            );
        }

        // FOLLOW
        if (!(me.followingList || []).some((x: any) => x?.toString?.() === targetId)) {
            me.followingList = [...(me.followingList || []), targetObjId];
        }
        if (!(target.followersList || []).some((x: any) => x?.toString?.() === meId)) {
            target.followersList = [...(target.followersList || []), me._id];
        }

        me.following = (me.following || 0) + 1;
        target.followers = (target.followers || 0) + 1;

        await Promise.all([me.save(), target.save()]);

        return NextResponse.json(
            {
                status: "followed",
                following: true,
                meFollowing: me.following,
                targetFollowers: target.followers,
            },
            { status: 200 }
        );
    } catch (err) {
        console.error("❌ POST /api/follow/[id] error:", err);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}