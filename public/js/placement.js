// fleet setup. drag ships from the dock onto the board, drag again to move,
// click to rotate. pointer events so it works on touch too

function shipCells(start, size, orient) {
  const dim = state.boardDim;
  const r = Math.floor(start / dim);
  const c = start % dim;
  const cells = [];
  for (let i = 0; i < size; i++) {
    if (orient === "H") {
      if (c + i >= dim) return null;
      cells.push(r * dim + c + i);
    } else {
      if (r + i >= dim) return null;
      cells.push((r + i) * dim + c);
    }
  }
  return cells;
}

function fits(cells) {
  return cells && cells.every((c) => !state.myBoard[c]);
}

function orientOf(cells) {
  const sorted = [...cells].sort((a, b) => a - b);
  return sorted.length > 1 && sorted[1] - sorted[0] === state.boardDim ? "V" : "H";
}

function putShip(name, cells) {
  cells.forEach((c) => { state.myBoard[c] = "ship"; });
  state.placed.push({ name, cells });
}

function liftShip(name) {
  const at = state.placed.findIndex((p) => p.name === name);
  if (at === -1) return null;
  const p = state.placed[at];
  p.cells.forEach((c) => { state.myBoard[c] = null; });
  state.placed.splice(at, 1);
  return p;
}

function drawPlacement() {
  document.querySelectorAll("#place-grid .cell").forEach((el) => {
    el.className = "cell" + (state.locked ? "" : " can-place");
  });
  clearShips("place-grid");
  state.placed.forEach((p) => drawShip("place-grid", p.cells, "", p.name));
  drawDock();

  drawManifest();
  const allIn = state.placed.length === state.ships.length;
  $("confirm-btn").disabled = !allIn || state.locked;
  $("random-btn").disabled = !!state.locked;
  $("clear-btn").disabled = !!state.locked;
  if (!state.locked) {
    $("place-msg").textContent = allIn
      ? "All vehicles placed. Lock in your routes."
      : "";
  }
}

function drawDock() {
  const dock = $("dock");
  // ships not on the board yet, minus the one in your hand
  const left = state.ships.map((s, i) => ({ s, i }))
    .filter(({ s, i }) => !state.placed.some((p) => p.name === s.name) && !(drag && drag.moved && drag.shipIdx === i));
  if (!left.length) {
    dock.innerHTML = '<p class="dock-empty">All vehicles are on the board.</p>';
    return;
  }
  dock.innerHTML = left.map(({ s, i }) => {
    const o = state.dockOrient[i] || "H";
    const len = `calc(var(--cell) * ${s.size})`;
    const style = o === "H" ? `width:${len};height:var(--cell)` : `height:${len};width:var(--cell)`;
    return `<div class="dock-ship ${o === "V" ? "v" : ""}" data-i="${i}" title="${esc(s.name)}, ${s.size} squares"><div class="dock-hull" style="${style}">${shipSVG(s.size, o === "V", s.name)}</div><span class="label">${esc(s.name)} (${s.size})</span></div>`;
  }).join("");
  dock.querySelectorAll(".dock-ship").forEach((el) => {
    el.addEventListener("pointerdown", (e) => startDrag(e, Number(el.dataset.i), "dock", el));
  });
}

// ---- dragging ----

let drag = null;

function startDrag(e, shipIdx, from, el) {
  if (state.locked || e.button > 0) return;
  e.preventDefault();
  const ship = state.ships[shipIdx];
  let orient = state.dockOrient[shipIdx] || "H";
  let grab = 0; // which segment of the ship the pointer is holding
  let original = null;

  if (from === "dock") {
    const hull = el.querySelector(".dock-hull").getBoundingClientRect();
    grab = orient === "H"
      ? Math.floor((e.clientX - hull.left) / (hull.width / ship.size))
      : Math.floor((e.clientY - hull.top) / (hull.height / ship.size));
    grab = Math.max(0, Math.min(ship.size - 1, grab));
  } else {
    const idx = Number(el.dataset.i);
    original = state.placed.find((p) => p.name === ship.name);
    orient = orientOf(original.cells);
    const sorted = [...original.cells].sort((a, b) => a - b);
    grab = sorted.indexOf(idx);
  }

  drag = { shipIdx, from, orient, grab, original, startX: e.clientX, startY: e.clientY, moved: false, ghost: null, anchor: null };
  document.addEventListener("pointermove", onDragMove);
  document.addEventListener("pointerup", onDragEnd);
  document.addEventListener("pointercancel", onDragEnd);
}

