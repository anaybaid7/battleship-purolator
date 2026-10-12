// battle screen

function buildGame() {
  state.enemySunk = [];
  state.mySunk = [];
  state.over = false;

  $("hud-myname").textContent = state.myName;
  $("hud-oppname").textContent = state.oppName;

  makeGrid("my-grid");
  state.placed.forEach((p) => drawShip("my-grid", p.cells, "", p.name));

  const theirs = makeGrid("enemy-grid");
  theirs.forEach((el, i) => {
    el.classList.add("can-fire");
    el.addEventListener("click", () => fireAt(i));
  });
  hookAim("enemy-grid", "target-readout");

  $("log").innerHTML = '<li class="empty">No shots yet</li>';
  shotNo = 0;
  $("shot-badge").textContent = "0";
  refreshHUD();
  drawFleets();
}

function refreshHUD() {
  $("hud-shots").textContent = state.shots;
  $("hud-acc").textContent = state.shots > 0 ? Math.round((state.hits / state.shots) * 100) + "%" : "-";
  $("hud-sunk").textContent = state.enemySunk.length;
}

function drawFleets() {
  // your own fleet shows damage per ship, theirs only shows what you've sunk
  const list = (sunk, mine) => state.ships.map((s) => {
    const down = sunk.includes(s.name);
    let dmg = "";
    if (mine) {
      const p = state.placed.find((x) => x.name === s.name);
      const hits = p ? p.cells.filter((c) => state.myBoard[c] === "hit").length : 0;
      dmg = `<span class="dmg">${Array.from({ length: s.size }, (_, k) => `<i class="${k < hits ? "x" : ""}"></i>`).join("")}</span>`;
    }
    return `<li class="${down ? "down" : ""}" title="${esc(s.name)}${down ? " (sunk)" : ""}">` +
      `<span class="mini" style="width:calc(${s.size} * 1em + ${s.size}px)">${shipSVG(s.size, false, s.name)}</span><span class="nm">${esc(s.name)}</span>${dmg}</li>`;
  }).join("");
  $("enemy-fleet").innerHTML = list(state.enemySunk, false);
  $("my-fleet").innerHTML = list(state.mySunk, true);
  const n = state.ships.length;
  $("my-status").textContent = state.mySunk.length === 0 ? "intact" : `${state.mySunk.length} of ${n} sunk`;
}

// outline the most recent shot on a board so you can see what just happened
function markLast(gridId, index) {
  document.querySelectorAll(`#${gridId} .cell.last`).forEach((c) => c.classList.remove("last"));
  const el = cellAt(gridId, index);
  if (el) el.classList.add("last");
}

function setStatus(sub) {
  const mine = state.myTurn && !state.over;
  $("turn-pill").className = "turn-pill " + (mine ? "mine" : "theirs");
  document.querySelector("#game .hud").classList.toggle("mine", mine);
  document.querySelector("#game .hud").classList.toggle("over", state.over);
  $("turn-text").textContent = state.over ? "Game over" : mine ? "Your turn, fire!" : `${state.oppName}'s turn`;
  if (sub !== undefined) $("status-sub").innerHTML = sub;
  $("their-col").classList.toggle("off", !mine && !state.over);
  $("their-col").classList.toggle("turn", mine);
  $("my-col").classList.toggle("incoming", !mine && !state.over);
  $("their-status").textContent = state.over ? "game over" : mine ? "click to fire" : "wait for your turn";
}

function fireAt(i) {
  if (state.over) return;
  if (!state.myTurn) {
    setStatus("Wait for your turn.");
    return;
  }
  if (state.enemyBoard[i]) return;
  state.myTurn = false;
  socket.emit("fire", { index: i });
}

let shotNo = 0;
function addLog(who, index, result, sunkName) {
  const log = $("log");
  const empty = log.querySelector(".empty");
  if (empty) empty.remove();
  shotNo++;
  $("shot-badge").textContent = shotNo;
  const li = document.createElement("li");
  const res = sunkName ? `sank the ${esc(sunkName)}` : result;
  li.innerHTML = `<span class="no">${shotNo}</span><i class="peg ${result}"></i><span class="who">${esc(who)}</span><span class="at">${coord(index)}</span><span class="res ${result}">${res}</span>`;
  log.insertBefore(li, log.firstChild);
}

