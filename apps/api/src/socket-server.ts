// apps/api/src/socket-server.ts
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env.local") });

import "@/lib/loadModels";
import { connectDB } from "@/lib/db";
import { verifyTokenSocket } from "./verifyTokenSocket";

import Conversation from "@/models/Conversation";
import Message from "@/models/Message";

const PORT = Number(process.env.SOCKET_PORT || 3001);

async function main() {
    await connectDB();

    const server = http.createServer();

    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
        // ✅ Laisse Socket.IO choisir / accepte polling + websocket
        transports: ["polling", "websocket"],
    });

    // ✅ Auth middleware
    io.use(async (socket, next) => {
        try {
            console.log("SOCKET token head:", String(socket.handshake.auth?.token || "").slice(0, 16));
            const token = socket.handshake.auth?.token; // ✅ token brut
            const userId = await verifyTokenSocket(token);
            // @ts-ignore
            socket.userId = String(userId);
            next();
        } catch (e) {
            next(new Error("Unauthorized"));
        }
    });

    io.on("connection", (socket) => {
        // @ts-ignore
        const meId = socket.userId as string;

        socket.join(`user:${meId}`);

        socket.on("conversation:join", ({ conversationId }) => {
            if (!conversationId) return;
            socket.join(`conversation:${conversationId}`);
        });

        socket.on("conversation:leave", ({ conversationId }) => {
            if (!conversationId) return;
            socket.leave(`conversation:${conversationId}`);
        });

        socket.on("typing:set", ({ conversationId, typing }) => {
            if (!conversationId) return;
            socket.to(`conversation:${conversationId}`).emit("typing:update", {
                conversationId,
                userId: meId,
                typing: !!typing,
            });
        });

        socket.on("read:mark", async ({ conversationId }) => {
            try {
                if (!conversationId) return;

                const convo = await Conversation.findById(conversationId).lean();
                if (!convo) return;

                const isMember = (convo.participants || []).some(
                    (p: any) => String(p) === String(meId)
                );
                if (!isMember) return;

                const now = new Date();
                await Conversation.findByIdAndUpdate(conversationId, {
                    $set: { [`readAt.${meId}`]: now },
                });

                io.to(`conversation:${conversationId}`).emit("read:update", {
                    conversationId,
                    userId: meId,
                    readAt: now.toISOString(),
                });
            } catch (e) {
                // on évite de crasher le socket
                console.log("read:mark error", (e as any)?.message || e);
            }
        });

        socket.on("disconnect", () => {});
    });

    // ✅ Change streams (Mongo replica set / Atlas)
    try {
        const changeStream = Message.watch(
            [{ $match: { operationType: "insert" } }],
            { fullDocument: "updateLookup" }
        );

        changeStream.on("change", async (change: any) => {
            const doc = change.fullDocument;
            if (!doc) return;

            const conversationId = String(doc.conversationId);

            const populated = await Message.findById(doc._id)
                .populate("senderId", "_id pseudo avatarUrl")
                .populate("postId")
                .lean();

            io.to(`conversation:${conversationId}`).emit("message:new", {
                conversationId,
                message: populated,
            });

            const convo = await Conversation.findById(conversationId).lean();
            const participants = (convo?.participants || []).map((p: any) => String(p));

            for (const uid of participants) {
                io.to(`user:${uid}`).emit("conversations:invalidate", { userId: uid });
            }
        });

        changeStream.on("error", (e) => {
            console.log("ChangeStream error:", (e as any)?.message || e);
        });
    } catch (e: any) {
        console.log("ChangeStream unavailable (Mongo must be replica set).", e?.message || e);
    }

    server.listen(PORT, () => {
        console.log(`✅ Socket server listening on :${PORT}`);
    });
}

main().catch((e) => {
    console.error("Socket server fatal:", e);
    process.exit(1);
});