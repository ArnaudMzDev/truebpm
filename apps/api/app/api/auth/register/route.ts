import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { RegisterSchema } from "@/lib/validators/auth";
import { signToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);
        const parsed = RegisterSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || "Champs invalides." },
                { status: 400 }
            );
        }

        const pseudo = parsed.data.pseudo;
        const email = parsed.data.email.trim().toLowerCase();
        const password = parsed.data.password;
        const termsVersion = parsed.data.termsVersion || "2026-05-26";
        const privacyVersion = parsed.data.privacyVersion || "2026-05-26";

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
        const hashed = await bcrypt.hash(password, 12);

        // Création user
        const newUser = await User.create({
            pseudo,
            email,
            password: hashed,
            legalAcceptedAt: new Date(),
            termsVersion,
            privacyVersion,
        });

        // Générer token
        const token = signToken(newUser._id.toString());

        return NextResponse.json(
            {
                user: {
                    _id: newUser._id,
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
