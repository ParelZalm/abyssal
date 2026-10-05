#!/usr/bin/env node
/**
 * Import a sheet of a player body's marks — what its mutations add to it, one part to a cell
 * (`docs/sprite-prompts-player.md`, *The larva's mutations*).
 *
 *   node scripts/import-marks.mjs <sheet.png> --body larva --cols 4 --rows 5
 *        --names tapetum:mid,foureye:bottom,…  [--flip barbels] [--key green] [--pitch 8]
 *        [--out src/render/creature/sprites]
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
const out = opt('out', 'src/render/creature/sprites');
const P = Number(opt('pitch', 8));
const green = opt('key', 'green') === 'green';

const { w: W, h: H, px: D } = decodePng(readFileSync(sheet));
const cw = Math.floor(W / P), ch = Math.floor(H / P);
const lum = c => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
const isBg = c => green
  ? c[1] > 170 && c[1] - Math.max(c[0], c[2]) > 100
  : c[0] > 170 && c[2] > 170 && c[0] - c[1] > 100;
const bled = c => green ? c[1] > c[0] + 6 && c[1] > c[2] - 4 && lum(c) < 200 : c[0] > c[1] + 30 && c[2] > c[1] + 30;
const median = a => a.sort((x, y) => x - y)[a.length >> 1];
// each art pixel its median colour over its middle, as `import-parts.mjs` reads a sheet
const art = [];
for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
  const r = [], g = [], b = [], m = P >= 3 ? 1 : 0;
  for (let y = j * P + m; y < (j + 1) * P - m; y++) for (let x = i * P + m; x < (i + 1) * P - m; x++) {
    const o = (y * W + x) * 4;
    r.push(D[o]); g.push(D[o + 1]); b.push(D[o + 2]);
  }
  const c = [median(r), median(g), median(b)];
  art.push(isBg(c) ? null : c);
}
const clean = art.filter(c => c && !bled(c));
for (let k = 0; k < art.length; k++) {
  const c = art[k];
  if (c && bled(c)) art[k] = clean.reduce((a, z) => Math.abs(lum(z) - lum(c)) < Math.abs(lum(a) - lum(c)) ? z : a);
}

const cellW = Math.floor(cw / cols), cellH = Math.floor(ch / rows);
const cyan = c => c[2] > 200 && c[1] > 170 && c[0] < 200;
const lines = [];
names.forEach(([name, rule], n) => {
  const ci = n % cols, cj = Math.floor(n / cols);
  if (cj >= rows) throw new Error(`${name}: past the grid's ${cols * rows} cells`);
  // the cell, cropped to what is drawn in it
  let x0 = cellW, y0 = cellH, x1 = -1, y1 = -1;
  const at = (x, y) => art[(cj * cellH + y) * cw + ci * cellW + x];
  for (let y = 0; y < cellH; y++) for (let x = 0; x < cellW; x++) {
    if (!at(x, y)) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  if (x1 < 0) throw new Error(`${name}: its cell is empty`);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const img = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) img.push(at(flip.has(name) ? x1 - x : x0 + x, y0 + y));
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
  img.forEach((c, i) => { if (c) { buf.set(c, i * 4); buf[i * 4 + 3] = 255; } });
  writeFileSync(join(out, `${body}-${name}.png`), encodePng(w, h, buf));
  lines.push(`'${name}': { at: [${a.join(', ')}]${tip} }`);
  console.log(`${name.padEnd(12)} ${String(w).padStart(2)}×${String(h).padEnd(2)} ${rule.padEnd(10)} at ${a.join(', ')}${tip}`);
});
console.log(`\npitch ${P} · grid ${cw}×${ch} · ${cols}×${rows} cells of ${cellW}×${cellH}\n\ncontent/sprites.ts, on ${body}.marks:\n  ${lines.join(',\n  ')},`);