function makeGhost() {
  const ship = state.ships[drag.shipIdx];
  const cell = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--cell")) || 36;
  const g = document.createElement("div");
  g.className = "drag-ghost";
  const long = cell * ship.size, short = cell;
  g.style.width = (drag.orient === "H" ? long : short) + "px";
  g.style.height = (drag.orient === "H" ? short : long) + "px";
  g.innerHTML = shipSVG(ship.size, drag.orient === "V", ship.name);
  g._cell = cell;
  document.body.appendChild(g);
  drag.ghost = g;
}

function positionGhost(x, y) {
  const g = drag.ghost, c = g._cell;
  const along = drag.grab * c + c / 2;
  if (drag.orient === "H") {
    g.style.left = (x - along) + "px";
    g.style.top = (y - c / 2) + "px";
  } else {
    g.style.left = (x - c / 2) + "px";
    g.style.top = (y - along) + "px";
  }
}

function onDragMove(e) {
  if (!drag) return;
  if (!drag.moved) {
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6) return;
    drag.moved = true;
    document.body.classList.add("dragging");
    if (drag.from === "board") {
      liftShip(state.ships[drag.shipIdx].name);
      drawPlacement();
    }
    makeGhost();
  }
  positionGhost(e.clientX, e.clientY);
  updateDropPreview(e.clientX, e.clientY);
}

function cellUnder(x, y) {
  const el = document.elementFromPoint(x, y);
  const cell = el && el.closest && el.closest("#place-grid .cell");
  return cell ? Number(cell.dataset.i) : null;
}

function anchorFor(idx) {
  const dim = state.boardDim;
  if (idx === null) return null;
  if (drag.orient === "H") {
    const c = idx % dim - drag.grab;
    return c < 0 ? null : idx - drag.grab;
  }
  const r = Math.floor(idx / dim) - drag.grab;
  return r < 0 ? null : idx - drag.grab * dim;
}

function updateDropPreview(x, y) {
  clearPreview();
  const anchor = anchorFor(cellUnder(x, y));
  drag.anchor = anchor;
  if (anchor === null) return;
  const cells = shipCells(anchor, state.ships[drag.shipIdx].size, drag.orient);
  const ok = fits(cells);
  (cells || [anchor]).forEach((c) => {
    const el = cellAt("place-grid", c);
    if (el) el.classList.add(ok ? "preview-ok" : "preview-bad");
  });
}

function clearPreview() {
  document.querySelectorAll("#place-grid .preview-ok, #place-grid .preview-bad")
    .forEach((c) => c.classList.remove("preview-ok", "preview-bad"));
}

function onDragEnd(e) {
  document.removeEventListener("pointermove", onDragMove);
  document.removeEventListener("pointerup", onDragEnd);
  document.removeEventListener("pointercancel", onDragEnd);
  document.body.classList.remove("dragging");
  if (!drag) return;
  const d = drag;
  drag = null;
  if (d.ghost) d.ghost.remove();
  clearPreview();
  const ship = state.ships[d.shipIdx];

  // a click, not a drag: turn the ship
  if (!d.moved) {
    if (d.from === "dock") {
      state.dockOrient[d.shipIdx] = d.orient === "H" ? "V" : "H";
    } else {
      rotatePlaced(ship.name);
    }
    drawPlacement();
    return;
  }

  const cells = d.anchor === null ? null : shipCells(d.anchor, ship.size, d.orient);
  if (e.type !== "pointercancel" && fits(cells)) {
    putShip(ship.name, cells);
  } else if (d.original) {
    // dropped somewhere it can't go, put it back where it was
    putShip(d.original.name, d.original.cells);
  }
  drawPlacement();
}

function rotatePlaced(name) {
  const p = liftShip(name);
  if (!p) return;
  const sorted = [...p.cells].sort((a, b) => a - b);
  const turned = shipCells(sorted[0], p.cells.length, orientOf(p.cells) === "H" ? "V" : "H");
  if (fits(turned)) {
    putShip(name, turned);
  } else {
    putShip(name, p.cells);
    $("place-msg").textContent = "No room to rotate it there.";
    setTimeout(() => { if (!state.locked) drawPlacement(); }, 1500);
  }
}

function boardPointerDown(e) {
  const cell = e.target.closest(".cell");
  if (!cell || state.locked) return;
  const idx = Number(cell.dataset.i);
  if (state.myBoard[idx] !== "ship") return;
  const p = state.placed.find((s) => s.cells.includes(idx));
  if (!p) return;
  startDrag(e, state.ships.findIndex((s) => s.name === p.name), "board", cell);
}

