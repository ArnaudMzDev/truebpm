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

import "@/lib/loadModels";
import { connectDB } from "@/lib/db";
import { verifyTokenSocket } from "./verifyTokenSocket";

import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import Notification from "@/models/Notification";
import User from "@/models/User";

const PORT = Number(process.env.SOCKET_PORT || 3001);

async function emitPresenceToContacts(io: Server, userId: string, isOnline: boolean, lastSeenAt: Date) {
 try {
  const me: any = await User.findById(userId)
      .select("followersList followingList")
      .lean();

  const targets = new Set<string>();

  for (const id of me?.followersList || []) targets.add(String(id));
  for (const id of me?.followingList || []) targets.add(String(id));

  const payload = {
   userId: String(userId),
   isOnline: !!isOnline,
   lastSeenAt: lastSeenAt.toISOString(),
  };

  for (const targetId of targets) {
   io.to(`user:${targetId}`).emit("presence:update", payload);
  }
 } catch (e: any) {
  console.log("emitPresenceToContacts error:", e?.message || e);
 }
}

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

 io.use(async (socket, next) => {
  try {
   const token = socket.handshake.auth?.token;
   const userId = await verifyTokenSocket(token);
   // @ts-ignore
   socket.userId = String(userId);
   return next();
  } catch (e: any) {
   console.log("SOCKET auth failed:", e?.message || e);
   return next(new Error("Unauthorized"));
  }
 });

 io.on("connection", async (socket) => {
  // @ts-ignore
  const meId = socket.userId as string;

  console.log("✅ socket connected:", {
   socketId: socket.id,
   userId: meId,
   transport: socket.conn.transport.name,
  });

  socket.join(`user:${meId}`);

  // ✅ online
  try {
   const now = new Date();

   await User.findByIdAndUpdate(meId, {
    $set: {
     isOnline: true,
     lastSeenAt: now,
    },
   });

   await emitPresenceToContacts(io, meId, true, now);
  } catch (e: any) {
   console.log("presence connect error:", e?.message || e);
  }

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
   } catch (e: any) {
    console.log("read:mark error", e?.message || e);
   }
  });

  socket.on("disconnect", async (reason) => {
   console.log("🛑 socket disconnected:", {
    socketId: socket.id,
    userId: meId,
    reason,
   });

   try {
    const stillConnected = await io.in(`user:${meId}`).fetchSockets();
    if (stillConnected.length === 0) {
     const now = new Date();

     await User.findByIdAndUpdate(meId, {
      $set: {
       isOnline: false,
       lastSeenAt: now,
      },
     });

     await emitPresenceToContacts(io, meId, false, now);
    }
   } catch (e: any) {
    console.log("presence disconnect error:", e?.message || e);
   }
  });
 });

 try {
  const messageChangeStream = Message.watch(
      [{ $match: { operationType: "insert" } }],
      { fullDocument: "updateLookup" }
  );

  messageChangeStream.on("change", async (change: any) => {
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

  messageChangeStream.on("error", (e: any) => {
   console.log("Message ChangeStream error:", e?.message || e);
  });
 } catch (e: any) {
  console.log("Message ChangeStream unavailable.", e?.message || e);
 }

 try {
  const notificationChangeStream = Notification.watch(
      [{ $match: { operationType: "insert" } }],
      { fullDocument: "updateLookup" }
  );

  notificationChangeStream.on("change", async (change: any) => {
   const doc = change.fullDocument;
   if (!doc) return;

   const recipientId = String(doc.recipientId);

   const populated = await Notification.findById(doc._id)
       .populate("actorId", "_id pseudo avatarUrl")
       .populate("postId", "_id trackTitle artist coverUrl")
       .populate("commentId", "_id text")
       .lean();

   const unreadCount = await Notification.countDocuments({
    recipientId,
    isRead: false,
   });

   io.to(`user:${recipientId}`).emit("notification:new", {
    notification: populated,
   });

   io.to(`user:${recipientId}`).emit("notifications:unread_count", {
    unreadCount,
   });
  });

  notificationChangeStream.on("error", (e: any) => {
   console.log("Notification ChangeStream error:", e?.message || e);
  });
 } catch (e: any) {
  console.log("Notification ChangeStream unavailable.", e?.message || e);
 }

 server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Socket server listening on :${PORT}`);
 });
}

main().catch((e) => {
 console.error("Socket server fatal:", e);
 process.exit(1);
});