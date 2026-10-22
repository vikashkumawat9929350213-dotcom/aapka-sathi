const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 16 * 1024,
  cors: { origin: false }
});

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' https://cdn.socket.io; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'");
  next();
});
app.use(express.static(path.join(__dirname, "public"), { etag: false, maxAge: 0 }));

const roomMembers = new Map();
const MAX_ROOM_MEMBERS = 2;
const ROOM_RE = /^[A-Za-z0-9_-]{20,80}$/;

io.on("connection", socket => {
  socket.on("join-room", (rawRoom, callback) => {
    const room = typeof rawRoom === "string" ? rawRoom.trim() : "";
    if (!ROOM_RE.test(room)) {
      if (typeof callback === "function") callback({ ok: false, error: "Room code format is invalid." });
      return;
    }

    const members = roomMembers.get(room) || new Set();
    if (members.size >= MAX_ROOM_MEMBERS && !members.has(socket.id)) {
      if (typeof callback === "function") callback({ ok: false, error: "This room already has two people." });
      return;
    }

    // A socket may occupy only one room at a time.
    for (const [oldRoom, oldMembers] of roomMembers.entries()) {
      if (oldMembers.has(socket.id)) {
        oldMembers.delete(socket.id);
        socket.leave(oldRoom);
        if (oldMembers.size === 0) roomMembers.delete(oldRoom);
        else roomMembers.set(oldRoom, oldMembers);
      }
    }

    members.add(socket.id);
    roomMembers.set(room, members);
    socket.join(room);
    socket.data.room = room;
    if (typeof callback === "function") callback({ ok: true, count: members.size });
    socket.to(room).emit("peer-status", { online: true });
  });

  socket.on("encrypted-message", payload => {
    const room = socket.data.room;
    if (!room || !payload || typeof payload.iv !== "string" || typeof payload.ciphertext !== "string") return;
    if (payload.iv.length > 100 || payload.ciphertext.length > 12000) return;
    // Relay encrypted bytes only; server never receives plaintext or a key.
    socket.to(room).emit("encrypted-message", {
      iv: payload.iv,
      ciphertext: payload.ciphertext,
      sentAt: Date.now()
    });
  });

  socket.on("disconnect", () => {
    const room = socket.data.room;
    if (!room) return;
    const members = roomMembers.get(room);
    if (!members) return;
    members.delete(socket.id);
    if (members.size === 0) roomMembers.delete(room);
    else {
      roomMembers.set(room, members);
      socket.to(room).emit("peer-status", { online: false });
    }
  });
});

const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () => {
  console.log(`aapka sathi server listening on port ${port}`);
});