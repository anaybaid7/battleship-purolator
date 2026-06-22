
// ── Placement tips shown while waiting for opponent ───────────
const PLACEMENT_TIPS = [
  "<strong>Tip:</strong> Put your smallest ship in a corner. Opponents often ignore edges.",
  "<strong>Tip:</strong> Avoid clustering vehicles. Spread them across the board.",
  "<strong>Tip:</strong> The Air Freighter is the biggest target. Break up its axis.",
  "<strong>Tip:</strong> Accuracy matters more than speed. Think before you fire.",
  "<strong>Tip:</strong> Scooters are easy to miss. Hide yours along a board edge.",
];

let _tipTimer = null;
function startTipRotator() {
  const el = document.getElementById("wait-tip");
  if (!el) return;
  let i = 0;
  el.innerHTML = PLACEMENT_TIPS[0];
  clearInterval(_tipTimer);
  _tipTimer = setInterval(() => {
    el.style.opacity = "0";
    setTimeout(() => {
      i = (i + 1) % PLACEMENT_TIPS.length;
      el.innerHTML = PLACEMENT_TIPS[i];
      el.style.opacity = "1";
    }, 420);
  }, 5000);
}
function stopTipRotator() {
  clearInterval(_tipTimer);
  const el = document.getElementById("wait-tip");
  if (el) el.innerHTML = "";
}

// ── App init ──────────────────────────────────────────────────
// Loaded last. Sets the initial nav highlight; everything else is
// wired up by the other modules as soon as they load.

setNav(0);
