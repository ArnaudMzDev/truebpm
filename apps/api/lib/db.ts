import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
    throw new Error("❌ MONGODB_URI is missing in .env.local");
}

export async function connectDB() {
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    try {
        await mongoose.connect(MONGODB_URI);
        console.log("🔥 MongoDB connecté");
    } catch (err) {
        console.error("❌ Erreur MongoDB :", err);
        throw err;
    }
}