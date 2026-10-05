#!/usr/bin/env node
/**
 * Import a player body's parts sheet — the larva's eye, tail, fin folds and pectoral, drawn
 * apart (`docs/sprite-prompts-player.md`, *Sheet 2*).
 *
 *   node scripts/import-parts.mjs <sheet.png> --body larva --snout 90 --tail 4 --axis 17
 *                                 [--key green] [--pitch 8] [--out src/render/creature/sprites]
 *
 * The sheet is the whole animal once, assembled, and each part apart from it at its size on
 * the whole. A generator does not hold a part's position from one image to the next, so where a
 * part sits is not asked for: each is found on the whole by its shape — the offset at which the
 * most of its pixels agree with the whole's — and the whole is laid on the bare body (`--body`,
 * imported with `npm run sprite`) by the body's landmarks: the tail's joint to its `--tail`,
 * the whole's snout to its `--snout`, the tail's middle to its `--axis`.
 *
 * Which part is which is read off where it lands: the eye is the one with the pupil's black in
 * it, the tail the one furthest back, the pectoral the smallest of the rest, and the two folds
 * the back's above the belly's. Check what it prints against the sheet.
 *
 * Writes `<body>-<part>.png` at one pixel per art pixel, a preview of the parts laid on the
 * whole at six times into the system's temp folder, and prints `parts` for the body's entry in
 * `content/sprites.ts`: each part's top-left in the body's pixels, and how many of them one of a
 * part's pixels is.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodePng, encodePng } from './png.mjs';

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const sheet = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const body = opt('body');
const land = { snout: Number(opt('snout')), tail: Number(opt('tail')), axis: Number(opt('axis')) };
if (!sheet || !body || Object.values(land).some(Number.isNaN)) {
  console.error('usage: node scripts/import-parts.mjs <sheet.png> --body <id> --snout n --tail n --axis n [--key green] [--pitch 8] [--out dir]');
  process.exit(1);
}
const out = opt('out', 'src/render/creature/sprites');
const P = Number(opt('pitch', 8));
const green = opt('key', 'green') === 'green';

// ------------------------------------------------------------------ the grid

// The parts sheet came back on a clean grid at the pitch asked for, unlike the frames sheets
// `import-sprite.mjs` has to find a drifting grid on; `--pitch` is there for one that does not.
const { w: W, h: H, px: D } = decodePng(readFileSync(sheet));
const cw = Math.floor(W / P), ch = Math.floor(H / P);
const lum = c => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
const isBg = c => green
  ? c[1] > 170 && c[1] - Math.max(c[0], c[2]) > 100
  : c[0] > 170 && c[2] > 170 && c[0] - c[1] > 100;
// bleed: an outline greyed toward the key, as the body sheet's was (`import-sprite.mjs`)
const bled = c => green ? c[1] > c[0] + 6 && c[1] > c[2] - 4 : c[0] > c[1] + 30 && c[2] > c[1] + 30;
const median = a => a.sort((x, y) => x - y)[a.length >> 1];
const cells = [];
for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
  // the middle of the cell, a pixel in from each edge, so the seam's blur does not count; a
  // sheet at one image pixel to the art pixel, as the redrawn larva's came, has no seam
  const r = [], g = [], b = [], m = P >= 3 ? 1 : 0;
  for (let y = j * P + m; y < (j + 1) * P - m; y++) for (let x = i * P + m; x < (i + 1) * P - m; x++) {
    const o = (y * W + x) * 4;
    r.push(D[o]); g.push(D[o + 1]); b.push(D[o + 2]);
  }
  const c = [median(r), median(g), median(b)];
  cells.push(isBg(c) ? null : c);
}
const at = (i, j) => i < 0 || j < 0 || i >= cw || j >= ch ? null : cells[j * cw + i];
// a bled cell takes the clean colour nearest its brightness
const clean = cells.filter(c => c && !bled(c));
let bleeds = 0;
for (let k = 0; k < cells.length; k++) {
  const c = cells[k];
  if (!c || !bled(c)) continue;
  cells[k] = clean.reduce((a, z) => Math.abs(lum(z) - lum(c)) < Math.abs(lum(a) - lum(c)) ? z : a);
  bleeds++;
}

// ------------------------------------------------------------------ the pieces

/** Connected runs of art pixels, four ways round: the whole and each part. */
const seen = new Uint8Array(cw * ch);
const blobs = [];
for (let k = 0; k < cells.length; k++) {
  if (!cells[k] || seen[k]) continue;
  const px = [];
  const stack = [k];
  seen[k] = 1;
  while (stack.length) {
    const q = stack.pop();
    px.push(q);
    const i = q % cw, j = (q - i) / cw;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = (j + dj) * cw + i + di;
      if (at(i + di, j + dj) && !seen[n]) { seen[n] = 1; stack.push(n); }
    }
  }
  // a speck of bleed is not a part
  if (px.length < 12) continue;
  let x0 = cw, y0 = ch, x1 = 0, y1 = 0;
  for (const q of px) { const i = q % cw, j = (q - i) / cw; x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const img = new Array(w * h).fill(null);
  for (const q of px) { const i = q % cw, j = (q - i) / cw; img[(j - y0) * w + i - x0] = cells[q]; }
  blobs.push({ x0, y0, w, h, img, n: px.length });
}
blobs.sort((a, b) => b.n - a.n);
const [whole, ...pieces] = blobs;
if (pieces.length < 1) throw new Error(`found ${blobs.length} pieces; the whole and its parts should be apart`);

