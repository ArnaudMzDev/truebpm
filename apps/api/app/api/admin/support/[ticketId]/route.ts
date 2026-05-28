import "@/lib/loadModels";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAdminRequest, writeAdminAuditLog } from "@/lib/adminAuth";
import { cleanMultilineText, cleanText } from "@/lib/sanitize";
import SupportTicket from "@/models/SupportTicket";

export const dynamic = "force-dynamic";

const allowedStatuses = new Set(["open", "in_review", "resolved", "closed"]);
const allowedPriorities = new Set(["normal", "high", "urgent"]);

export async function PATCH(req: Request, { params }: { params: { ticketId: string } }) {
    const auth = requireAdminRequest(req, { csrf: true });
    if (auth.response) return auth.response;

    try {
        await connectDB();

        const { ticketId } = params;
        if (!mongoose.Types.ObjectId.isValid(ticketId)) {
            return NextResponse.json({ error: "Ticket invalide." }, { status: 400 });
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
            patch.resolvedAt = status === "resolved" || status === "closed" ? new Date() : null;
        }

        if (allowedPriorities.has(priority)) {
            patch.priority = priority;
        }

        const ticket = await SupportTicket.findByIdAndUpdate(
            ticketId,
            { $set: patch },
            { new: true }
        ).lean();

        if (!ticket) {
            return NextResponse.json({ error: "Ticket introuvable." }, { status: 404 });
        }

        await writeAdminAuditLog({
            req,
            adminId: auth.session!.adminId,
            action: "support_update",
            targetType: "support_ticket",
            targetId: ticketId,
            reason: patch.status ? `Statut: ${patch.status}` : "Mise à jour support",
            metadata: {
                status: patch.status,
                priority: patch.priority,
                hasAdminNote: !!adminNote,
            },
        });

        return NextResponse.json({ success: true, ticket });
    } catch (e) {
        console.error("PATCH /api/admin/support/[ticketId] error:", e);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}
