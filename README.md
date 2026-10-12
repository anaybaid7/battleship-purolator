# Purolator Battleship (Driver Battle League)

Two-player Battleship for Purolator events, with delivery vehicles instead of boats. You each hide five vehicles on a grid and take turns calling shots until one fleet is gone.

Live at **https://battleship-purolator.onrender.com**

I built this during my co-op on the Network Engineering team. It stays up after my term ends so people can keep playing.

## Playing

1. Enter a callsign and hit **Create game room**
2. Send your rival the room code or the invite link (it looks like `battleship-purolator.onrender.com/K7QX2`)
3. They open the link or type the code and hit **Join delivery zone**
4. You both drag your vehicles onto the board, then **Lock in routes**
5. A coin flip picks who fires first, and the turn passes after every shot

If someone is already waiting for a rival, their room shows up in the lobby and you can join it in one click.

### The fleet

| Vehicle | Size |
|---|---|
| Air Freighter | 5 |
| Semi Truck | 4 |
| Delivery Van | 3 |
| Cargo Bike | 3 |
| Scooter | 2 |

Vehicles can touch but can't overlap. Click a placed vehicle to rotate it, or use **Random** and **Clear**.

## What's in it

- Real-time play over Socket.IO, with a short grace period if someone's connection drops
- Board size anywhere from 6x6 to 15x15. Either player can propose a size, the other has to accept, and it locks once a fleet is placed
- Drag and drop placement that works with a mouse or on a phone
- You're told which vehicle you sank, and the loser gets to see where the winner's remaining vehicles were
- A shot log, plus a match report at the end (accuracy, first hit, best streak, both final boards)
- Rematch without going back to the lobby
- Lobby shows who's online, open rooms, recent games and records (fewest shots, fastest win, best aim)
- The board on the front page replays the last real game, or plays a practice round if nobody has finished one yet
- Rankings are grouped by callsign, so playing again under the same name adds to your record

Everything is kept in memory. Rankings and history clear when the server restarts, goes to sleep, or someone hits Reset.

## Reset game (for whoever runs it after me)

There's a **Reset game** button in the top right of every page. It

1. Pings the server until it answers. On Render's free plan the server sleeps after about 15 minutes with nobody on it and takes around a minute to wake up, so this is also how you wake it
2. Ends every game in progress and clears the rankings
3. Sends every open tab back to the start screen

If a game is stuck, acting weird, or you want a clean leaderboard for a new event, hit Reset and wait. Nothing needs to be done on Render.

To stop it sleeping between events, point a free monitor like cron-job.org at `https://battleship-purolator.onrender.com/status` every 14 minutes.

## Running locally

```
npm install
npm start
```

Open http://localhost:3000 in two tabs to play yourself. Invite links always point at the live site, so to test joining by link locally use `http://localhost:3000/ROOMCODE`.

### Tests

```
npm test
```

In-process tests with no real network. They cover a full game and rematch, leaderboard grouping by name, custom board sizes, and the board size handshake.

## How it's laid out

### Server (`server/`)

| File | What it does |
|---|---|
| `index.js` | Starts Express and Socket.IO, serves the page, `/status`, `/reset` and `/<ROOMCODE>` invite links |
| `src/constants.js` | Fleet, board limits, timeouts |
| `src/validation.js` | Cleans up anything coming in from clients |
| `src/roomManager.js` | In-memory store of active rooms |
| `src/roomCloser.js` | Deletes a room and tells both players |
| `src/leaderboard.js` | Wins, losses and accuracy per callsign |
| `src/history.js` | Last few finished games, records, and the replay for the front page |
| `src/handlers/roomLifecycle.js` | Creating and joining rooms, board size handshake, disconnects |
| `src/handlers/gameplay.js` | Placement, firing, game over, rematches |

### Front end (`public/`)

| File | What it does |
|---|---|
| `index.html` | Page markup |
| `css/styles.css` | All the styling |
| `js/config.js`, `js/state.js` | Board limits and shared client state |
| `js/utils.js` | Small DOM helpers |
| `js/grid.js` | Draws a board, the vehicles, hits, fire and wrecks |
| `js/demo.js` | The replay board on the front page |
| `js/barcode.js` | Code 39 barcode of the room code on the waiting screen |
| `js/socketClient.js` | Socket connection, lobby info and rankings |
| `js/lobby.js` | Creating and joining games, invite links |
| `js/placement.js` | Fleet placement and the board size flow |
| `js/game.js` | Firing, sinking, game over and rematch |
| `js/reset.js` | The Reset game button |
| `js/main.js` | Startup |

`docs/teams-integration.md` has notes on a possible future feature for matching players through Teams.

Anay Baid, Purolator Network Engineering, 2026
