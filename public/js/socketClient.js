// the one socket everything uses

const socket = io({
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
  transports: ["websocket", "polling"],
});

socket.on("connect", () => {
  state.sid = socket.id;
  $("offline").classList.remove("show");
});

socket.on("disconnect", () => {
  if (!$("lobby").classList.contains("active")) $("offline").classList.add("show");
});

socket.on("room_closed", () => {
  if (!$("gameover").classList.contains("show")) $("left").classList.add("show");
});

// someone hit the reset button, so whatever we were doing is gone
socket.on("server_reset", () => {
  location.reload();
});

// relative time helper, "3 min ago", "yesterday", etc.
function relTime(ts) {
  if (!ts) return null;
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + " min ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  if (diff < 172800) return "yesterday";
  return Math.floor(diff / 86400) + " days ago";
}

// Driver Rankings. Rows are aggregated server-side by player name, so a
// player who plays multiple matches under the same callsign shows up once.
// Shown in the lobby and under the boards.
socket.on("leaderboard_update", (all) => {
  // only people who have actually finished a game
  const rows = all.filter((r) => r.wins + r.losses > 0);
  let html;
  if (!rows.length) {
    html = '<p class="empty-line">No one ranked yet. Finish a game to get on here.</p>';
  } else {
    html = rows.map((r, i) => {
      const acc = r.shots > 0 ? Math.round((r.hits / r.shots) * 100) : 0;
      const rankClass = i === 0 ? "g" : i === 1 ? "s" : i === 2 ? "b" : "";
      const lastSeen = r.lastSeen ? relTime(r.lastSeen) : null;
      const sub = `${acc}% hit rate, ${r.losses} lost` + (lastSeen ? `, ${lastSeen}` : "");
      return `<div class="lb-row"><div class="lb-rank ${rankClass}">${i + 1}</div><div class="lb-info"><div class="lb-name">${esc(r.name)}</div><div class="lb-sub">${sub}</div></div><div><div class="lb-wins">${r.wins}</div><div class="lb-wlabel">wins</div></div></div>`;
    }).join("");
  }
  document.querySelectorAll(".standings").forEach((el) => { el.innerHTML = html; });
});

// numbers and recent results on the lobby
function mmss(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function ago(ms) {
  const sec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (sec < 60) return "just now";
  const m = Math.floor(sec / 60);
  return m === 1 ? "1 min" : `${m} min`;
}

socket.on("lobby_stats", (d) => {
  const n = (k, one, many) => `<b>${k}</b> ${k === 1 ? one : many}`;
  $("live-line").innerHTML =
    `Right now: ${n(d.online, "person", "people")} on the site, ${n(d.playing, "game", "games")} in progress` +
    (d.waiting ? `, ${n(d.waiting, "room", "rooms")} waiting for a second player` : "") +
    `. ${n(d.finished, "game", "games")} finished since the server last started.`;

  // rooms anyone can walk into, oldest first
  const open = d.open.filter((r) => r.code !== state.roomId);
  $("open-rooms").innerHTML = open.length
    ? open.map((r) =>
        `<div class="open-row"><div class="open-main"><strong>${esc(r.host)}</strong> is waiting` +
        `<span class="open-sub">room ${r.code}, ${ago(r.since)}</span></div>` +
        `<button class="btn btn-navy btn-small" onclick="joinRoom('${r.code}')">Join</button></div>`
      ).join("")
    : '<p class="empty-line">Nobody\'s waiting right now. Create a room and send the code.</p>';

  // records across every game since the last restart
  const r = d.records || {};
  const rec = [];
  if (r.fewestShots) rec.push(["Fewest shots to win", r.fewestShots.winner, `${r.fewestShots.shots} shots against ${esc(r.fewestShots.loser)}`]);
  if (r.fastest) rec.push(["Fastest win", r.fastest.winner, `${mmss(r.fastest.duration)} against ${esc(r.fastest.loser)}`]);
  if (r.bestAim) rec.push(["Best aim in a win", r.bestAim.winner, `${r.bestAim.accuracy}% hit rate against ${esc(r.bestAim.loser)}`]);
  $("records").innerHTML = rec.map(([label, who, what]) =>
    `<div class="record"><span class="rec-label">${label}</span><span class="rec-who">${esc(who)}</span><span class="rec-what">${what}</span></div>`
  ).join("");

  const el = $("recent");
  if (!d.recent.length) {
    el.innerHTML = '<p class="empty-line">No games finished yet.</p>';
    return;
  }
  el.innerHTML = d.recent.map((g) =>
    `<div class="recent-row"><div class="recent-main"><strong>${esc(g.winner)}</strong> beat <strong>${esc(g.loser)}</strong></div>` +
    `<div class="recent-sub">${g.shots} shots, ${g.accuracy}% hit rate, ${mmss(g.duration)}, ${relTime(g.at)}</div></div>`
  ).join("");
});
