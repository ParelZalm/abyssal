#!/usr/bin/env node
/**
 * Import a sheet of a player body's marks — what its mutations add to it, one part to a cell
 * (`docs/sprite-prompts-player.md`, *The larva's mutations*).
 *
 *   node scripts/import-marks.mjs <sheet.png> --body larva --cols 4 --rows 5
 *        --names tapetum:mid,foureye:bottom,…  [--flip barbels] [--recolour name:from>to,…] [--key green] [--pitch 8]
 *        [--fit] [--out src/render/creature/sprites]
 *
 * Unlike the body's own parts (`import-parts.mjs`) there is no whole animal to find these on:
 * each sits alone in its cell, and the game puts it on the body by its anchor, the point it
 * joins the body by. The anchor is not drawn; it is read off the part's shape, by the rule
 * after each name's colon:
 *
 *   mid         the middle of what is drawn (an eye, a sac)
 *   top/bottom  the middle of the top or bottom row: a flat edge it hangs or stands from
 *   left/right  the middle of the leftmost or rightmost column: a jaw's hinge, a tail's root
 *   topleft     the first run of the top row: the barbels' root
 *   bottomleft  the first run of the bottom row: a lure's stalk
 *
 * A lure also gets its `tip`, the middle of its bulb's bright cyan, so the game can hang the bulb
 * where the lure's trap fires. `--flip` mirrors a part left to right before its anchor is read:
 * the barbels came back trailing forward, and they trail back.
 *
 * `--recolour name:from>to,from>to` swaps a part's colours, hex without the `#`, after it is cut:
 * the flank's cracks came back pale, the painter's colour for a dark body, and vanished on the
 * pale larva, so they were darkened here rather than drawn again.
 *
 * A pitch need not be whole, and `--fit` finds each cell's grid on its own: the Moray's head
 * sheet came back at about 6.75 image pixels to the art pixel, drifting by a pixel or two from
 * cell to cell, so one grid laid over the whole sheet cut its blocks in two at one end or the
 * other. A cell's offset is where the most colour edges fall on its grid lines.
 *
 * Writes `<body>-<name>.png` at one pixel per art pixel and prints `marks` for the body's entry
 * in `content/sprites.ts`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodePng, encodePng } from './png.mjs';

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const sheet = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const body = opt('body');
const cols = Number(opt('cols')), rows = Number(opt('rows'));
const names = (opt('names') ?? '').split(',').filter(Boolean).map(n => n.split(':'));
if (!sheet || !body || !cols || !rows || names.length === 0) {
  console.error('usage: node scripts/import-marks.mjs <sheet.png> --body <id> --cols n --rows n --names name:anchor,… [--flip a,b] [--key green] [--pitch 8] [--out dir]');
  process.exit(1);
}
const flip = new Set((opt('flip') ?? '').split(',').filter(Boolean));
const hex = h => [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
const recolour = new Map((opt('recolour') ?? '').split(';').filter(Boolean).map(r => {
  const [name, swaps] = r.split(':');
  return [name, swaps.split(',').map(s => s.split('>').map(hex))];
}));
const out = opt('out', 'src/render/creature/sprites');
const P = Number(opt('pitch', 8));
const green = opt('key', 'green') === 'green';

const { w: W, h: H, px: D } = decodePng(readFileSync(sheet));
const fit = argv.includes('--fit');
const cellW = Math.floor(W / cols / P), cellH = Math.floor(H / rows / P);
const cw = cellW * cols, ch = cellH * rows;
const lum = c => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
const isBg = c => green
  ? c[1] > 170 && c[1] - Math.max(c[0], c[2]) > 100
  : c[0] > 170 && c[2] > 170 && c[0] - c[1] > 100;
const bled = c => green ? c[1] > c[0] + 6 && c[1] > c[2] - 4 && lum(c) < 200 : c[0] > c[1] + 30 && c[2] > c[1] + 30;
const median = a => a.sort((x, y) => x - y)[a.length >> 1];
const step = (a, b) => Math.abs(D[a] - D[b]) + Math.abs(D[a + 1] - D[b + 1]) + Math.abs(D[a + 2] - D[b + 2]) > 60;
// the offset along one axis that puts the most of a cell's colour edges on its grid lines
const offset = (from, to, edgeAt) => {
  const e = [];
  for (let v = from + 1; v < to; v++) e.push([v, edgeAt(v)]);
  let best = 0, score = -1;
  for (let o = 0; o < P; o += 0.1) {
    let s = 0;
    for (const [v, n] of e) { const f = ((v - from - o) / P) % 1; if (Math.min(f, 1 - f) * P < 0.5) s += n; }
    if (s > score) { score = s; best = o; }
  }
  return best;
};
// each art pixel its median colour over its middle, as `import-parts.mjs` reads a sheet, cell by
// cell: a pitch that is not whole has each block's bounds rounded rather than the pitch
const art = new Array(cw * ch).fill(null);
for (let cj = 0; cj < rows; cj++) for (let ci = 0; ci < cols; ci++) {
  const X0 = Math.round(ci * W / cols), X1 = Math.round((ci + 1) * W / cols);
  const Y0 = Math.round(cj * H / rows), Y1 = Math.round((cj + 1) * H / rows);
  let ox = 0, oy = 0;
  if (fit) {
    ox = offset(X0, X1, x => { let n = 0; for (let y = Y0; y < Y1; y++) n += step((y * W + x) * 4, (y * W + x - 1) * 4); return n; });
    oy = offset(Y0, Y1, y => { let n = 0; for (let x = X0; x < X1; x++) n += step((y * W + x) * 4, ((y - 1) * W + x) * 4); return n; });
    // a grid shifted right or down by most of a block loses a block at that end: start one earlier
    if (ox > P / 2) ox -= P;
    if (oy > P / 2) oy -= P;
  }
  for (let j = 0; j < cellH; j++) for (let i = 0; i < cellW; i++) {
    const r = [], g = [], b = [], m = P >= 3 ? 1 : 0;
    const y0 = Math.max(0, Math.round(Y0 + oy + j * P) + m), y1 = Math.min(H, Math.round(Y0 + oy + (j + 1) * P) - m);
    const x0 = Math.max(0, Math.round(X0 + ox + i * P) + m), x1 = Math.min(W, Math.round(X0 + ox + (i + 1) * P) - m);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const o = (y * W + x) * 4;
      r.push(D[o]); g.push(D[o + 1]); b.push(D[o + 2]);
    }
    if (!r.length) continue;
    const c = [median(r), median(g), median(b)];
    art[(cj * cellH + j) * cw + ci * cellW + i] = isBg(c) ? null : c;
  }
}
// as drawn, before the fringe is cleaned: a recolour names the sheet's own colours, and a
// greenish grey (the cracks' #b8c0b8) reads as green bled into the outline and is swapped out
const raw = art.slice();
const clean = art.filter(c => c && !bled(c));
for (let k = 0; k < art.length; k++) {
  const c = art[k];
  if (c && bled(c)) art[k] = clean.reduce((a, z) => Math.abs(lum(z) - lum(c)) < Math.abs(lum(a) - lum(c)) ? z : a);
}

const cyan = c => c[2] > 200 && c[1] > 170 && c[0] < 200;
const lines = [];
names.forEach(([name, rule], n) => {
  const ci = n % cols, cj = Math.floor(n / cols);
  if (cj >= rows) throw new Error(`${name}: past the grid's ${cols * rows} cells`);
  // the cell, cropped to what is drawn in it
  let x0 = cellW, y0 = cellH, x1 = -1, y1 = -1;
  const at = (x, y) => art[(cj * cellH + y) * cw + ci * cellW + x];
  const drawn = (x, y) => raw[(cj * cellH + y) * cw + ci * cellW + x];
  for (let y = 0; y < cellH; y++) for (let x = 0; x < cellW; x++) {
    if (!at(x, y)) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  if (x1 < 0) throw new Error(`${name}: its cell is empty`);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const img = [];
  const orig = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = flip.has(name) ? x1 - x : x0 + x;
    img.push(at(sx, y0 + y));
    orig.push(drawn(sx, y0 + y));
  }
  const px = (x, y) => img[y * w + x];
  // the middle of the first run of filled pixels along a row or a column
  const run = (cells) => {
    const i0 = cells.findIndex(Boolean);
    let i1 = i0;
    while (i1 + 1 < cells.length && cells[i1 + 1]) i1++;
    return (i0 + i1 + 1) / 2;
  };
  const row = y => Array.from({ length: w }, (_, x) => px(x, y));
  const col = x => Array.from({ length: h }, (_, y) => px(x, y));
  const middle = (cells) => {
    const on = cells.map((c, i) => c ? i : -1).filter(i => i >= 0);
    return (on[0] + on[on.length - 1] + 1) / 2;
  };
  const anchor = {
    mid: () => [w / 2, h / 2],
    top: () => [middle(row(0)), 0],
    bottom: () => [middle(row(h - 1)), h],
    left: () => [0, middle(col(0))],
    right: () => [w, middle(col(w - 1))],
    topleft: () => [run(row(0)), 0],
    bottomleft: () => [run(row(h - 1)), h],
  }[rule];
  if (!anchor) throw new Error(`${name}: no anchor rule "${rule}"`);
  const a = anchor().map(v => +v.toFixed(1));
  let tip = '';
  const lit = img.map((c, i) => c && cyan(c) ? i : -1).filter(i => i >= 0);
  if (rule === 'bottomleft' && lit.length) {
    const tx = lit.reduce((s, i) => s + i % w, 0) / lit.length + 0.5, ty = lit.reduce((s, i) => s + Math.floor(i / w), 0) / lit.length + 0.5;
    tip = `, tip: [${tx.toFixed(1)}, ${ty.toFixed(1)}]`;
  }
  const buf = new Uint8Array(w * h * 4);
  const swaps = recolour.get(name) ?? [];
  const same = (a, b) => a.every((v, k) => Math.abs(v - b[k]) <= 2);
  img.forEach((c, i) => {
    if (!c) return;
    buf.set(swaps.find(([from]) => same(orig[i], from))?.[1] ?? c, i * 4);
    buf[i * 4 + 3] = 255;
  });
  writeFileSync(join(out, `${body}-${name}.png`), encodePng(w, h, buf));
  lines.push(`'${name}': { at: [${a.join(', ')}]${tip} }`);
  console.log(`${name.padEnd(12)} ${String(w).padStart(2)}×${String(h).padEnd(2)} ${rule.padEnd(10)} at ${a.join(', ')}${tip}`);
});
console.log(`\npitch ${P} · grid ${cw}×${ch} · ${cols}×${rows} cells of ${cellW}×${cellH}\n\ncontent/sprites.ts, on ${body}.marks:\n  ${lines.join(',\n  ')},`);
