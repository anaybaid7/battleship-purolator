// lobby: create / join

function lobbyError(msg, focusId) {
  $("lobby-err").textContent = msg || "";
  if (focusId) $(focusId).focus();
}

// callsign is asked for once, and remembered for next time
function callsign() {
  const name = $("name").value.trim();
  if (!name) { lobbyError("Put your callsign in first.", "name"); return null; }
  try { localStorage.setItem("dbl-callsign", name); } catch (e) {}
  return name;
}

function createRoom() {
  const name = callsign();
  if (!name) return;
  lobbyError("");
  state.myName = name;
  state.pidx = 0;
  socket.emit("create_room", { name });
}

function joinRoom(codeFromList) {
  const name = callsign();
  if (!name) return;
  const code = (codeFromList || $("j-code").value).trim().toUpperCase();
  if (!code) { lobbyError("Type the room code your rival sent you, or pick a room from the list.", "j-code"); return; }
  if (code.length !== 5) { lobbyError(`Room codes are 5 characters. "${code}" is ${code.length}.`, "j-code"); return; }
  lobbyError("");
  state.myName = name;
  state.pidx = 1;
  state.roomId = code;
  socket.emit("join_room", { roomId: code, name });
}

const PUBLIC_SITE = "https://battleship-purolator.onrender.com";
function inviteUrl(code) {
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  return `${local ? PUBLIC_SITE : location.origin}/${code}`;
}

function copyLink() {
  const url = $("invite-url").value;
  const btn = $("copy-link-btn");
  const done = () => {
    btn.textContent = "Copied";
    setTimeout(() => { btn.textContent = "Copy link"; }, 1800);
  };
  if (navigator.clipboard) navigator.clipboard.writeText(url).then(done).catch(() => fallbackCopy(url, done));
  else fallbackCopy(url, done);
}

function copyCode() {
  const code = $("room-code").textContent;
  const btn = $("copy-btn");
  const done = () => {
    btn.textContent = "Copied";
    btn.classList.add("copied");
    setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 1800);
  };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code).then(done).catch(() => fallbackCopy(code, done));
  } else {
    fallbackCopy(code, done);
  }
}

function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
  done();
}

socket.on("room_created", ({ roomId, playerIndex, boardDim }) => {
  state.pidx = playerIndex;
  if (boardDim) state.boardDim = boardDim;
  $("room-code").textContent = roomId;
  state.roomId = roomId;
  $("sl-from").textContent = state.myName;
  $("sl-date").textContent = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
  $("sl-barcode").innerHTML = code39svg(roomId, 60);
  $("invite-url").value = inviteUrl(roomId);
  showScreen("waiting");
});

socket.on("error", (msg) => { lobbyError(msg); });

$("name").addEventListener("keydown", (e) => { if (e.key === "Enter") ($("j-code").value.trim() ? joinRoom() : createRoom()); });
$("j-code").addEventListener("keydown", (e) => { if (e.key === "Enter") joinRoom(); });
$("j-code").addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase(); });
$("invite-url").addEventListener("focus", (e) => e.target.select());

// fill in what we already know: last callsign used, and a room code if
// someone opened an invite link
(function () {
  try { $("name").value = localStorage.getItem("dbl-callsign") || ""; } catch (e) {}
  const fromPath = location.pathname.match(/^\/([A-HJ-NP-Z2-9]{5})$/i);
  const code = fromPath ? fromPath[1] : new URLSearchParams(location.search).get("room");
  if (code) {
    $("j-code").value = code.toUpperCase().slice(0, 5);
    $("invite-note").textContent = `You were invited to room ${$("j-code").value}. Check your callsign and hit Join delivery zone.`;
    history.replaceState(null, "", "/");
  }
  ($("name").value ? (code ? $("j-code") : $("create-btn")) : $("name")).focus();
})();
