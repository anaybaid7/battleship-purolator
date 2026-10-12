// draws a board: labels, squares, water, and a layer for the ships

function makeGrid(wrapId) {
  const dim = state.boardDim;

  // size the squares so two boards fit side by side, or one on a phone
  const room = window.innerWidth < 720 ? window.innerWidth - 76 : 420;
  const cell = Math.max(18, Math.min(38, Math.floor(room / dim)));
  document.documentElement.style.setProperty("--cell", cell + "px");
  document.documentElement.style.setProperty("--dim", dim);

  const grid = document.createElement("div");
  grid.className = "grid";

  // water sits under the squares, the squares themselves are see-through
  const water = document.createElement("div");
  water.className = "water";
  water.style.width = `calc(var(--cell) * ${dim})`;
  water.style.height = `calc(var(--cell) * ${dim})`;
  grid.appendChild(water);

  grid.appendChild(document.createElement("span"));
  for (let c = 0; c < dim; c++) {
    const l = document.createElement("span");
    l.className = "lab col";
    l.dataset.c = c;
    l.textContent = COLS[c];
    grid.appendChild(l);
  }

  const cells = [];
  for (let r = 0; r < dim; r++) {
    const l = document.createElement("span");
    l.className = "lab row";
    l.dataset.r = r;
    l.textContent = r + 1;
    grid.appendChild(l);
    for (let c = 0; c < dim; c++) {
      const d = document.createElement("div");
      d.className = "cell";
      d.dataset.i = r * dim + c;
      grid.appendChild(d);
      cells.push(d);
    }
  }

  // ships sit in their own layer over the water so they can be drawn as one
  // piece instead of square by square
  const layer = document.createElement("div");
  layer.className = "ship-layer";
  layer.style.width = `calc(var(--cell) * ${dim})`;
  layer.style.height = `calc(var(--cell) * ${dim})`;
  grid.appendChild(layer);

  const sweep = document.createElement("div");
  sweep.className = "sweep";
  sweep.style.width = `calc(var(--cell) * ${dim})`;
  sweep.style.height = `calc(var(--cell) * ${dim})`;
  grid.appendChild(sweep);

  chartFurniture(grid, dim);

  const frame = document.createElement("div");
  frame.className = "board-frame";
  frame.appendChild(grid);

  // chart note, like the edition line in the corner of a nautical chart
  const note = document.createElement("div");
  note.className = "chart-note";
  const date = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
  note.textContent = `Grid ${dim} by ${dim}` + (state.roomId ? `, room ${state.roomId}` : "") + `, ${date}`;
  frame.appendChild(note);

  const wrap = $(wrapId);
  wrap.innerHTML = "";
  wrap.appendChild(frame);
  return cells;
}

function cellAt(wrapId, index) {
  return document.querySelector(`#${wrapId} .cell[data-i="${index}"]`);
}

// Top-down ship drawings. One unit = one square (100 wide), bow points right
// (or down when vertical). Each vehicle in the fleet gets its own boat so the
// board reads at a glance: carrier, container ship, freighter, patrol boat,
// speedboat.
const SHIP_TYPE = {
  "Air Freighter": "carrier",
  "Semi Truck": "container",
  "Delivery Van": "freighter",
  "Cargo Bike": "patrol",
  "Scooter": "speedboat",
};

function hullPath(W, top, bot) {
  return `M14 ${top} L${W - 58} ${top} Q${W - 12} ${top + 6} ${W - 4} 50 Q${W - 12} ${bot - 6} ${W - 58} ${bot} L14 ${bot} Q6 ${bot} 6 ${bot - 10} L6 ${top + 10} Q6 ${top} 14 ${top} Z`;
}

