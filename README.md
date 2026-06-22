# Purolator Driver Battle League (Battleship)

A real-time, two-player Battleship game themed as a Purolator logistics
"driver battle league." Players place a fleet of delivery vehicles on a
grid and take turns firing at their opponent's board.

## Running locally (if not on Render)

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
game.js is the actual battle screen which are firing, game over, rematch
main.js just does app init

docs/teams-integration.md has some notes on a possible future feature for matching players via Teams
added some tests also (rip)

## Tests

```bash
npm test
```

Runs a set of in-process tests (no real network needed) covering a full
game + rematch flow, leaderboard aggregation by player name, and the
configurable board size feature.

## Features

The game supports real-time multiplayer gameplay using Socket.IO with reconnect handling. Players can customize the board size between 6x6 and 15x15 before the match begins. Either player can propose a different board size, but the change only happens after the other player accepts. Once a fleet has been placed, the board size becomes locked.

The leaderboard tracks player performance across multiple matches by aggregating statistics under the player's name. Wins, losses, shots fired, and accuracy are maintained instead of creating duplicate records for repeat players.

During gameplay, a package tracking sidebar records every attack as a delivery event using Canadian airport codes as grid references, matching the Purolator logistics theme.

The application also includes display customization options such as grid sizing, font scaling, toast notifications, animations, and ship health indicators.