function randomPlacement() {
  if (state.locked) return;
  const size = state.boardDim * state.boardDim;
  for (let attempt = 0; attempt < 200; attempt++) {
    state.myBoard = Array(size).fill(null);
    state.placed = [];
    let failed = false;
    for (const ship of state.ships) {
      let done = false;
      for (let t = 0; t < 300 && !done; t++) {
        const o = Math.random() < 0.5 ? "H" : "V";
        const cells = shipCells(Math.floor(Math.random() * size), ship.size, o);
        if (fits(cells)) {
          putShip(ship.name, cells);
          done = true;
        }
      }
      if (!done) { failed = true; break; }
    }
    if (!failed) break;
  }
  drawPlacement();
}

function clearPlacement() {
  if (state.locked) return;
  state.placed = [];
  state.myBoard = Array(state.boardDim * state.boardDim).fill(null);
  drawPlacement();
}

function confirmPlacement() {
  if (state.placed.length < state.ships.length) return;
  socket.emit("place_ships", { ships: state.placed });
  $("confirm-btn").disabled = true;
}

function buildPlacement() {
  $("place-name").textContent = state.myName;
  $("place-msg").classList.remove("good");
  state.locked = false;
  state.dockOrient = {};
  state.placed = [];
  state.myBoard = Array(state.boardDim * state.boardDim).fill(null);

  $("board-size-input").value = state.boardDim;
  setSizeControls(true);
  $("board-size-status").textContent = "";

  makeGrid("place-grid");
  $("place-grid").onpointerdown = boardPointerDown;
  drawPlacement();
}

// R turns the ship you're holding
document.addEventListener("keydown", (e) => {
  if ((e.key === "r" || e.key === "R") && drag && drag.moved) {
    drag.orient = drag.orient === "H" ? "V" : "H";
    drag.grab = Math.min(drag.grab, state.ships[drag.shipIdx].size - 1);
    drag.ghost.remove();
    makeGhost();
    clearPreview();
  }
});

// board size

function applyBoardDim() {
  let dim = Math.round(Number($("board-size-input").value));
  if (!Number.isFinite(dim)) dim = state.boardDim;
  dim = Math.max(MIN_BOARD_DIM, Math.min(MAX_BOARD_DIM, dim));
  $("board-size-input").value = dim;
  if (dim === state.boardDim) return;
  socket.emit("set_board_dim", { boardDim: dim });
}

function setSizeControls(on) {
  $("board-size-input").disabled = !on;
  $("board-size-apply").disabled = !on;
}

function respondToBoardDim(accept) {
  socket.emit("board_dim_response", { accept });
  $("board-size-status").textContent = "";
}


socket.on("board_dim_proposal_sent", ({ boardDim }) => {
  $("board-size-status").textContent = `Waiting for ${state.oppName} to confirm ${boardDim}×${boardDim}...`;
  setSizeControls(false);
});

socket.on("board_dim_proposed", ({ boardDim, proposedByName }) => {
  $("board-size-status").innerHTML =
    `${esc(proposedByName)} wants to play on <strong>${boardDim}×${boardDim}</strong>.` +
    `<br><button class="btn btn-red btn-small" onclick="respondToBoardDim(true)">Accept</button>` +
    `<button class="btn btn-outline btn-small" onclick="respondToBoardDim(false)">Decline</button>`;
  setSizeControls(false);
});

socket.on("board_resized", ({ boardDim, confirmedByName }) => {
  state.boardDim = boardDim;
  buildPlacement();
  $("board-size-status").textContent = `Board resized to ${boardDim}×${boardDim}, confirmed by ${confirmedByName}.`;
});

socket.on("board_dim_declined", ({ boardDim, declinedByName }) => {
  $("board-size-input").value = boardDim;
  setSizeControls(true);
  $("board-size-status").textContent = `${declinedByName} kept the board at ${boardDim}×${boardDim}.`;
});

socket.on("placement_confirmed", () => {
  state.locked = true;
  setSizeControls(false);
  drawPlacement();
  $("place-msg").textContent = `Locked in. Waiting for ${state.oppName}...`;
  $("place-msg").classList.add("good");
});

// the list in the fleet panel: every vehicle, its length, and where it is
function drawManifest() {
  const rows = state.ships.map((s) => {
    const p = state.placed.find((x) => x.name === s.name);
    const where = p ? coord(Math.min(...p.cells)) + (p.cells.length > 1 && p.cells[1] - p.cells[0] === state.boardDim ? " down" : " across") : "in dock";
    return `<tr class="${p ? "on" : ""}"><td>${esc(s.name)}</td><td>${s.size}</td><td>${where}</td></tr>`;
  }).join("");
  $("manifest").innerHTML = rows;
  $("manifest-count").textContent = `${state.placed.length} of ${state.ships.length} placed`;
}
