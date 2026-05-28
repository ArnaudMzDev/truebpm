import { Schema, model, models } from "mongoose";

const AdminAuditLogSchema = new Schema(
    {
        adminId: { type: String, required: true, index: true },
        action: { type: String, required: true, index: true },
        targetType: { type: String, required: true, index: true },
        targetId: { type: String, required: true, index: true },
        reason: { type: String, default: "", maxlength: 500 },
        metadata: { type: Schema.Types.Mixed, default: {} },
        ip: { type: String, default: "" },
        userAgent: { type: String, default: "" },
    },
    { timestamps: true }
);

AdminAuditLogSchema.index({ createdAt: -1 });
AdminAuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

const AdminAuditLog: any =
    models.AdminAuditLog || model("AdminAuditLog", AdminAuditLogSchema);

export default AdminAuditLog;
