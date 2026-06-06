import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Post from "@/models/Post";
import { verifyToken } from "@/lib/auth";
import { deleteUserCascade } from "@/lib/deleteUserCascade";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        await connectDB();

        const userId = await verifyToken(req);
        if (!userId) {
            return NextResponse.json(
                { error: "Non authentifié." },
                { status: 401, headers: { "Cache-Control": "no-store" } }
            );
        }

        const user = await User.findById(userId)
            .select(
                "_id pseudo email avatarUrl bannerUrl bio followers following followersList followingList notesCount createdAt isOnline lastSeenAt pinnedTrack favoriteArtists favoriteAlbums favoriteTracks isPrivate messagePrivacy"
            )
            .lean();

        if (!user) {
            return NextResponse.json(
                { error: "Utilisateur introuvable." },
                { status: 404, headers: { "Cache-Control": "no-store" } }
            );
        }

        const realNotesCount = await Post.countDocuments({
            userId,
            type: "post",
        });

        const safeUser = {
            ...user,
            notesCount: realNotesCount,
        };

        return NextResponse.json(
            { user: safeUser },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    } catch (err) {
        console.error("❌ GET /api/user/me error:", err);
        return NextResponse.json(
            { error: "Erreur interne du serveur." },
            { status: 500, headers: { "Cache-Control": "no-store" } }
        );
    }
}

export async function DELETE(req: Request) {
    try {
        await connectDB();

        const userId = await verifyToken(req);
        if (!userId) {
            return NextResponse.json(
                { error: "Non authentifié." },
                { status: 401, headers: { "Cache-Control": "no-store" } }
            );
        }

        const body = await req.json().catch(() => null);
        const password = typeof body?.password === "string" ? body.password : "";
        const confirmation = typeof body?.confirmation === "string" ? body.confirmation.trim() : "";

        if (confirmation !== "SUPPRIMER") {
            return NextResponse.json(
                { error: "Confirmation invalide." },
                { status: 400, headers: { "Cache-Control": "no-store" } }
            );
        }

        const user: any = await User.findById(userId).select("_id password").lean();
        if (!user) {
            return NextResponse.json(
                { error: "Utilisateur introuvable." },
                { status: 404, headers: { "Cache-Control": "no-store" } }
            );
        }

        const passwordOk = await bcrypt.compare(password, user.password || "");
        if (!passwordOk) {
            return NextResponse.json(
                { error: "Mot de passe incorrect." },
                { status: 403, headers: { "Cache-Control": "no-store" } }
            );
        }

        await deleteUserCascade(userId);

        return NextResponse.json(
            { success: true },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    } catch (err) {
        console.error("❌ DELETE /api/user/me error:", err);
        return NextResponse.json(
            { error: "Erreur interne du serveur." },
            { status: 500, headers: { "Cache-Control": "no-store" } }
        );
    }
}