const SHIP_ART = {
  carrier(W) {
    let g = `<path class="hull" d="M10 12 L${W - 74} 12 L${W - 4} 50 L${W - 74} 88 L10 88 Q4 88 4 80 L4 20 Q4 12 10 12 Z"/>`;
    g += `<rect class="flightdeck" x="16" y="24" width="${W - 110}" height="52" rx="3"/>`;
    for (let x = 30; x < W - 110; x += 34) g += `<rect class="stripe" x="${x}" y="48" width="18" height="4"/>`;
    g += `<rect class="cabin" x="${Math.round(W * 0.58)}" y="13" width="54" height="15" rx="2"/>`;
    // parked plane
    const px = 60;
    g += `<path class="plane" d="M${px} 38 L${px + 6} 38 L${px + 9} 46 L${px + 26} 46 L${px + 26} 54 L${px + 9} 54 L${px + 6} 62 L${px} 62 L${px + 3} 54 L${px - 8} 54 L${px - 10} 58 L${px - 14} 58 L${px - 12} 50 L${px - 14} 42 L${px - 10} 42 L${px - 8} 46 L${px + 3} 46 Z"/>`;
    return g;
  },
  container(W) {
    let g = `<path class="hull" d="${hullPath(W, 16, 84)}"/>`;
    g += `<rect class="bridge" x="14" y="26" width="34" height="48" rx="4"/>`;
    g += `<rect class="window" x="38" y="32" width="5" height="36" rx="1"/>`;
    const colors = ["c-red", "c-navy", "c-white", "c-navy", "c-red", "c-white", "c-red", "c-navy"];
    let k = 0;
    for (let x = 56; x + 40 < W - 64; x += 44) {
      g += `<rect class="${colors[k % colors.length]}" x="${x}" y="25" width="40" height="23" rx="1.5"/>`;
      g += `<rect class="${colors[(k + 3) % colors.length]}" x="${x}" y="52" width="40" height="23" rx="1.5"/>`;
      k++;
    }
    return g;
  },
  freighter(W) {
    let g = `<path class="hull" d="${hullPath(W, 18, 82)}"/>`;
    g += `<path class="deck" d="M18 30 L${W - 66} 30 Q${W - 30} 36 ${W - 24} 50 Q${W - 30} 64 ${W - 66} 70 L18 70 Z"/>`;
    g += `<rect class="cabin" x="18" y="32" width="44" height="36" rx="4"/><rect class="window" x="54" y="38" width="4" height="24"/>`;
    for (let x = 82; x < W - 90; x += 56) g += `<rect class="hatch" x="${x}" y="36" width="44" height="28" rx="2"/>`;
    g += `<line class="mast" x1="${W - 84}" y1="50" x2="${W - 60}" y2="50"/>`;
    return g;
  },
  patrol(W) {
    let g = `<path class="hull" d="${hullPath(W, 22, 78)}"/>`;
    g += `<path class="deck" d="M18 32 L${W - 66} 32 Q${W - 30} 38 ${W - 24} 50 Q${W - 30} 62 ${W - 66} 68 L18 68 Z"/>`;
    g += `<rect class="cabin" x="${Math.round(W * 0.34)}" y="34" width="62" height="32" rx="5"/>`;
    g += `<rect class="window" x="${Math.round(W * 0.34) + 52}" y="38" width="5" height="24" rx="1"/>`;
    g += `<line class="barrel" x1="${W - 70}" y1="50" x2="${W - 36}" y2="50"/><circle class="gun" cx="${W - 74}" cy="50" r="11"/>`;
    g += `<circle class="gun" cx="34" cy="50" r="8"/>`;
    return g;
  },
  speedboat(W) {
    let g = `<path class="hull white" d="M12 24 L${W - 80} 24 Q${W - 10} 30 ${W - 4} 50 Q${W - 10} 70 ${W - 80} 76 L12 76 Q6 76 6 68 L6 32 Q6 24 12 24 Z"/>`;
    g += `<path class="c-red" d="M12 24 L${W - 80} 24 Q${W - 40} 26 ${W - 22} 34 L12 34 Z"/>`;
    g += `<path class="c-navy" d="M12 66 L${W - 22} 66 Q${W - 40} 74 ${W - 80} 76 L12 76 Z"/>`;
    g += `<path class="glass" d="M${W - 92} 34 Q${W - 70} 50 ${W - 92} 66 L${W - 104} 66 Q${W - 84} 50 ${W - 104} 34 Z"/>`;
    g += `<rect class="cabin" x="22" y="40" width="30" height="20" rx="4"/>`;
    return g;
  },
};

function shipSVG(len, vertical, name) {
  const W = len * 100;
  const type = SHIP_TYPE[name] || (len >= 5 ? "carrier" : len === 4 ? "container" : len === 2 ? "speedboat" : "freighter");
  const body = SHIP_ART[type](W);
  return vertical
    ? `<svg viewBox="0 0 100 ${W}" preserveAspectRatio="none"><g transform="translate(100 0) rotate(90)">${body}</g></svg>`
    : `<svg viewBox="0 0 ${W} 100" preserveAspectRatio="none">${body}</svg>`;
}

function isVertical(cells) {
  const sorted = [...cells].sort((a, b) => a - b);
  return sorted.length > 1 && sorted[1] - sorted[0] === state.boardDim;
}