const near = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 60;
/**
 * Where a part sits on the whole: the offset at which the most of its pixels land on a pixel of
 * the same colour, less those that land on water. Every offset that keeps it touching the
 * whole is tried; the parts are small, and this runs once per sheet.
 */
function place(p) {
  let best = { dx: 0, dy: 0, score: -Infinity };
  for (let dy = -p.h; dy < whole.h; dy++) for (let dx = -p.w; dx < whole.w; dx++) {
    let score = 0;
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      const c = p.img[y * p.w + x];
      if (!c) continue;
      const wx = x + dx, wy = y + dy;
      const o = wx < 0 || wy < 0 || wx >= whole.w || wy >= whole.h ? null : whole.img[wy * whole.w + wx];
      score += !o ? -1 : near(c, o) ? 1 : 0;
    }
    if (score > best.score) best = { dx, dy, score };
  }
  return best;
}
const placed = pieces.map(p => ({ ...p, ...place(p) }));

// ------------------------------------------------------------------ which part is which

const dark = p => p.img.filter(c => c && lum(c) < 40).length / p.n;
const named = new Map();
const left = [...placed];
const take = (name, pick) => {
  const p = pick(left);
  if (!p) return;
  left.splice(left.indexOf(p), 1);
  named.set(name, p);
};
take('eye', l => l.reduce((a, p) => dark(p) > dark(a) ? p : a));
take('tail', l => l.reduce((a, p) => p.dx < a.dx ? p : a));
take('pectoral', l => l.reduce((a, p) => p.n < a.n ? p : a));
take('back', l => l.reduce((a, p) => p.dy < a.dy ? p : a));
take('belly', l => l[0]);
if (left.length) console.warn(`${left.length} piece(s) left over, not written`);

// ------------------------------------------------------------------ onto the body

// The tail's joint is its front edge on the whole, and its middle row the axis; the whole's
// snout is the furthest column forward on that row, give or take the mouth's notch.
const tail = named.get('tail');
if (!tail) throw new Error('no tail found: the whole cannot be laid on the body without its joint');
const joint = tail.dx + tail.w - 1;
const axisW = tail.dy + (tail.h - 1) / 2;
let snoutW = joint;
for (let y = Math.floor(axisW) - 3; y <= Math.ceil(axisW) + 3; y++) {
  for (let x = whole.w - 1; x > snoutW; x--) if (whole.img[y * whole.w + x]) { snoutW = x; break; }
}
const k = (land.snout - land.tail) / (snoutW - joint);
const toBody = (x, y) => [+(land.tail + (x - joint) * k).toFixed(1), +(land.axis + (y - axisW) * k).toFixed(1)];

const fileOf = name => `${body}-${name}.png`;
const lines = [];
for (const [name, p] of named) {
  const px = new Uint8Array(p.w * p.h * 4);
  p.img.forEach((c, i) => { if (c) { px.set(c, i * 4); px[i * 4 + 3] = 255; } });
  writeFileSync(join(out, fileOf(name)), encodePng(p.w, p.h, px));
  lines.push(`${name}: [${toBody(p.dx, p.dy).join(', ')}]`);
  console.log(`${name.padEnd(9)} ${p.w}×${p.h} at ${p.dx},${p.dy} on the whole (${Math.round(p.score / p.n * 100)}% agree)`);
}

// the parts laid on the whole, each in a colour of its own, beside the whole as drawn
const S = 6, pw = whole.w * 2 + 4, ph = whole.h;
const prev = new Uint8Array(pw * S * ph * S * 4);
const put = (x, y, c) => {
  for (let v = 0; v < S; v++) for (let u = 0; u < S; u++) {
    const o = ((y * S + v) * pw * S + x * S + u) * 4;
    prev[o] = c[0]; prev[o + 1] = c[1]; prev[o + 2] = c[2]; prev[o + 3] = 255;
  }
};
for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) put(x, y, [7, 23, 49]);
whole.img.forEach((c, i) => { if (c) put(i % whole.w, Math.floor(i / whole.w), c); });
const tint = { eye: [255, 80, 80], tail: [80, 200, 255], pectoral: [255, 220, 60], back: [120, 255, 120], belly: [220, 120, 255] };
whole.img.forEach((c, i) => { if (c) put(whole.w + 4 + i % whole.w, Math.floor(i / whole.w), c.map(v => v * 0.35)); });
for (const [name, p] of named) {
  p.img.forEach((c, i) => {
    const x = p.dx + i % p.w, y = p.dy + Math.floor(i / p.w);
    if (c && x >= 0 && y >= 0 && x < whole.w && y < whole.h) put(whole.w + 4 + x, y, c.map((v, j) => v * 0.5 + tint[name][j] * 0.5));
  });
}
const previewPath = join(tmpdir(), `${body}-parts-preview.png`);
writeFileSync(previewPath, encodePng(pw * S, ph * S, prev));

console.log(`\npitch ${P} · grid ${cw}×${ch} · whole ${whole.w}×${whole.h} · ${named.size} parts${bleeds ? ` · ${bleeds} bled cells cleaned` : ''}`);
console.log(`whole: joint ${joint}, snout ${snoutW}, axis ${axisW}; ${k.toFixed(3)} body pixels to its pixel`);
console.log(`wrote ${[...named.keys()].map(n => join(out, fileOf(n))).join(', ')}`);
console.log(`preview ${previewPath}`);
console.log(`\ncontent/sprites.ts, on ${body}:\n  parts: { scale: ${k.toFixed(3)}, at: { ${lines.join(', ')} } },`);
