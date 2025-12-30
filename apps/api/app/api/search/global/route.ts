import "@/lib/loadModels";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Post from "@/models/Post";
import mongoose from "mongoose";

type SearchType = "all" | "users" | "posts";

type CursorPiece = {
    score: number;
    id: string;
};

type AllCursor = {
    users?: CursorPiece | null;
    posts?: CursorPiece | null;
};

function clampLimit(n: number) {
    if (!Number.isFinite(n)) return 20;
    return Math.max(5, Math.min(30, Math.floor(n)));
}

function normalizeQuery(q: string) {
    // Multi-mots : Mongo $text traite les mots comme une requête
    // et ressort selon pertinence. Un seul mot matchant suffit.
    return q.trim().replace(/\s+/g, " ");
}

function encodeCursor(value: unknown): string {
    return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function decodeCursor<T>(cursor: string | null): T | null {
    if (!cursor) return null;
    try {
        const raw = Buffer.from(cursor, "base64").toString("utf8");
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

async function searchUsers(q: string, limit: number, cursor: CursorPiece | null) {
    const matchText: any = { $text: { $search: q } };

    const pipeline: any[] = [
        { $match: matchText },
        { $addFields: { score: { $meta: "textScore" } } },
        { $sort: { score: -1, _id: -1 } },
    ];

    if (cursor && mongoose.Types.ObjectId.isValid(cursor.id)) {
        pipeline.push({
            $match: {
                $or: [
                    { score: { $lt: cursor.score } },
                    { score: cursor.score, _id: { $lt: new mongoose.Types.ObjectId(cursor.id) } },
                ],
            },
        });
    }

    pipeline.push(
        { $limit: limit + 1 },
        {
            $project: {
                password: 0,
                email: 0,
                __v: 0,
            },
        }
    );

    const rows = await User.aggregate(pipeline);

    let nextCursor: CursorPiece | null = null;
    if (rows.length > limit) {
        const last = rows.pop();
        if (last?._id) {
            nextCursor = { score: Number(last.score ?? 0), id: String(last._id) };
        }
    }

    const users = rows.map((u: any) => ({
        _id: String(u._id),
        pseudo: u.pseudo ?? "",
        avatarUrl: u.avatarUrl ?? "",
        bio: u.bio ?? "",
        followers: u.followers ?? 0,
        following: u.following ?? 0,
    }));

    return { users, nextCursor };
}

async function searchPosts(q: string, limit: number, cursor: CursorPiece | null) {
    const matchText: any = { $text: { $search: q } };

    const pipeline: any[] = [
        { $match: matchText },
        { $addFields: { score: { $meta: "textScore" } } },
        { $sort: { score: -1, _id: -1 } },
    ];

    if (cursor && mongoose.Types.ObjectId.isValid(cursor.id)) {
        pipeline.push({
            $match: {
                $or: [
                    { score: { $lt: cursor.score } },
                    { score: cursor.score, _id: { $lt: new mongoose.Types.ObjectId(cursor.id) } },
                ],
            },
        });
    }

    pipeline.push({ $limit: limit + 1 });

    // Populate userId (pseudo/avatarUrl) via $lookup (plus robuste en aggregate)
    pipeline.push(
        {
            $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "user",
            },
        },
        {
            $addFields: {
                userId: {
                    $let: {
                        vars: { u: { $arrayElemAt: ["$user", 0] } },
                        in: {
                            _id: "$$u._id",
                            pseudo: "$$u.pseudo",
                            avatarUrl: "$$u.avatarUrl",
                        },
                    },
                },
            },
        },
        { $project: { user: 0 } }
    );

    const rows = await Post.aggregate(pipeline);

    let nextCursor: CursorPiece | null = null;
    if (rows.length > limit) {
        const last = rows.pop();
        if (last?._id) {
            nextCursor = { score: Number(last.score ?? 0), id: String(last._id) };
        }
    }

    const posts = rows.map((p: any) => ({
        _id: String(p._id),
        userId: p.userId,
        mode: p.mode,
        trackTitle: p.trackTitle,
        artist: p.artist,
        coverUrl: p.coverUrl ?? null,
        previewUrl: p.previewUrl ?? null,
        rating: p.rating ?? null,
        prod: p.prod ?? null,
        lyrics: p.lyrics ?? null,
        emotion: p.emotion ?? null,
        comment: p.comment ?? "",
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
    }));

    return { posts, nextCursor };
}

export async function GET(req: Request) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);

        const qRaw = searchParams.get("q") || "";
        const q = normalizeQuery(qRaw);

        const type = (searchParams.get("type") || "all") as SearchType;
        const limit = clampLimit(Number(searchParams.get("limit") || 20));
        const cursorParam = searchParams.get("cursor");

        if (q.length < 2) {
            return NextResponse.json({ items: [], nextCursor: null }, { status: 200 });
        }

        if (type !== "all" && type !== "users" && type !== "posts") {
            return NextResponse.json({ error: "Type invalide." }, { status: 400 });
        }

        // Cursor decode
        const decodedAll = decodeCursor<AllCursor>(cursorParam);
        const decodedSingle = decodeCursor<CursorPiece>(cursorParam);

        if (type === "users") {
            const { users, nextCursor } = await searchUsers(q, limit, decodedSingle);
            const items = users.map((u) => ({ type: "user", user: u }));
            return NextResponse.json(
                { items, nextCursor: nextCursor ? encodeCursor(nextCursor) : null },
                { status: 200 }
            );
        }

        if (type === "posts") {
            const { posts, nextCursor } = await searchPosts(q, limit, decodedSingle);
            const items = posts.map((p) => ({ type: "post", post: p }));
            return NextResponse.json(
                { items, nextCursor: nextCursor ? encodeCursor(nextCursor) : null },
                { status: 200 }
            );
        }

        // type === "all"
        const half = Math.max(5, Math.floor(limit / 2));

        const usersCursor = decodedAll?.users ?? null;
        const postsCursor = decodedAll?.posts ?? null;

        const [uRes, pRes] = await Promise.all([
            searchUsers(q, half, usersCursor),
            searchPosts(q, half, postsCursor),
        ]);

        // Merge simple : on intercale (on garde pertinence grossière via score implicit)
        const merged: Array<any> = [];
        const uItems = uRes.users.map((u) => ({ type: "user", user: u }));
        const pItems = pRes.posts.map((p) => ({ type: "post", post: p }));

        let i = 0;
        while (merged.length < limit && (i < uItems.length || i < pItems.length)) {
            if (i < pItems.length) merged.push(pItems[i]);
            if (merged.length >= limit) break;
            if (i < uItems.length) merged.push(uItems[i]);
            i += 1;
        }

        const nextCursorAll: AllCursor | null =
            uRes.nextCursor || pRes.nextCursor
                ? {
                    users: uRes.nextCursor,
                    posts: pRes.nextCursor,
                }
                : null;

        return NextResponse.json(
            { items: merged, nextCursor: nextCursorAll ? encodeCursor(nextCursorAll) : null },
            { status: 200 }
        );
    } catch (err) {
        console.error("GET /api/search/global error:", err);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}