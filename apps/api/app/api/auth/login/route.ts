import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { loginSchema } from "@/lib/validators/auth";

export async function POST(req: Request) {
    try {
        await connectDB();
        const body = await req.json();

        // Validate input
        const parsed = loginSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Email ou mot de passe invalide." },
                { status: 400 }
            );
        }

        const { email, password } = parsed.data;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return NextResponse.json(
                { error: "Cet email n'existe pas." },
                { status: 400 }
            );
        }

        // Compare passwords
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return NextResponse.json(
                { error: "Mot de passe incorrect." },
                { status: 400 }
            );
        }

        // Create JWT
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET!,
            { expiresIn: "7d" }
        );

        return NextResponse.json({
            success: true,
            token,
            user: {
                id: user._id,
                pseudo: user.pseudo,
                email: user.email,
            },
        });

    } catch (err) {
        console.error("Login error:", err);
        return NextResponse.json(
            { error: "Erreur serveur." },
            { status: 500 }
        );
    }
}