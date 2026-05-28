// apps/api/lib/db.ts
import mongoose from "mongoose";
declare global {
    var __mongooseConn: typeof mongoose | null | undefined;
}

export async function connectDB() {
    if (global.__mongooseConn) return global.__mongooseConn;

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error("❌ MONGODB_URI is missing in env (.env.local)");
    }

    global.__mongooseConn = await mongoose.connect(uri);
    return global.__mongooseConn;
}
