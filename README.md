# Purolator Battleship

Two-player Battleship with Purolator vehicles instead of boats. Each player
hides five vehicles on a grid, then you take turns calling shots until
someone's whole fleet is gone.

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
history.js keeps the last few finished games and a count, for the lobby
roomManager.js is the in-memory store for active game rooms
roomCloser.js is a small shared helper for deleting a room and notifying both players when it happens
handlers/roomLifecycle.js handles creating/joining rooms, the board-size propose/confirm handshake, and disconnects
handlers/gameplay.js handles ship placement, firing, and rematches

The front end lives in public/. index.html is just the page markup, styles are in css/styles.css, and the JavaScript is split into one file per concern under js/:

config.js and state.js hold the board size limits and the shared client-side state
utils.js has small DOM helpers used everywhere
grid.js renders a board (water, ship drawings per vehicle, explosions/fire, aiming highlight)
barcode.js draws the Code 39 barcode of the room code on the waiting screen
demo.js is the little self-playing board on the lobby
socketClient.js sets up the socket connection and renders the standings
reset.js is the Reset game button in the top right (see below)
lobby.js handles making/joining a game
placement.js is the fleet placement screen: drag ships from the dock onto the board, click one to turn it, Random/Clear buttons, and the board-resize flow
game.js is the actual game: firing, sinking, game over, rematch
main.js does app init and the waiting-screen tips

docs/teams-integration.md has some notes on a possible future feature for matching players via Teams
added some tests also (rip)

## Tests

```bash
npm test
```

Runs a set of in-process tests (no real network needed) covering a full
game + rematch flow, leaderboard aggregation by player name, and the
configurable board size feature.

24/06 - recommited post tests

## Resetting the game (for whoever is running it after me)

There's a **Reset game** button in the top right of every page. Clicking it:

1. Pings the server until it answers. On Render's free plan the server goes to sleep after ~15 min with nobody on it and takes about a minute to wake up, so if it was asleep this is what wakes it.
2. Ends every game in progress and clears the standings.
3. Reloads the page (and every other open tab) back to the start screen.

So if the game is stuck, acting weird, or you just want a fresh leaderboard for a new event, hit Reset and wait. Nothing else needs to be done on Render.

Note: the standings only live in memory, so they also clear on their own whenever Render puts the server to sleep or restarts it.

## Features

The game supports real-time multiplayer gameplay using Socket.IO with reconnect handling. Players can customize the board size between 6x6 and 15x15 before the match begins. Either player can propose a different board size, but the change only happens after the other player accepts. Once a fleet has been placed, the board size becomes locked.

The leaderboard tracks player performance across multiple matches by aggregating statistics under the player's name. Wins, losses, shots fired, and accuracy are maintained instead of creating duplicate records for repeat players.

When a hit finishes off a vehicle, both players are told which one was sunk and it turns solid red on the board. When the game ends, the loser gets to see where the winner's remaining vehicles were hiding. There's a running list of every shot under the boards.
