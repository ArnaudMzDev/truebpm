import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { loginSchema } from "@/lib/validators/auth";
import { signToken } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        await connectDB();

        const body = await req.json().catch(() => null);

        const parsed = loginSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Email ou mot de passe invalide." }, { status: 400 });
        }

        const email = parsed.data.email.trim().toLowerCase();
        const password = parsed.data.password;

        const userDoc = await User.findOne({ email });
        if (!userDoc) {
            return NextResponse.json({ error: "Cet email n'existe pas." }, { status: 400 });
        }

        const match = await bcrypt.compare(password, userDoc.password);
        if (!match) {
            return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 400 });
        }

        const token = signToken(userDoc._id.toString());
        console.log("LOGIN token head:", token.slice(0, 20));

        // ✅ user complet (source de vérité)
        const user = await User.findById(userDoc._id)
            .select("_id pseudo email avatarUrl bannerUrl bio followers following followersList followingList notesCount createdAt")
            .lean();

        if (!user) {
            return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
        }

        return NextResponse.json({ success: true, token, user }, { status: 200 });
    } catch (err) {
        console.error("❌ POST /api/auth/login error:", err);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}