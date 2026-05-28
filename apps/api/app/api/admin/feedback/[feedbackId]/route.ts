import "@/lib/loadModels";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAdminRequest, writeAdminAuditLog } from "@/lib/adminAuth";
import { cleanMultilineText, cleanText } from "@/lib/sanitize";
import Feedback from "@/models/Feedback";

export const dynamic = "force-dynamic";

const allowedStatuses = new Set(["new", "reviewed", "planned", "done", "archived"]);
const allowedPriorities = new Set(["normal", "high"]);

export async function PATCH(req: Request, { params }: { params: { feedbackId: string } }) {
    const auth = requireAdminRequest(req, { csrf: true });
    if (auth.response) return auth.response;

    try {
        await connectDB();

        const { feedbackId } = params;
        if (!mongoose.Types.ObjectId.isValid(feedbackId)) {
            return NextResponse.json({ error: "Feedback invalide." }, { status: 400 });
        }

        const body = await req.json().catch(() => null);
        const status = cleanText(body?.status, 40);
        const priority = cleanText(body?.priority, 40);
        const adminNote = cleanMultilineText(body?.adminNote, 2000);

        const patch: any = {
            lastAdminId: auth.session!.adminId,
            adminNote,
        };

        if (allowedStatuses.has(status)) {
            patch.status = status;
            patch.reviewedAt = status === "new" ? null : new Date();
        }

        if (allowedPriorities.has(priority)) {
            patch.priority = priority;
        }

        const feedback = await Feedback.findByIdAndUpdate(
            feedbackId,
            { $set: patch },
            { new: true }
        ).lean();

        if (!feedback) {
            return NextResponse.json({ error: "Feedback introuvable." }, { status: 404 });
        }

        await writeAdminAuditLog({
            req,
            adminId: auth.session!.adminId,
            action: "feedback_update",
            targetType: "feedback",
            targetId: feedbackId,
            reason: patch.status ? `Statut: ${patch.status}` : "Mise à jour feedback",
            metadata: {
                status: patch.status,
                priority: patch.priority,
                hasAdminNote: !!adminNote,
            },
        });

        return NextResponse.json({ success: true, feedback });
    } catch (e) {
        console.error("PATCH /api/admin/feedback/[feedbackId] error:", e);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}
