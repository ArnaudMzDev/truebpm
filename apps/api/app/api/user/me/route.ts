import { NextResponse } from "next/server";
import User from "@/models/User";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// GET /api/auth/me
export async function GET(req: Request) {
    try {
        await connectDB();

        // Récupération du token dans l'en-tête Authorization
        const authHeader = req.headers.get("authorization");
        if (!authHeader)
            return NextResponse.json(
                { error: "Token manquant." },
                { status: 401 }
            );

        const token = authHeader.replace("Bearer ", "").trim();
        if (!token)
            return NextResponse.json(
                { error: "Token invalide." },
                { status: 401 }
            );

        // Vérification du token via notre helper sécurisé
        const decoded = verifyToken(token);
        if (!decoded || !decoded.id)
            return NextResponse.json(
                { error: "Token invalide ou expiré." },
                { status: 401 }
            );

        // Cherche l'utilisateur associé au token
        const user = await User.findById(decoded.id).select("-password");
        if (!user)
            return NextResponse.json(
                { error: "Utilisateur non trouvé." },
                { status: 404 }
            );

        return NextResponse.json({ user }, { status: 200 });
    } catch (err) {
        console.error("❌ /api/auth/me error:", err);
        return NextResponse.json(
            { error: "Erreur interne du serveur." },
            { status: 500 }
        );
    }
}