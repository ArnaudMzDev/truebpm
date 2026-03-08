import mongoose from "mongoose";
import { verifyToken } from "@/lib/auth";

export async function getOptionalUserId(req: Request): Promise<string | null> {
    const headerUserId = req.headers.get("x-user-id");
    if (headerUserId && mongoose.Types.ObjectId.isValid(headerUserId)) {
        return headerUserId;
    }

    const bearerUserId = await verifyToken(req).catch(() => null);
    if (bearerUserId && mongoose.Types.ObjectId.isValid(bearerUserId)) {
        return bearerUserId;
    }

    return null;
}

export async function requireUserId(req: Request): Promise<string | null> {
    const userId = await getOptionalUserId(req);
    return userId;
}