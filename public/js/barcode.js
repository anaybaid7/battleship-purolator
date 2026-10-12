// Code 39 barcode as SVG, used on the shipping label for the room code.
// It's a real Code 39 (checked against python-barcode), so a scanner reads
// the room code off the screen.
// n = narrow, w = wide, alternating bar/space, 9 elements per character
const CODE39 = {
  0: "nnnwwnwnn", 1: "wnnwnnnnw", 2: "nnwwnnnnw", 3: "wnwwnnnnn", 4: "nnnwwnnnw",
  5: "wnnwwnnnn", 6: "nnwwwnnnn", 7: "nnnwnnwnw", 8: "wnnwnnwnn", 9: "nnwwnnwnn",
  A: "wnnnnwnnw", B: "nnwnnwnnw", C: "wnwnnwnnn", D: "nnnnwwnnw", E: "wnnnwwnnn",
  F: "nnwnwwnnn", G: "nnnnnwwnw", H: "wnnnnwwnn", I: "nnwnnwwnn", J: "nnnnwwwnn",
  K: "wnnnnnnww", L: "nnwnnnnww", M: "wnwnnnnwn", N: "nnnnwnnww", O: "wnnnwnnwn",
  P: "nnwnwnnwn", Q: "nnnnnnwww", R: "wnnnnnwwn", S: "nnwnnnwwn", T: "nnnnwnwwn",
  U: "wwnnnnnnw", V: "nwwnnnnnw", W: "wwwnnnnnn", X: "nwnnwnnnw", Y: "wwnnwnnnn",
  Z: "nwwnwnnnn", "*": "nwnnwnwnn",
};

function code39svg(text, height) {
  const chars = ("*" + String(text).toUpperCase().replace(/[^0-9A-Z]/g, "") + "*").split("");
  const narrow = 2, wide = 6, gap = 2;
  let x = 10, bars = "";
  chars.forEach((ch, ci) => {
    const pat = CODE39[ch];
    for (let k = 0; k < 9; k++) {
      const w = pat[k] === "w" ? wide : narrow;
      if (k % 2 === 0) bars += `<rect x="${x}" y="0" width="${w}" height="${height}"/>`;
      x += w;
    }
    if (ci < chars.length - 1) x += gap;
  });
  x += 10;
  return `<svg class="barcode" viewBox="0 0 ${x} ${height}" preserveAspectRatio="none" role="img" aria-label="Barcode for ${text}">${bars}</svg>`;
}
