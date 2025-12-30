// apps/api/app/api/follow/[id]/route.ts
import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { verifyToken } from "@/lib/auth";

export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        await connectDB();

        const meId = await verifyToken(req);
        if (!meId) {
            return NextResponse.json(
                { error: "Non authentifié." },
                { status: 401 }
            );
        }

        const targetId = params.id;

        if (meId === targetId) {
            return NextResponse.json(
                { error: "Impossible de se suivre soi-même." },
                { status: 400 }
            );
        }

        const me = await User.findById(meId);
        const target = await User.findById(targetId);

        if (!target) {
            return NextResponse.json(
                { error: "Utilisateur introuvable." },
                { status: 404 }
            );
        }

        const alreadyFollowing = me.followingList?.includes(targetId);

        // FOLLOW
        if (!alreadyFollowing) {
            me.followingList = [...(me.followingList || []), targetId];
            target.followersList = [...(target.followersList || []), meId];

            me.following = (me.following || 0) + 1;
            target.followers = (target.followers || 0) + 1;

            await me.save();
            await target.save();

            return NextResponse.json({
                status: "followed",
                targetFollowers: target.followers,
                meFollowing: me.following,
            });
        }

        // UNFOLLOW
        me.followingList = me.followingList.filter((id: string) => id !== targetId);
        target.followersList = target.followersList.filter((id: string) => id !== meId);

        me.following = Math.max(0, (me.following || 1) - 1);
        target.followers = Math.max(0, (target.followers || 1) - 1);

        await me.save();
        await target.save();

        return NextResponse.json({
            status: "unfollowed",
            targetFollowers: target.followers,
            meFollowing: me.following,
        });

    } catch (err) {
        console.error("❌ FOLLOW ERROR:", err);
        return NextResponse.json(
            { error: "Erreur interne serveur." },
            { status: 500 }
        );
    }
}