function flash(el) {
  if (!el) return;
  el.classList.remove("just");
  void el.offsetWidth; // restart the animation
  el.classList.add("just");
}

function requestRematch() {
  socket.emit("request_rematch");
  $("ov-note").textContent = `Asked ${state.oppName} for a rematch. Waiting for them to accept.`;
  $("rematch-btn").disabled = true;
}

socket.on("both_connected", ({ names, ships, boardDim }) => {
  state.myName = names[state.pidx] || names[0];
  state.oppName = names[state.pidx === 0 ? 1 : 0] || names[1];
  resetMatchState(ships, boardDim || DEFAULT_BOARD_DIM);
  buildPlacement();
  showScreen("placement");
  setNav(1);
});

// match clock in the HUD
let clockTimer = null;
function startClock() {
  stopClock();
  const t0 = Date.now();
  $("hud-time").textContent = "0:00";
  clockTimer = setInterval(() => {
    const sec = Math.floor((Date.now() - t0) / 1000);
    $("hud-time").textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  }, 1000);
}
function stopClock() {
  if (clockTimer) clearInterval(clockTimer);
  clockTimer = null;
}

socket.on("game_start", ({ turn }) => {
  state.myTurn = turn === state.sid;
  startClock();
  state.enemyBoard = Array(state.boardDim * state.boardDim).fill(null);
  buildGame();
  showScreen("game");
  setNav(2);
  setStatus(state.myTurn
    ? `You fire first. Pick a square on ${esc(state.oppName)}'s board.`
    : `${esc(state.oppName)} fires first.`);
});

socket.on("shot_result", ({ index, result, firedBy, nextTurn, sunk }) => {
  const mine = firedBy === state.sid;
  const spot = coord(index);
  let sub;

  if (mine) {
    state.enemyBoard[index] = result;
    state.shots++;
    state.myResults.push(result);
    if (result === "hit") state.hits++;
    const el = cellAt("enemy-grid", index);
    el.classList.remove("can-fire");
    el.classList.add(result);
    flash(el);
    markLast("enemy-grid", index);
    if (result === "hit") { boom("enemy-grid", index); setBurning("enemy-grid", index); }
    if (sunk) {
      drawShip("enemy-grid", sunk.cells, "sunk", sunk.name);
      setWreck("enemy-grid", sunk.cells);
      state.enemySunk.push(sunk.name);
      sub = `<b>You sank ${esc(state.oppName)}'s ${esc(sunk.name)}!</b>`;
    } else {
      sub = result === "hit" ? `Hit at ${spot}!` : `Miss at ${spot}.`;
    }
  } else {
    state.myBoard[index] = result;
    state.theirResults.push(result);
    const el = cellAt("my-grid", index);
    el.classList.add(result);
    flash(el);
    markLast("my-grid", index);
    if (result === "hit") { boom("my-grid", index); setBurning("my-grid", index); }
    const them = esc(state.oppName);
    if (sunk) {
      drawShip("my-grid", sunk.cells, "sunk", sunk.name);
      setWreck("my-grid", sunk.cells);
      state.mySunk.push(sunk.name);
      sub = `<b>${them} sank your ${esc(sunk.name)}!</b>`;
    } else {
      sub = result === "hit" ? `${them} hit you at ${spot}!` : `${them} missed at ${spot}.`;
    }
  }

  addLog(mine ? "You" : state.oppName, index, result, sunk && sunk.name);
  refreshHUD();
  drawFleets();
  if (nextTurn) state.myTurn = nextTurn === state.sid;
  setStatus(sub);
});

