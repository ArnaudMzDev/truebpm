import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function POST(req: Request) {
    try {
        const { pseudo, email, password } = await req.json();

        await connectDB();

        // Vérifier si email existe
        const exists = await User.findOne({ email });
        if (exists) {
            return NextResponse.json(
                { error: "Email déjà utilisé." },
                { status: 400 }
            );
        }

        // Hash PW
        const hashed = await bcrypt.hash(password, 10);

        // Création user
        const newUser = await User.create({
            pseudo,
            email,
            password: hashed,
        });

        // Générer token
        const token = jwt.sign(
            { id: newUser._id },
            process.env.JWT_SECRET!,
            { expiresIn: "7d" }
        );

        return NextResponse.json(
            {
                user: {
                    id: newUser._id,
                    pseudo: newUser.pseudo,
                    email: newUser.email,
                },
                token,
            },
            { status: 201 }
        );

    } catch (err) {
        console.error("❌ Register error:", err);
        return NextResponse.json(
            { error: "Erreur serveur." },
            { status: 500 }
        );
    }
}