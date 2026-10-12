// Little game that plays itself in the lobby so people can see what they're
// getting into. Uses the same ship drawings, pegs and fire as the real board.
// The "attacker" shoots at random until it hits, then works the squares next
// to the hit like a person would.

const DEMO_DIM = 10;
const DEMO_SHIPS = [
  { name: "Air Freighter", size: 5 },
  { name: "Semi Truck", size: 4 },
  { name: "Delivery Van", size: 3 },
  { name: "Cargo Bike", size: 3 },
  { name: "Scooter", size: 2 },
];

let demo = null;

function demoPlace() {
  const board = Array(DEMO_DIM * DEMO_DIM).fill(null);
  const ships = [];
  for (const s of DEMO_SHIPS) {
    for (let t = 0; t < 500; t++) {
      const v = Math.random() < 0.5;
      const start = Math.floor(Math.random() * DEMO_DIM * DEMO_DIM);
      const r = Math.floor(start / DEMO_DIM), c = start % DEMO_DIM;
      if ((v ? r : c) + s.size > DEMO_DIM) continue;
      const cells = Array.from({ length: s.size }, (_, k) => (v ? start + k * DEMO_DIM : start + k));
      if (cells.some((x) => board[x])) continue;
      cells.forEach((x) => { board[x] = s.name; });
      ships.push({ name: s.name, cells });
      break;
    }
  }
  return { board, ships };
}

function demoBuild() {
  const wrap = $("hero-demo");
  if (!wrap) return null;
  const cell = window.innerWidth < 900 ? 20 : 24;
  wrap.innerHTML = "";
  wrap.style.setProperty("--cell", cell + "px");

  const frame = document.createElement("div");
  frame.className = "board-frame demo-frame";
  const box = document.createElement("div");
  box.className = "demo-board";
  box.style.width = box.style.height = cell * DEMO_DIM + "px";

  const water = document.createElement("div");
  water.className = "water";
  water.style.cssText = `left:0;top:0;width:${cell * DEMO_DIM}px;height:${cell * DEMO_DIM}px`;
  box.appendChild(water);

  const cells = document.createElement("div");
  cells.className = "demo-cells";
  for (let i = 0; i < DEMO_DIM * DEMO_DIM; i++) {
    const d = document.createElement("div");
    d.className = "cell";
    d.dataset.i = i;
    cells.appendChild(d);
  }
  box.appendChild(cells);

  const layer = document.createElement("div");
  layer.className = "ship-layer";
  layer.style.cssText = `left:0;top:0;width:${cell * DEMO_DIM}px;height:${cell * DEMO_DIM}px`;
  box.appendChild(layer);

  frame.appendChild(box);
  wrap.appendChild(frame);

  const { board, ships } = demoPlace();
  ships.forEach((s) => drawShip("hero-demo", s.cells, "", s.name));
  return { board, ships, shot: new Set(), targets: [], timer: null };
}

function demoNeighbours(i) {
  const r = Math.floor(i / DEMO_DIM), c = i % DEMO_DIM, out = [];
  if (r > 0) out.push(i - DEMO_DIM);
  if (r < DEMO_DIM - 1) out.push(i + DEMO_DIM);
  if (c > 0) out.push(i - 1);
  if (c < DEMO_DIM - 1) out.push(i + 1);
  return out;
}

function demoFire() {
  const d = demo;
  let i;
  while (d.targets.length) {
    const t = d.targets.shift();
    if (!d.shot.has(t)) { i = t; break; }
  }
  if (i === undefined) {
    do { i = Math.floor(Math.random() * DEMO_DIM * DEMO_DIM); } while (d.shot.has(i));
  }
  d.shot.add(i);
  const el = cellAt("hero-demo", i);
  const name = d.board[i];
  el.classList.add(name ? "hit" : "miss", "just");
  setTimeout(() => el.classList.remove("just"), 600);

  if (name) {
    boom("hero-demo", i);
    setBurning("hero-demo", i);
    d.targets.push(...demoNeighbours(i).filter((n) => !d.shot.has(n)));
    const ship = d.ships.find((s) => s.name === name);
    if (ship.cells.every((c) => d.shot.has(c))) {
      drawShip("hero-demo", ship.cells, "sunk", ship.name);
      setWreck("hero-demo", ship.cells);
      d.targets = [];
    }
  }

  const done = d.ships.every((s) => s.cells.every((c) => d.shot.has(c)));
  if (done || d.shot.size >= 70) {
    clearInterval(d.timer);
    setTimeout(startDemo, 2500);
  }
}

function startDemo() {
  stopDemo();
  if (!$("lobby").classList.contains("active")) return;
  demo = demoBuild();
  if (!demo) return;
  if (reducedMotion()) {
    for (let k = 0; k < 18; k++) demoFire();
    return;
  }
  demo.timer = setInterval(demoFire, 750);
}

function stopDemo() {
  if (demo && demo.timer) clearInterval(demo.timer);
}

function reducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
