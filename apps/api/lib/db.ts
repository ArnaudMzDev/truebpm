// apps/api/lib/db.ts
import mongoose from "mongoose";
import crypto from "crypto";
declare global {
    // eslint-disable-next-line no-var
    var __mongooseConn: typeof mongoose | null | undefined;
}

export async function connectDB() {
    if (global.__mongooseConn) return global.__mongooseConn;

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error("❌ MONGODB_URI is missing in env (.env.local)");
    }
    const fp = (s?: string) =>
        s ? crypto.createHash("sha256").update(s).digest("hex").slice(0, 8) : "missing";

    console.log("API JWT_SECRET fp:", fp(process.env.JWT_SECRET));

    global.__mongooseConn = await mongoose.connect(uri);
    return global.__mongooseConn;
}