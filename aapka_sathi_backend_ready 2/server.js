'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT || 3000);
const MAX_CONNECTIONS = Number(process.env.MAX_CONNECTIONS || 1000);
const MAX_ROOMS = Number(process.env.MAX_ROOMS || 5000);
const MAX_MEMBERS = 2;
const MAX_CIPHERTEXT = 12000;
const ROOM_RE = /^[a-f0-9]{32}$/;
const IV_RE = /^[A-Za-z0-9_-]{16,32}$/;
const CIPHERTEXT_RE = /^[A-Za-z0-9_-]+$/;

const io = new Server(server, {
  maxHttpBufferSize: 16 * 1024,
  cors: { origin: false },
  serveClient: true,
  pingInterval: 25000,
  pingTimeout: 20000,
  connectionStateRecovery: { maxDisconnectionDuration: 0, skipMiddlewares: false }
});

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  next();
});

app.get('/healthz', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'aapka-sathi-relay',
    connectedClients: io.engine.clientsCount,
    activeRooms: rooms.size
  });
});

app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  maxAge: '1h',
  index: 'index.html'
}));

// The server receives only random room IDs and encrypted payloads.
// It never receives the AES key or message plaintext.
const rooms = new Map();

function reply(callback, data) {
  if (typeof callback === 'function') callback(data);
}

function leaveRoom(socket) {
  const room = socket.data.room;
  if (!room) return;
  const members = rooms.get(room);
  if (members) {
    members.delete(socket.id);
    if (members.size === 0) rooms.delete(room);
    else io.to(room).emit('peer-status', { online: false });
  }
  socket.leave(room);
  socket.data.room = null;
}

io.on('connection', socket => {
  if (io.engine.clientsCount > MAX_CONNECTIONS) {
    socket.disconnect(true);
    return;
  }

  socket.data.room = null;
  socket.data.lastJoinAt = 0;
  socket.data.joinAttempts = [];
  socket.data.messageTimes = [];

  socket.on('join-room', (rawRoom, callback) => {
    const now = Date.now();
    const attempts = socket.data.joinAttempts.filter(t => now - t < 10000);
    if (attempts.length >= 5 || now - socket.data.lastJoinAt < 500) {
      socket.data.joinAttempts = attempts;
      reply(callback, { ok: false, error: 'Too many attempts. Please wait a moment.' });
      return;
    }
    attempts.push(now);
    socket.data.joinAttempts = attempts;
    socket.data.lastJoinAt = now;

    const room = typeof rawRoom === 'string' ? rawRoom : '';
    if (!ROOM_RE.test(room)) {
      reply(callback, { ok: false, error: 'Room ID is invalid. Use the invite link or full room code.' });
      return;
    }

    const existing = rooms.get(room);
    if (!existing && rooms.size >= MAX_ROOMS) {
      reply(callback, { ok: false, error: 'The service is busy. Please try again later.' });
      return;
    }

    const members = existing || new Set();
    if (members.size >= MAX_MEMBERS && !members.has(socket.id)) {
      reply(callback, { ok: false, error: 'This room already has two connected people.' });
      return;
    }

    if (socket.data.room && socket.data.room !== room) leaveRoom(socket);

    members.add(socket.id);
    rooms.set(room, members);
    socket.join(room);
    socket.data.room = room;

    reply(callback, { ok: true, count: members.size });
    socket.to(room).emit('peer-status', { online: true });
  });

  socket.on('encrypted-message', payload => {
    const room = socket.data.room;
    if (!room || !payload || typeof payload !== 'object') return;

    const now = Date.now();
    const recent = socket.data.messageTimes.filter(t => now - t < 1000);
    if (recent.length >= 10) return;
    socket.data.messageTimes = [...recent, now];

    const iv = payload.iv;
    const ciphertext = payload.ciphertext;
    if (typeof iv !== 'string' || typeof ciphertext !== 'string') return;
    if (!IV_RE.test(iv) || !CIPHERTEXT_RE.test(ciphertext)) return;
    if (ciphertext.length > MAX_CIPHERTEXT) return;

    // Relay ciphertext only. Never log payloads, keys, or message contents.
    socket.to(room).emit('encrypted-message', {
      iv,
      ciphertext,
      sentAt: now
    });
  });

  socket.on('leave-room', () => leaveRoom(socket));

  socket.on('disconnect', () => leaveRoom(socket));
});

function shutdown(signal) {
  console.log(`${signal}: shutting down aapka sathi relay`);
  io.close(() => {
    server.close(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, '0.0.0.0', () => {
  console.log(`aapka sathi relay listening on port ${PORT}`);
});
