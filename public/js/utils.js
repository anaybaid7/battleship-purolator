function $(id) {
  return document.getElementById(id);
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(id).classList.add("active");
  if (typeof startDemo === "function") { if (id === "lobby") startDemo(); else stopDemo(); }
  window.scrollTo(0, 0);
}

// A1, B7, etc.
function coord(index) {
  const dim = state.boardDim;
  return COLS[index % dim] + (Math.floor(index / dim) + 1);
}

function plural(n, word) {
  return n + " " + word + (n === 1 ? "" : "s");
}

// Highlight the active step (0=Lobby, 1=Fleet Setup, 2=Battle) in the header nav.
function setNav(step) {
  [0, 1, 2].forEach((i) => $("nav-" + i).classList.toggle("active", i === step));
}
