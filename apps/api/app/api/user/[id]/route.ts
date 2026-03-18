import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Post from "@/models/Post";
import FollowRequest from "@/models/FollowRequest";
import mongoose from "mongoose";
import { getOptionalUserId } from "@/lib/requestAuth";

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        await connectDB();

        const userId = params.id;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return NextResponse.json(
                { error: "ID utilisateur invalide." },
                { status: 400 }
            );
        }

        const viewerId = await getOptionalUserId(req);

        const user: any = await User.findById(userId)
            .select(
                "_id pseudo avatarUrl bannerUrl bio followers following followersList followingList notesCount createdAt isOnline lastSeenAt pinnedTrack favoriteArtists favoriteAlbums favoriteTracks isPrivate messagePrivacy"
            )
            .lean();

        if (!user) {
            return NextResponse.json(
                { error: "Utilisateur introuvable." },
                { status: 404 }
            );
        }

        const realNotesCount = await Post.countDocuments({
            userId,
            type: "post",
        });

        const isSelf =
            !!viewerId && String(viewerId) === String(user._id);

        const isFollowing =
            !!viewerId &&
            Array.isArray(user.followersList) &&
            user.followersList.some((id: any) => String(id) === String(viewerId));

        let followStatus: "self" | "none" | "requested" | "following" = "none";

        if (isSelf) {
            followStatus = "self";
        } else if (isFollowing) {
            followStatus = "following";
        } else if (viewerId) {
            const pendingRequest = await FollowRequest.findOne({
                requesterId: viewerId,
                targetUserId: user._id,
                status: "pending",
            })
                .select("_id")
                .lean();

            if (pendingRequest) {
                followStatus = "requested";
            }
        }

        const isPrivateLocked =
            !!user.isPrivate && !isSelf && !isFollowing;

        const safeUser = {
            ...user,
            notesCount: realNotesCount,
            followStatus,
            isPrivateLocked,
        };

        return NextResponse.json({ user: safeUser }, { status: 200 });
    } catch (err) {
        console.error("❌ GET /api/user/[id] error:", err);
        return NextResponse.json(
            { error: "Erreur interne serveur." },
            { status: 500 }
        );
    }
}