socket.on("game_over", ({ winner, winnerName, fleets, stats }) => {
  const won = winner === state.sid;
  state.over = true;
  state.myTurn = false;
  document.querySelectorAll("#enemy-grid .cell").forEach((c) => c.classList.remove("can-fire"));

  // show where their ships were that I never found
  const theirs = fleets && Object.keys(fleets).find((id) => id !== state.sid);
  if (theirs) {
    fleets[theirs].forEach((s) => {
      if (!state.enemySunk.includes(s.name)) drawShip("enemy-grid", s.cells, "ghost", s.name);
    });
  }

  stopClock();
  const mins = Math.floor(stats.duration / 60);
  const secs = stats.duration % 60;
  const time = `${mins}:${String(secs).padStart(2, "0")}`;

  $("ov-title").className = "ov-title " + (won ? "win" : "lose");
  $("ov-title").textContent = won ? "Delivered!" : "Route failed";
  $("ov-sub").textContent = won
    ? `You intercepted all of ${state.oppName}'s vehicles.`
    : `${winnerName} destroyed your entire fleet.`;
  $("ov-compare").innerHTML = matchReport();
  $("ov-maps").innerHTML =
    miniMap("Your shots", state.enemyBoard, theirs ? fleets[theirs] : [], true) +
    miniMap(`${esc(state.oppName)}'s shots`, state.myBoard, state.placed, false);
  $("ov-time").textContent = `Match time ${time}`;
  $("ov-note").textContent = "";
  $("rematch-btn").disabled = false;

  refreshHUD();
  setStatus("");
  setTimeout(() => {
    $("gameover").classList.add("show");
    $("gameover").scrollIntoView({ behavior: "smooth", block: "start" });
  }, 600);
});

socket.on("rematch_requested", () => {
  $("ov-note").textContent = `${state.oppName} wants a rematch. Hit Request rematch to start it.`;
});

socket.on("rematch_start", ({ ships, boardDim }) => {
  resetMatchState(ships, boardDim);
  $("gameover").classList.remove("show");
  buildPlacement();
  showScreen("placement");
  setNav(1);
});

socket.on("opponent_left", () => {
  stopClock();
  if ($("lobby").classList.contains("active")) return;
  $("gameover").classList.remove("show");
  $("left").classList.add("show");
});

// ---- match report on the game over card ----

function firstHit(results) {
  const i = results.indexOf("hit");
  return i === -1 ? "-" : "#" + (i + 1);
}

function bestStreak(results) {
  let best = 0, run = 0;
  results.forEach((r) => { run = r === "hit" ? run + 1 : 0; best = Math.max(best, run); });
  return best;
}

function matchReport() {
  const mine = state.myResults, theirs = state.theirResults;
  const hits = (r) => r.filter((x) => x === "hit").length;
  const acc = (r) => (r.length ? Math.round((hits(r) / r.length) * 100) + "%" : "-");
  const rows = [
    ["Shots", mine.length, theirs.length],
    ["Hits", hits(mine), hits(theirs)],
    ["Accuracy", acc(mine), acc(theirs)],
    ["First hit", firstHit(mine), firstHit(theirs)],
    ["Best hit streak", bestStreak(mine), bestStreak(theirs)],
    ["Ships lost", state.mySunk.length, state.enemySunk.length],
  ];
  return `<thead><tr><th></th><th>You</th><th>${esc(state.oppName)}</th></tr></thead><tbody>` +
    rows.map(([l, a, b]) => `<tr><td>${l}</td><td>${a}</td><td>${b}</td></tr>`).join("") + "</tbody>";
}

// small picture of a finished board. ships come from the fleet list so the
// loser can see what they missed
function miniMap(title, board, ships, enemy) {
  const dim = state.boardDim;
  const shipAt = new Set();
  (ships || []).forEach((s) => s.cells.forEach((c) => shipAt.add(c)));
  let cells = "";
  for (let i = 0; i < dim * dim; i++) {
    const v = board[i];
    const cls = v === "hit" ? "h" : v === "miss" ? "m" : shipAt.has(i) ? (enemy ? "g" : "s") : "";
    cells += `<i class="${cls}"></i>`;
  }
  return `<div class="mini-map"><div class="mini-title">${title}</div><div class="mini-grid" style="--d:${dim}">${cells}</div></div>`;
}
