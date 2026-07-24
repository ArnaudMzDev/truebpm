import mongoose from "mongoose";
import User from "@/models/User";
import Post from "@/models/Post";
import Comment from "@/models/Comment";
import Conversation from "@/models/Conversation";
import FollowRequest from "@/models/FollowRequest";
import Message from "@/models/Message";
import Note from "@/models/Note";
import Notification from "@/models/Notification";
import PushToken from "@/models/PushToken";
import SupportTicket from "@/models/SupportTicket";
import Feedback from "@/models/Feedback";
import ArtistRelease from "@/models/ArtistRelease";
import BlindTestSession from "@/models/BlindTestSession";

function deletedCount(result: any) {
    return typeof result?.deletedCount === "number" ? result.deletedCount : 0;
}

export async function deleteUserCascade(userId: string | mongoose.Types.ObjectId) {
    const userObjectId =
        userId instanceof mongoose.Types.ObjectId
            ? userId
            : new mongoose.Types.ObjectId(String(userId));

    const user = await User.findById(userObjectId)
        .select("_id pseudo email avatarUrl isBanned createdAt")
        .lean();

    if (!user) return null;

    const authoredPosts: any[] = await Post.find({ userId: userObjectId })
        .select("_id type")
        .lean();
    const authoredPostIds = authoredPosts.map((post) => post._id);
    const authoredOriginalPostIds = authoredPosts
        .filter((post) => post.type !== "repost")
        .map((post) => post._id);

    const postsToDelete: any[] = await Post.find({
        $or: [
            { userId: userObjectId },
            { repostedBy: userObjectId },
            { repostOf: { $in: authoredOriginalPostIds } },
        ],
    })
        .select("_id type")
        .lean();
    const postIdsToDelete = postsToDelete.map((post) => post._id);

    const commentsToDelete: any[] = await Comment.find({
        $or: [
            { userId: userObjectId },
            { postId: { $in: postIdsToDelete } },
        ],
    })
        .select("_id parentId rootId")
        .lean();
    const commentIdsToDelete = commentsToDelete.map((comment) => comment._id);
    const rootCommentIdsToDelete = commentsToDelete
        .filter((comment) => !comment.parentId)
        .map((comment) => comment._id);

    const conversations: any[] = await Conversation.find({ participants: userObjectId })
        .select("_id")
        .lean();
    const conversationIds = conversations.map((conversation) => conversation._id);

    const [
        commentDeletion,
        postDeletion,
        postSocialPull,
        commentSocialPull,
        noteSocialPull,
        userRelationPull,
        followRequestDeletion,
        notificationDeletion,
        noteDeletion,
        pushTokenDeletion,
        messageDeletion,
        conversationDeletion,
        supportDeletion,
        feedbackDeletion,
        artistReleaseDeletion,
        blindTestSessionDeletion,
    ] = await Promise.all([
        Comment.deleteMany({
            $or: [
                { userId: userObjectId },
                { postId: { $in: postIdsToDelete } },
                { _id: { $in: rootCommentIdsToDelete } },
                { rootId: { $in: rootCommentIdsToDelete } },
            ],
        }),
        Post.deleteMany({
            $or: [
                { userId: userObjectId },
                { repostedBy: userObjectId },
                { repostOf: { $in: authoredOriginalPostIds } },
            ],
        }),
        Post.updateMany(
            {},
            {
                $pull: {
                    likes: userObjectId,
                    reposts: userObjectId,
                },
            }
        ),
        Comment.updateMany({}, { $pull: { likes: userObjectId } }),
        Note.updateMany({}, { $pull: { likes: userObjectId } }),
        User.updateMany(
            {},
            {
                $pull: {
                    followersList: userObjectId,
                    followingList: userObjectId,
                },
            }
        ),
        FollowRequest.deleteMany({
            $or: [
                { requesterId: userObjectId },
                { targetUserId: userObjectId },
            ],
        }),
        Notification.deleteMany({
            $or: [
                { recipientId: userObjectId },
                { actorId: userObjectId },
                { postId: { $in: postIdsToDelete } },
                { commentId: { $in: commentIdsToDelete } },
            ],
        }),
        Note.deleteMany({ userId: userObjectId }),
        PushToken.deleteMany({ userId: userObjectId }),
        Message.deleteMany({
            $or: [
                { conversationId: { $in: conversationIds } },
                { senderId: userObjectId },
                { postId: { $in: postIdsToDelete } },
            ],
        }),
        Conversation.deleteMany({ _id: { $in: conversationIds } }),
        SupportTicket.deleteMany({ userId: userObjectId }),
        Feedback.deleteMany({ userId: userObjectId }),
        ArtistRelease.deleteMany({ userId: userObjectId }),
        BlindTestSession.deleteMany({ userId: userObjectId }),
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
        Comment.updateMany(
            {},
            [
                {
                    $set: {
                        likesCount: { $size: { $ifNull: ["$likes", []] } },
                    },
                },
            ]
        ),
        Note.updateMany(
            {},
            [
                {
                    $set: {
                        likesCount: { $size: { $ifNull: ["$likes", []] } },
                    },
                },
            ]
        ),
    ]);

    await recomputeCommentCounters();
    await User.deleteOne({ _id: userObjectId });

    return {
        user,
        counts: {
            posts: deletedCount(postDeletion),
            comments: deletedCount(commentDeletion),
            followRequests: deletedCount(followRequestDeletion),
            notifications: deletedCount(notificationDeletion),
            notes: deletedCount(noteDeletion),
            pushTokens: deletedCount(pushTokenDeletion),
            messages: deletedCount(messageDeletion),
            conversations: deletedCount(conversationDeletion),
            supportTickets: deletedCount(supportDeletion),
            feedback: deletedCount(feedbackDeletion),
            artistReleases: deletedCount(artistReleaseDeletion),
            blindTestSessions: deletedCount(blindTestSessionDeletion),
            postSocialUpdates: postSocialPull.modifiedCount || 0,
            commentSocialUpdates: commentSocialPull.modifiedCount || 0,
            noteSocialUpdates: noteSocialPull.modifiedCount || 0,
            userRelationUpdates: userRelationPull.modifiedCount || 0,
        },
    };
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
