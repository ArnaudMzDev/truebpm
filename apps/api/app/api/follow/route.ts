import "@/lib/loadModels";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
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

        if (meId.toString() === targetId) {
            return NextResponse.json(
                { error: "Impossible de se follow soi-même." },
                { status: 400 }
            );
        }

        const me = await User.findById(meId).exec();
        const target = await User.findById(targetId).exec();

        if (!me || !target) {
            return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
        }

        // Sécurise les anciens users qui n'ont pas encore ces champs en DB
        if (!Array.isArray((me as any).followingList)) (me as any).followingList = [];
        if (!Array.isArray((target as any).followersList)) (target as any).followersList = [];

        const isFollowing = (me as any).followingList.some(
            (id: any) => id.toString() === target._id.toString()
        );

        if (isFollowing) {
            (me as any).followingList = (me as any).followingList.filter(
                (id: any) => id.toString() !== target._id.toString()
            );
            (target as any).followersList = (target as any).followersList.filter(
                (id: any) => id.toString() !== me._id.toString()
            );
        } else {
            (me as any).followingList.push(target._id);
            (target as any).followersList.push(me._id);
        }

        me.following = (me as any).followingList.length;
        target.followers = (target as any).followersList.length;

        await me.save();
        await target.save();

        return NextResponse.json(
            {
                success: true,
                status: isFollowing ? "unfollowed" : "followed",
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