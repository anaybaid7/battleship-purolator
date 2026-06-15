# Purolator Driver Battle League (Battleship)

A real-time, two-player Battleship game themed as a Purolator logistics
"driver battle league." Players place a fleet of delivery vehicles on a
grid and take turns firing at their opponent's board.

## Running locally

```bash
npm install
npm start
```

Then open `http://localhost:3000`. Open it in two browser tabs (or share
the room code with someone else) to play a match.

## Project structure

The server lives in server/. index.js is the entrypoint; it just wires everything together and starts the HTTP/socket server, but doesn't contain any game logic itself. The actual logic is split up in server/src/:

constants.js has the ship list, board size limits, and timeout values
validation.js sanitizes and validates anything coming in from clients
leaderboard.js tracks wins/losses/accuracy, aggregated by player name
roomManager.js is the in-memory store for active game rooms
roomCloser.js is a small shared helper for deleting a room and notifying both players when it happens
handlers/roomLifecycle.js handles creating/joining rooms, the board-size propose/confirm handshake, and disconnects
handlers/gameplay.js handles ship placement, firing, and rematches

The front end lives in public/. index.html is just the page markup, styles are in css/styles.css, and the JavaScript is split into one file per concern under js/:

config.js and state.js hold static config (airport codes, board size limits) and the shared client-side state
utils.js has small DOM/formatting helpers used everywhere
grid.js renders the board
settings.js is the display settings panel (cell size, toggles, etc.)
socketClient.js sets up the socket connection and renders the leaderboard
lobby.js handles the create/join room screens
placement.js is the fleet placement screen, including the board-resize flow
game.js is the actual battle screen — firing, game over, rematch
main.js just does app init

docs/teams-integration.md has some notes on a possible future feature for matching players via Teams.
test/ has a handful of scripts that exercise the game logic end to end without needing a browser — a full game + rematch + leaderboard check (unit-flow.js), an 8x8 board game (board-dim-test.js), a check that the smallest allowed board still fits every ship (small-board-test.js), and the board-size propose/accept/decline flow (board-confirm-test.js).

## Tests

```bash
npm test
```

Runs a set of in-process tests (no real network needed) covering a full
game + rematch flow, leaderboard aggregation by player name, and the
configurable board size feature.

## Features

- **Real-time multiplayer** over Socket.IO, with reconnect handling
- **Configurable board size** (anywhere from 6x6 to 15x15) -> either player
  can propose a new size on the Fleet Setup screen. The other player gets
  an accept/decline prompt; the board only resizes if they confirm. This
  is locked once someone has placed their fleet.
- **Leaderboard aggregated by player name** -> if the same callsign plays
  multiple matches (e.g. requesting a rematch), their wins, losses, shots
  and accuracy accumulate into a single row instead of creating duplicate
  entries.
- **Package-tracking sidebar** that logs every shot as a "delivery event"
  using Canadian airport codes for grid coordinates.
- Display settings for grid size, font scale, toasts, animations, and
  ship health bars.