// kind: "" normal, "sunk", or "ghost" (ships you never found, shown at the end)
function drawShip(wrapId, cells, kind, name) {
  const layer = document.querySelector(`#${wrapId} .ship-layer`);
  if (!layer) return;
  const dim = state.boardDim;
  const sorted = [...cells].sort((a, b) => a - b);
  const key = sorted.join("-");
  const old = layer.querySelector(`[data-k="${key}"]`);
  if (old) old.remove();

  const v = isVertical(sorted);
  const r = Math.floor(sorted[0] / dim), c = sorted[0] % dim;
  const el = document.createElement("div");
  el.className = "boat" + (kind ? " " + kind : "");
  el.dataset.k = key;
  el.style.left = `calc(var(--cell) * ${c})`;
  el.style.top = `calc(var(--cell) * ${r})`;
  el.style.width = `calc(var(--cell) * ${v ? 1 : sorted.length})`;
  el.style.height = `calc(var(--cell) * ${v ? sorted.length : 1})`;
  el.innerHTML = shipSVG(sorted.length, v, name);
  el.dataset.name = name || "";
  layer.appendChild(el);
}

function clearShips(wrapId) {
  const layer = document.querySelector(`#${wrapId} .ship-layer`);
  if (layer) layer.innerHTML = "";
}

// short explosion burst on a square
function boom(wrapId, index) {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cell = cellAt(wrapId, index);
  if (!cell) return;
  const b = document.createElement("div");
  b.className = "boom";
  for (let i = 0; i < 8; i++) {
    const p = document.createElement("i");
    p.style.setProperty("--a", (i * 45 + Math.random() * 20) + "deg");
    b.appendChild(p);
  }
  cell.appendChild(b);
  setTimeout(() => b.remove(), 700);
}

// a hit on a ship keeps burning until the ship sinks, then it just smokes
function setBurning(wrapId, index) {
  const cell = cellAt(wrapId, index);
  if (!cell || cell.querySelector(".fire")) return;
  const f = document.createElement("span");
  f.className = "fire";
  f.style.animationDelay = (Math.random() * -0.6).toFixed(2) + "s";
  cell.appendChild(f);
}

function setWreck(wrapId, cells) {
  cells.forEach((c) => {
    const cell = cellAt(wrapId, c);
    if (cell) cell.classList.add("wreck");
  });
}

// aiming help on the rival board: light up the row and column labels
function hookAim(wrapId, readoutId) {
  const wrap = $(wrapId);
  const dim = state.boardDim;
  wrap.onmouseover = (e) => {
    const cell = e.target.closest(".cell");
    wrap.querySelectorAll(".lab.on").forEach((l) => l.classList.remove("on"));
    if (!cell || !cell.classList.contains("can-fire")) { if (readoutId) $(readoutId).textContent = ""; return; }
    const i = Number(cell.dataset.i);
    wrap.querySelector(`.lab.col[data-c="${i % dim}"]`)?.classList.add("on");
    wrap.querySelector(`.lab.row[data-r="${Math.floor(i / dim)}"]`)?.classList.add("on");
    if (readoutId) $(readoutId).textContent = "Target " + coord(i);
  };
  wrap.onmouseleave = () => {
    wrap.querySelectorAll(".lab.on").forEach((l) => l.classList.remove("on"));
    if (readoutId) $(readoutId).textContent = "";
  };
}

// Things borrowed from real nautical charts: a border scale with alternating
// segments (one per square), and small depth soundings on the water. The
// soundings are seeded so they don't move around between redraws.
function chartFurniture(grid, dim) {
  ["top", "bottom", "left", "right"].forEach((side) => {
    const bar = document.createElement("div");
    bar.className = "scale scale-" + side;
    const along = `calc(var(--cell) * ${dim})`;
    if (side === "top" || side === "bottom") bar.style.width = along;
    else bar.style.height = along;
    if (side === "bottom") bar.style.top = `calc(22px + var(--cell) * ${dim})`;
    if (side === "right") bar.style.left = `calc(22px + var(--cell) * ${dim})`;
    grid.appendChild(bar);
  });

  const sound = document.createElement("div");
  sound.className = "soundings";
  sound.style.width = sound.style.height = `calc(var(--cell) * ${dim})`;
  let seed = dim * 7919;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const count = Math.round(dim * dim * 0.16);
  let html = "";
  for (let k = 0; k < count; k++) {
    const x = (rnd() * 92 + 2).toFixed(1), y = (rnd() * 92 + 3).toFixed(1);
    const depth = Math.round(8 + rnd() * 40);
    html += `<span style="left:${x}%;top:${y}%">${depth}</span>`;
  }
  sound.innerHTML = html;
  grid.appendChild(sound);
}
