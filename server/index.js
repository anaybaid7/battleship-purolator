const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingTimeout: 20000,
  pingInterval: 10000,
  maxHttpBufferSize: 1e6,
  transports: ["websocket", "polling"],
});

app.use(express.static(path.join(__dirname, "../public")));

// ── In-memory state ──────────────────────────────────────────
const rooms = {};       // roomId → room
const leaderboard = {}; // socketId → { name, wins, losses, shots, hits }
const socketToRoom = {}; // socketId → roomId  (fast lookup, avoids scanning all rooms)

// ── Constants ────────────────────────────────────────────────
const SHIPS = [
  { name: "Air Freighter",  size: 5, icon: "✈️"  },
  { name: "Semi Truck",     size: 4, icon: "🚛"  },
  { name: "Delivery Van",   size: 3, icon: "🚐"  },
  { name: "Cargo Bike",     size: 3, icon: "🚲"  },
  { name: "Scooter",        size: 2, icon: "🛵"  },
];
const TOTAL_SHIP_CELLS = SHIPS.reduce((s, sh) => s + sh.size, 0); // 17

const ROOM_TIMEOUT_MS = 30 * 60 * 1000; // auto-clean rooms after 30 min idle

// ── Helpers ──────────────────────────────────────────────────
function generateRoomId() {
  // 5-char alphanumeric, avoid confusable chars
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 5; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return rooms[id] ? generateRoomId() : id; // guarantee uniqueness
}

function createPlayer(id, name) {
  return {
    id, name,
    board: Array(100).fill(null),
    ships: [],
    ready: false,
    hits: 0,
    shotsFired: 0,
    shotsHit: 0,
    rematch: false,
  };
}

function getOpponent(room, socketId) {
  return room.players.find(p => p.id !== socketId);
}

function getSelf(room, socketId) {
  return room.players.find(p => p.id === socketId);
}

function ensureLeaderboard(id, name) {
  if (!leaderboard[id]) leaderboard[id] = { name, wins: 0, losses: 0, shots: 0, hits: 0 };
  leaderboard[id].name = name; // update name in case they changed it
}

function broadcastLeaderboard() {
  const sorted = Object.entries(leaderboard)
    .map(([id, s]) => ({ name: s.name, wins: s.wins, losses: s.losses, shots: s.shots, hits: s.hits }))
    .sort((a, b) => b.wins - a.wins || b.hits - a.hits)
    .slice(0, 20);
  io.emit("leaderboard_update", sorted);
}

function scheduleRoomCleanup(roomId) {
  if (rooms[roomId]?._cleanupTimer) clearTimeout(rooms[roomId]._cleanupTimer);
  if (!rooms[roomId]) return;
  rooms[roomId]._cleanupTimer = setTimeout(() => {
    deleteRoom(roomId, "timeout");
  }, ROOM_TIMEOUT_MS);
}

function deleteRoom(roomId, reason) {
  const room = rooms[roomId];
  if (!room) return;
  clearTimeout(room._cleanupTimer);
  room.players.forEach(p => {
    delete socketToRoom[p.id];
    io.to(p.id).emit("room_closed", { reason });
  });
  delete rooms[roomId];
  console.log(`Room ${roomId} deleted (${reason}). Active rooms: ${Object.keys(rooms).length}`);
}

