import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
    try {
        const { pseudo, email, password } = await req.json();

        await connectDB();

        const exists = await User.findOne({ email });
        if (exists) {
            return NextResponse.json(
                { error: "Email déjà utilisé." },
                { status: 400 }
            );
        }

        const hashed = await bcrypt.hash(password, 10);

        await User.create({ pseudo, email, password: hashed });

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (err) {
        console.error("❌ Register error:", err);
        return NextResponse.json(
            { error: "Erreur serveur." },
            { status: 500 }
        );
    }
}