import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Post from "@/models/Post";
import Comment from "@/models/Comment";
import Conversation from "@/models/Conversation";
import FollowRequest from "@/models/FollowRequest";
import Message from "@/models/Message";
import Note from "@/models/Note";
import Notification from "@/models/Notification";
import PushToken from "@/models/PushToken";
import { verifyToken } from "@/lib/auth";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        await connectDB();

        const userId = await verifyToken(req);
        if (!userId) {
            return NextResponse.json(
                { error: "Non authentifié." },
                { status: 401, headers: { "Cache-Control": "no-store" } }
            );
        }

        const user = await User.findById(userId)
            .select(
                "_id pseudo email avatarUrl bannerUrl bio followers following followersList followingList notesCount createdAt isOnline lastSeenAt pinnedTrack favoriteArtists favoriteAlbums favoriteTracks isPrivate messagePrivacy"
            )
            .lean();

        if (!user) {
            return NextResponse.json(
                { error: "Utilisateur introuvable." },
                { status: 404, headers: { "Cache-Control": "no-store" } }
            );
        }

        const realNotesCount = await Post.countDocuments({
            userId,
            type: "post",
        });

        const safeUser = {
            ...user,
            notesCount: realNotesCount,
        };

        return NextResponse.json(
            { user: safeUser },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    } catch (err) {
        console.error("❌ GET /api/user/me error:", err);
        return NextResponse.json(
            { error: "Erreur interne du serveur." },
            { status: 500, headers: { "Cache-Control": "no-store" } }
        );
    }
}

export async function DELETE(req: Request) {
    try {
        await connectDB();

        const userId = await verifyToken(req);
        if (!userId) {
            return NextResponse.json(
                { error: "Non authentifié." },
                { status: 401, headers: { "Cache-Control": "no-store" } }
            );
        }

        const body = await req.json().catch(() => null);
        const password = typeof body?.password === "string" ? body.password : "";
        const confirmation = typeof body?.confirmation === "string" ? body.confirmation.trim() : "";

        if (confirmation !== "SUPPRIMER") {
            return NextResponse.json(
                { error: "Confirmation invalide." },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        const user: any = await User.findById(userId).select("_id password").lean();
        if (!user) {
            return NextResponse.json(
                { error: "Utilisateur introuvable." },
                { status: 404, headers: { "Cache-Control": "no-store" } }
            );
        }

        const passwordOk = await bcrypt.compare(password, user.password || "");
        if (!passwordOk) {
            return NextResponse.json(
                { error: "Mot de passe incorrect." },
                { status: 403, headers: { "Cache-Control": "no-store" } }
            );
        }

        const me = new mongoose.Types.ObjectId(userId);
        const ownPosts: any[] = await Post.find({ userId: me }).select("_id").lean();
        const ownPostIds = ownPosts.map((post) => post._id);
        const ownComments: any[] = await Comment.find({ userId: me }).select("_id parentId rootId").lean();
        const ownRootCommentIds = ownComments
            .filter((comment) => !comment.parentId)
            .map((comment) => comment._id);
        const conversations: any[] = await Conversation.find({ participants: me }).select("_id").lean();
        const conversationIds = conversations.map((conversation) => conversation._id);

        await Promise.all([
            Comment.deleteMany({
                $or: [
                    { userId: me },
                    { postId: { $in: ownPostIds } },
                    { _id: { $in: ownRootCommentIds } },
                    { rootId: { $in: ownRootCommentIds } },
                ],
            }),
            Post.deleteMany({
                $or: [
                    { userId: me },
                    { repostedBy: me },
                    { repostOf: { $in: ownPostIds } },
                ],
            }),
            Post.updateMany(
                {},
                {
                    $pull: {
                        likes: me,
                        reposts: me,
                    },
                }
            ),
            User.updateMany(
                {},
                {
                    $pull: {
                        followersList: me,
                        followingList: me,
                    },
                }
            ),
            FollowRequest.deleteMany({
                $or: [
                    { requesterId: me },
                    { targetUserId: me },
                ],
            }),
            Notification.deleteMany({
                $or: [
                    { recipientId: me },
                    { actorId: me },
                    { postId: { $in: ownPostIds } },
                ],
            }),
            Note.deleteMany({ userId: me }),
            PushToken.deleteMany({ userId: me }),
            Message.deleteMany({
                $or: [
                    { conversationId: { $in: conversationIds } },
                    { senderId: me },
                ],
            }),
            Conversation.deleteMany({ _id: { $in: conversationIds } }),
        ]);

        await Promise.all([
            User.updateMany(
                {},
                [
                    {
                        $set: {
                            followers: { $size: { $ifNull: ["$followersList", []] } },
                            following: { $size: { $ifNull: ["$followingList", []] } },
                        },
                    },
                ]
            ),
            Post.updateMany(
                {},
                [
                    {
                        $set: {
                            likesCount: { $size: { $ifNull: ["$likes", []] } },
                            repostsCount: { $size: { $ifNull: ["$reposts", []] } },
                        },
                    },
                ]
            ),
        ]);

        await recomputeCommentCounters();
        await User.deleteOne({ _id: me });

        return NextResponse.json(
            { success: true },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    } catch (err) {
        console.error("❌ DELETE /api/user/me error:", err);
        return NextResponse.json(
            { error: "Erreur interne du serveur." },
            { status: 500, headers: { "Cache-Control": "no-store" } }
        );
    }
}

async function recomputeCommentCounters() {
    const [postCounts, directReplyCounts, threadReplyCounts] = await Promise.all([
        Comment.aggregate([
            { $group: { _id: "$postId", count: { $sum: 1 } } },
        ]),
        Comment.aggregate([
            { $match: { parentId: { $ne: null } } },
            { $group: { _id: "$parentId", count: { $sum: 1 } } },
        ]),
        Comment.aggregate([
            { $match: { rootId: { $ne: null }, parentId: { $ne: null } } },
            { $group: { _id: "$rootId", count: { $sum: 1 } } },
        ]),
    ]);

    await Promise.all([
        Post.updateMany({}, { $set: { commentsCount: 0 } }),
        Comment.updateMany({}, { $set: { directRepliesCount: 0, repliesCount: 0 } }),
    ]);

    await Promise.all([
        postCounts.length
            ? Post.bulkWrite(
                postCounts.map((item: any) => ({
                    updateOne: {
                        filter: { _id: item._id },
                        update: { $set: { commentsCount: item.count } },
                    },
                }))
            )
            : Promise.resolve(),
        directReplyCounts.length
            ? Comment.bulkWrite(
                directReplyCounts.map((item: any) => ({
                    updateOne: {
                        filter: { _id: item._id },
                        update: { $set: { directRepliesCount: item.count } },
                    },
                }))
            )
            : Promise.resolve(),
        threadReplyCounts.length
            ? Comment.bulkWrite(
                threadReplyCounts.map((item: any) => ({
                    updateOne: {
                        filter: { _id: item._id },
                        update: { $set: { repliesCount: item.count } },
                    },
                }))
            )
            : Promise.resolve(),
    ]);
}
