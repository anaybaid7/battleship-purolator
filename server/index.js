// server entry. game logic is in src/, this just wires it up + /status and /reset

const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { Server } = require("socket.io");

const { RoomManager } = require("./src/roomManager");
const { Leaderboard } = require("./src/leaderboard");
const { History } = require("./src/history");
const { createRoomCloser } = require("./src/roomCloser");
const { registerRoomLifecycleHandlers } = require("./src/handlers/roomLifecycle");
const { registerGameplayHandlers } = require("./src/handlers/gameplay");
const { LEADERBOARD_SIZE } = require("./src/constants");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingTimeout: 20000,
  pingInterval: 10000,
  maxHttpBufferSize: 1e6,
  transports: ["websocket", "polling"],
});

app.use(express.static(path.join(__dirname, "../public")));
app.get(/^\/([A-HJ-NP-Z2-9]{5})$/i, (_req, res) => res.sendFile(path.join(__dirname, "../public/index.html")));

// Shared state
const rooms = new RoomManager();
const leaderboard = new Leaderboard();
const history = new History();
const closeRoom = createRoomCloser(io, rooms);
function deleteRoom(roomId, reason) {
  closeRoom(roomId, reason);
  broadcastLobby();
}

function broadcastLeaderboard() {
  io.emit("leaderboard_update", leaderboard.top(LEADERBOARD_SIZE));
}

// numbers for the strip on the lobby: who's on, what's being played
function lobbyStats() {
  let playing = 0;
  const open = [];
  for (const room of rooms.rooms.values()) {
    if (room.state === "playing" || room.state === "placing") playing += 1;
    else if (room.state === "waiting") {
      // skip rooms whose creator already closed the tab
      const host = room.players[0];
      if (host && io.sockets.sockets.has(host.id)) open.push({ code: room.id, host: host.name, since: room.createdAt });
    }
  }
  open.sort((a, b) => a.since - b.since);
  return {
    online: io.engine.clientsCount,
    playing,
    waiting: open.length,
    open,
    finished: history.finished,
    recent: history.recent(),
    records: history.bests(),
  };
}

function broadcastLobby() {
  io.emit("lobby_stats", lobbyStats());
}

// Socket.io
io.on("connection", (socket) => {
  console.log(`[+] ${socket.id} connected. Total: ${io.engine.clientsCount}`);

  socket.emit("leaderboard_update", leaderboard.top(LEADERBOARD_SIZE));
  broadcastLobby();

  const ctx = { io, socket, rooms, leaderboard, history, deleteRoom, broadcastLeaderboard, broadcastLobby };
  registerRoomLifecycleHandlers(ctx);
  registerGameplayHandlers(ctx);

  // let the counts settle after the room handlers have cleaned up
  socket.on("disconnect", () => setTimeout(broadcastLobby, 50));
});

// Health check endpoint
app.get("/status", (_req, res) => {
  res.json({
    activeRooms: rooms.activeRoomCount,
    connectedPlayers: io.engine.clientsCount,
    leaderboardEntries: leaderboard.size,
  });
});

// Who gets the Reset button. Set RESET_KEY in Render > Environment and only
// people who opened the site once with ?key=<that password> see it. With no
// RESET_KEY set, everyone sees it like before.
const RESET_KEY = process.env.RESET_KEY || "";
function canReset(req) {
  if (!RESET_KEY) return true;
  const given = Buffer.from(String(req.get("x-reset-key") || ""));
  const want = Buffer.from(RESET_KEY);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

app.get("/reset/allowed", (req, res) => {
  res.set("Cache-Control", "no-store").json({ allowed: canReset(req) });
});

// Reset button in the top right of the page hits this. Ends every game in
// progress, wipes the standings and tells every open tab to reload.
app.post("/reset", (req, res) => {
  if (!canReset(req)) return res.status(403).json({ ok: false });
  const closed = rooms.clearAll();
  leaderboard.clear();
  history.clear();
  io.emit("server_reset");
  broadcastLeaderboard();
  console.log(`Reset: closed ${closed.length} room(s), standings cleared.`);
  res.json({ ok: true, roomsClosed: closed.length });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Purolator Battleship running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/status`);
});
