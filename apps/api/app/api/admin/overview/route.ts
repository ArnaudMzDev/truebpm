import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdminRequest } from "@/lib/adminAuth";
import User from "@/models/User";
import Post from "@/models/Post";
import Comment from "@/models/Comment";
import Message from "@/models/Message";
import AdminAuditLog from "@/models/AdminAuditLog";
import SupportTicket from "@/models/SupportTicket";
import Feedback from "@/models/Feedback";

export const dynamic = "force-dynamic";

function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

function buildPresenceBuckets(users: any[]) {
    const now = Date.now();
    const buckets = Array.from({ length: 12 }, (_, index) => {
        const start = now - (11 - index) * 60 * 60 * 1000;
        const date = new Date(start);
        return {
            label: `${String(date.getHours()).padStart(2, "0")}h`,
            count: 0,
        };
    });

    for (const user of users) {
        const ts = new Date(user.lastSeenAt || 0).getTime();
        if (!Number.isFinite(ts)) continue;
        const diffHours = Math.floor((now - ts) / (60 * 60 * 1000));
        const index = 11 - diffHours;
        if (index >= 0 && index < buckets.length) {
            buckets[index].count += 1;
        }
    }

    return buckets;
}

export async function GET(req: Request) {
    const auth = requireAdminRequest(req);
    if (auth.response) return auth.response;

    try {
        await connectDB();

        const today = startOfToday();
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const last12h = new Date(Date.now() - 12 * 60 * 60 * 1000);

        const [
            totalUsers,
            onlineUsers,
            bannedUsers,
            privateUsers,
            newUsers24h,
            totalPosts,
            posts24h,
            totalComments,
            comments24h,
            messages24h,
            openSupportTickets,
            supportTickets24h,
            newFeedback,
            feedback24h,
            deletedAudit24h,
            bannedAudit24h,
            recentAudit,
            presenceUsers,
        ] = await Promise.all([
            User.countDocuments({}),
            User.countDocuments({ isOnline: true }),
            User.countDocuments({ isBanned: true }),
            User.countDocuments({ isPrivate: true }),
            User.countDocuments({ createdAt: { $gte: last24h } }),
            Post.countDocuments({}),
            Post.countDocuments({ createdAt: { $gte: today } }),
            Comment.countDocuments({}),
            Comment.countDocuments({ createdAt: { $gte: last24h } }),
            Message.countDocuments({ createdAt: { $gte: last24h } }),
            SupportTicket.countDocuments({ status: { $in: ["open", "in_review"] } }),
            SupportTicket.countDocuments({ createdAt: { $gte: last24h } }),
            Feedback.countDocuments({ status: { $in: ["new", "reviewed", "planned"] } }),
            Feedback.countDocuments({ createdAt: { $gte: last24h } }),
            AdminAuditLog.countDocuments({ action: "post_delete", createdAt: { $gte: last24h } }),
            AdminAuditLog.countDocuments({ action: "user_ban", createdAt: { $gte: last24h } }),
            AdminAuditLog.find({}).sort({ _id: -1 }).limit(8).lean(),
            User.find({ lastSeenAt: { $gte: last12h } }).select("lastSeenAt").lean(),
        ]);

        return NextResponse.json({
            metrics: {
                totalUsers,
                onlineUsers,
                bannedUsers,
                privateUsers,
                newUsers24h,
                totalPosts,
                postsToday: posts24h,
                totalComments,
                comments24h,
                messages24h,
                openSupportTickets,
                supportTickets24h,
                newFeedback,
                feedback24h,
                deletedAudit24h,
                bannedAudit24h,
            },
            presenceBuckets: buildPresenceBuckets(presenceUsers),
            recentAudit,
        });
    } catch (e) {
        console.error("GET /api/admin/overview error:", e);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}