// ── Socket.io ─────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[+] ${socket.id} connected. Total: ${io.engine.clientsCount}`);

  // Send current leaderboard to new connection
  const sorted = Object.entries(leaderboard)
    .map(([, s]) => ({ name: s.name, wins: s.wins, losses: s.losses, shots: s.shots, hits: s.hits }))
    .sort((a, b) => b.wins - a.wins || b.hits - a.hits)
    .slice(0, 20);
  socket.emit("leaderboard_update", sorted);

  // ── CREATE ROOM ──
  socket.on("create_room", ({ name }) => {
    if (!name || typeof name !== "string") return;
    name = name.slice(0, 20).trim();
    if (!name) return;

    // If already in a room, leave it first
    if (socketToRoom[socket.id]) {
      const oldRoom = rooms[socketToRoom[socket.id]];
      if (oldRoom) {
        const opp = getOpponent(oldRoom, socket.id);
        if (opp) io.to(opp.id).emit("opponent_left");
        deleteRoom(oldRoom.id, "creator left");
      }
    }

    const roomId = generateRoomId();
    rooms[roomId] = {
      id: roomId,
      players: [createPlayer(socket.id, name)],
      turn: null,
      state: "waiting",
      startedAt: null,
      _cleanupTimer: null,
    };
    socketToRoom[socket.id] = roomId;
    socket.join(roomId);
    ensureLeaderboard(socket.id, name);
    scheduleRoomCleanup(roomId);

    socket.emit("room_created", { roomId, playerIndex: 0 });
    console.log(`Room ${roomId} created by "${name}". Active rooms: ${Object.keys(rooms).length}`);
  });

  // ── JOIN ROOM ──
  socket.on("join_room", ({ roomId, name }) => {
    if (!name || !roomId) return;
    name = name.slice(0, 20).trim();
    roomId = roomId.toUpperCase().trim();

    const room = rooms[roomId];
    if (!room) return socket.emit("error", "Room not found. Check your code and try again.");
    if (room.players.length >= 2) return socket.emit("error", "This route is already full.");
    if (room.state !== "waiting") return socket.emit("error", "Game already in progress.");

    // Leave old room if any
    if (socketToRoom[socket.id]) {
      const oldRoom = rooms[socketToRoom[socket.id]];
      if (oldRoom && oldRoom.id !== roomId) {
        const opp = getOpponent(oldRoom, socket.id);
        if (opp) io.to(opp.id).emit("opponent_left");
        deleteRoom(oldRoom.id, "player moved");
      }
    }

    room.players.push(createPlayer(socket.id, name));
    socketToRoom[socket.id] = roomId;
    socket.join(roomId);
    ensureLeaderboard(socket.id, name);

    room.state = "placing";
    const names = room.players.map(p => p.name);
    io.to(roomId).emit("both_connected", { names, ships: SHIPS });
    scheduleRoomCleanup(roomId);
    console.log(`Room ${roomId}: "${name}" joined.`);
  });

  // ── PLACE SHIPS ──
  socket.on("place_ships", ({ ships: placedShips }) => {
    const roomId = socketToRoom[socket.id];
    const room = rooms[roomId];
    if (!room || room.state !== "placing") return;

    const player = getSelf(room, socket.id);
    if (!player || player.ready) return;

    // Validate input
    if (!Array.isArray(placedShips) || placedShips.length !== SHIPS.length) return;
    const allCells = placedShips.flatMap(s => s.cells || []);
    if (allCells.some(c => typeof c !== "number" || c < 0 || c >= 100)) return;
    if (new Set(allCells).size !== allCells.length) return; // duplicates

    player.ships = placedShips;
    placedShips.forEach(ship => ship.cells.forEach(idx => { player.board[idx] = "ship"; }));
    player.ready = true;

    socket.emit("placement_confirmed");
    scheduleRoomCleanup(roomId);

    if (room.players.every(p => p.ready)) {
      room.state = "playing";
      room.startedAt = Date.now();
      room.turn = room.players[Math.floor(Math.random() * 2)].id;
      io.to(roomId).emit("game_start", { turn: room.turn });
      console.log(`Room ${roomId}: game started.`);
    }
  });

  // ── FIRE ──
  socket.on("fire", ({ index }) => {
    const roomId = socketToRoom[socket.id];
    const room = rooms[roomId];
    if (!room || room.state !== "playing") return;
    if (room.turn !== socket.id) return;
    if (typeof index !== "number" || index < 0 || index >= 100) return;

    const opponent = getOpponent(room, socket.id);
    const self = getSelf(room, socket.id);
    if (!opponent || !self) return;

    const cell = opponent.board[index];
    if (cell === "hit" || cell === "miss") return;

    const isHit = cell === "ship";
    opponent.board[index] = isHit ? "hit" : "miss";
    self.shotsFired++;
    leaderboard[socket.id].shots++;

    if (isHit) {
      opponent.hits++;
      self.shotsHit++;
      leaderboard[socket.id].hits++;
    }

    scheduleRoomCleanup(roomId);

    // Win check
    if (opponent.hits >= TOTAL_SHIP_CELLS) {
      room.state = "done";
      const duration = Math.round((Date.now() - room.startedAt) / 1000);
      const accuracy = self.shotsFired > 0 ? Math.round((self.shotsHit / self.shotsFired) * 100) : 0;

      leaderboard[socket.id].wins = (leaderboard[socket.id].wins || 0) + 1;
      leaderboard[opponent.id].losses = (leaderboard[opponent.id].losses || 0) + 1;

      io.to(roomId).emit("shot_result", { index, result: "hit", firedBy: socket.id });
      io.to(roomId).emit("game_over", {
        winner: socket.id,
        winnerName: self.name,
        stats: {
          shots: self.shotsFired,
          hits: self.shotsHit,
          accuracy,
          duration,
        },
      });
      broadcastLeaderboard();
      return;
    }

    room.turn = opponent.id;
    io.to(roomId).emit("shot_result", {
      index,
      result: isHit ? "hit" : "miss",
      firedBy: socket.id,
      nextTurn: room.turn,
    });
  });

  // ── REMATCH ──
  socket.on("request_rematch", () => {
    const roomId = socketToRoom[socket.id];
    const room = rooms[roomId];
    if (!room || room.state !== "done") return;

    const player = getSelf(room, socket.id);
    if (!player) return;
    player.rematch = true;

    if (room.players.every(p => p.rematch)) {
      room.players.forEach(p => {
        p.board = Array(100).fill(null);
        p.ships = [];
        p.ready = false;
        p.hits = 0;
        p.shotsFired = 0;
        p.shotsHit = 0;
        p.rematch = false;
      });
      room.turn = null;
      room.state = "placing";
      io.to(roomId).emit("rematch_start", { ships: SHIPS });
      scheduleRoomCleanup(roomId);
    } else {
      const opp = getOpponent(room, socket.id);
      if (opp) io.to(opp.id).emit("rematch_requested");
    }
  });

  // ── DISCONNECT ──
  socket.on("disconnect", (reason) => {
    console.log(`[-] ${socket.id} disconnected (${reason}). Total: ${io.engine.clientsCount}`);
    const roomId = socketToRoom[socket.id];
    if (!roomId) return;
    const room = rooms[roomId];
    if (!room) return;
    delete socketToRoom[socket.id];

    const opp = getOpponent(room, socket.id);
    if (opp) {
      io.to(opp.id).emit("opponent_left");
    }
    // Give the room a short grace window in case they reconnect; then delete
    setTimeout(() => {
      if (rooms[roomId]) deleteRoom(roomId, "disconnect");
    }, 8000);
  });
});

// ── Health check endpoint ─────────────────────────────────────
app.get("/status", (_, res) => {
  res.json({
    activeRooms: Object.keys(rooms).length,
    connectedPlayers: io.engine.clientsCount,
    leaderboardEntries: Object.keys(leaderboard).length,
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚚 Purolator Battleship running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/status`);
});
