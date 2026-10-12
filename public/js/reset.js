// reset button (top right). render's free plan sleeps the server after ~15 min
// idle and that wipes memory anyway. this pings /status until it's awake,
// then POSTs /reset (closes all rooms, clears the leaderboard) and reloads

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function serverIsUp() {
  try {
    const res = await fetch("/status", { cache: "no-store" });
    if (!res.ok) return false;
    const data = await res.json(); // Render's "waking up" page is HTML, so this throws until the real server answers
    return typeof data.activeRooms === "number";
  } catch (e) {
    return false;
  }
}

function resetMsg(text, withClose) {
  $("reset-msg").innerHTML = esc(text) +
    (withClose ? '<div class="modal-actions"><button class="btn btn-outline" onclick="closeReset()">Close</button></div>' : "");
}

function closeReset() {
  $("resetting").classList.remove("show");
  $("reset-btn").disabled = false;
}

async function resetGame() {
  const ok = confirm("This ends every game that's going on right now and clears the standings. Go ahead?");
  if (!ok) return;

  $("reset-btn").disabled = true;
  $("resetting").classList.add("show");
  resetMsg("Checking the server...");

  const started = Date.now();
  while (!(await serverIsUp())) {
    if (Date.now() - started > 150000) {
      resetMsg("The server still isn't answering after a couple of minutes. Wait a bit and try again.", true);
      return;
    }
    resetMsg("The server was asleep. Waking it up, this usually takes about a minute...");
    await sleep(3000);
  }

  resetMsg("Clearing all games and the standings...");
  try {
    const res = await fetch("/reset", { method: "POST" });
    if (!res.ok) throw new Error(res.status);
  } catch (e) {
    resetMsg("The server is up but the reset didn't go through. Try again.", true);
    return;
  }
  location.reload();
}
