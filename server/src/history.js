// Recent finished games, shown on the lobby so people can see what's been
// happening. In memory like everything else, so it clears on restart/reset.

// Also keeps a few records (fewest shots to win, fastest win, best aim in a
// win) across every game since the server started, not just the last 8.

class History {
  constructor(limit = 8) {
    this.limit = limit;
    this.clear();
  }

  add({ winner, loser, shots, duration, accuracy }) {
    this.finished += 1;
    const game = { winner, loser, shots, duration, accuracy, at: new Date().toISOString() };
    this.items.unshift(game);
    if (this.items.length > this.limit) this.items.length = this.limit;

    const r = this.records;
    if (!r.fewestShots || shots < r.fewestShots.shots) r.fewestShots = game;
    if (!r.fastest || duration < r.fastest.duration) r.fastest = game;
    if (!r.bestAim || accuracy > r.bestAim.accuracy) r.bestAim = game;
  }

  recent() {
    return this.items.map((g) => ({ ...g }));
  }

  bests() {
    return { ...this.records };
  }

  clear() {
    this.items = [];
    this.finished = 0;
    this.records = { fewestShots: null, fastest: null, bestAim: null };
  }
}

module.exports = { History };
