// apps/api/src/socket-server.ts
import dotenv from "dotenv";
import path from "path";
import crypto from "crypto";
import http from "http";
import { Server } from "socket.io";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const fp = (s?: string) =>
    s ? crypto.createHash("sha256").update(s).digest("hex").slice(0, 8) : "missing";

console.log("SOCKET JWT_SECRET fp:", fp(process.env.JWT_SECRET));
console.log("SOCKET cwd:", process.cwd());
console.log("SOCKET env path:", path.resolve(process.cwd(), ".env.local"));
console.log("SOCKET raw JWT_SECRET:", process.env.JWT_SECRET);

import "@/lib/loadModels";
import { connectDB } from "@/lib/db";
import { verifyTokenSocket } from "./verifyTokenSocket";

import Conversation from "@/models/Conversation";
import Message from "@/models/Message";

const PORT = Number(process.env.SOCKET_PORT || 3001);

async function main() {
 await connectDB();

 const server = http.createServer();

 server.on("error", (e) => {
  console.log("❌ socket http server error:", e);
 });

 const io = new Server(server, {
  cors: {
   origin: "*",
   methods: ["GET", "POST"],
  },
  transports: ["polling", "websocket"],
 });

 // ✅ Auth middleware
 io.use(async (socket, next) => {
  try {
   const token = socket.handshake.auth?.token;

   console.log(
       "SOCKET token head:",
       typeof token === "string" ? token.slice(0, 16) : token
   );

   const userId = await verifyTokenSocket(token);

   // @ts-ignore
   socket.userId = String(userId);

   return next();
  } catch (e: any) {
   console.log("SOCKET auth failed:", e?.message || e);
   return next(new Error("Unauthorized"));
  }
 });

 io.on("connection", (socket) => {
  // @ts-ignore
  const meId = socket.userId as string;

  console.log("✅ socket connected:", {
   socketId: socket.id,
   userId: meId,
   transport: socket.conn.transport.name,
  });

  socket.join(`user:${meId}`);

  socket.on("conversation:join", ({ conversationId }) => {
   if (!conversationId) return;
   socket.join(`conversation:${conversationId}`);
   console.log("📥 joined conversation:", { socketId: socket.id, conversationId });
  });

  socket.on("conversation:leave", ({ conversationId }) => {
   if (!conversationId) return;
   socket.leave(`conversation:${conversationId}`);
   console.log("📤 left conversation:", { socketId: socket.id, conversationId });
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
   } catch (e: any) {
    console.log("read:mark error", e?.message || e);
   }
  });

  socket.on("disconnect", (reason) => {
   console.log("🛑 socket disconnected:", {
    socketId: socket.id,
    userId: meId,
    reason,
   });
  });
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

  changeStream.on("error", (e: any) => {
   console.log("ChangeStream error:", e?.message || e);
  });
 } catch (e: any) {
  console.log("ChangeStream unavailable (Mongo must be replica set).", e?.message || e);
 }

 server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Socket server listening on :${PORT}`);
 });
}

main().catch((e) => {
 console.error("Socket server fatal:", e);
 process.exit(1);
});