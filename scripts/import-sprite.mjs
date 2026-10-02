#!/usr/bin/env node
/**
 * Import a generated sprite sheet as an enemy's frames — the code side of `docs/sprites.md`.
 *
 *   npm run sprite -- <sheet.png> --id <species> [--pitch 6.54] [--colours 22]
 *                     [--keep x0,y0,x1,y1] [--out src/render/creature/sprites]
 *
 * The sheet is one or two frames side by side on flat #FF00FF: the rest, and optionally the
 * strike. A generator's "8× pixel art" is never on a clean grid — the anglerfish's was 6.5
 * image pixels to the art pixel, and its columns drifted by three art pixels across a frame —
 * so the grid is found, not assumed: each cell boundary is the strongest colour edge a pitch on
 * from the last, which follows a drifting grid where a fixed pitch would double or drop
 * columns. Each cell takes its median colour, and both frames are clustered to one palette.
 *
 * The strike is lined up on the rest by the back half of the body, which should not move, and
 * then only the part that differs is taken from it: a generator redraws the whole fish for a
 * second frame, and swapping the whole of it in made the body shimmer on every bite. That part
 * is the box round where the two silhouettes disagree, grown by a few cells, or `--keep`.
 *
 * Writes `<id>.png` (and `<id>-strike.png`) at one pixel per art pixel, a preview at six, and
 * prints the landmarks for `content/sprites.ts` — check them on the board before trusting them.
 * Reads PNG only (8-bit RGB or RGBA); `sips -s format png in.webp --out in.png` converts.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync, deflateSync } from 'node:zlib';

// ------------------------------------------------------------------ arguments

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const sheet = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const id = opt('id');
if (!sheet || !id) {
  console.error('usage: npm run sprite -- <sheet.png> --id <species> [--pitch n] [--colours n] [--keep x0,y0,x1,y1] [--out dir]');
  process.exit(1);
}
const out = opt('out', 'src/render/creature/sprites');
const K = Number(opt('colours', 22));

// ------------------------------------------------------------------ PNG in and out

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG — convert it first (sips -s format png)');
  let w = 0, h = 0, depth = 0, type = 0, interlace = 0;
  const idat = [];
  for (let p = 8; p < buf.length;) {
    const len = buf.readUInt32BE(p), kind = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; type = data[9]; interlace = data[12]; }
    if (kind === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  if (depth !== 8 || (type !== 2 && type !== 6) || interlace) throw new Error(`unsupported PNG: depth ${depth}, type ${type}, interlace ${interlace}`);
  const bpp = type === 6 ? 4 : 3, stride = w * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const px = new Uint8Array(w * h * 4);
  const prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      px[o] = cur[x * bpp]; px[o + 1] = cur[x * bpp + 1]; px[o + 2] = cur[x * bpp + 2];
      px[o + 3] = bpp === 4 ? cur[x * bpp + 3] : 255;
    }
    prev.set(cur);
  }
  return { w, h, px };
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = b => { let c = -1; for (const v of b) c = CRC[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function encodePng(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(px.buffer, px.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const chunk = (kind, data) => {
    const b = Buffer.alloc(12 + data.length);
    b.writeUInt32BE(data.length, 0); b.write(kind, 4, 'ascii'); data.copy(b, 8);
    b.writeUInt32BE(crc32(b.subarray(4, 8 + data.length)), 8 + data.length);
    return b;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ------------------------------------------------------------------ the sheet

const { w: W, h: H, px: D } = decodePng(readFileSync(sheet));
const isBg = i => D[i * 4 + 3] < 128 ||
  (D[i * 4] > 170 && D[i * 4 + 1] < 110 && D[i * 4 + 2] > 170 && D[i * 4] - D[i * 4 + 1] > 100);
const diff = (i, j) => Math.abs(D[i * 4] - D[j * 4]) + Math.abs(D[i * 4 + 1] - D[j * 4 + 1]) + Math.abs(D[i * 4 + 2] - D[j * 4 + 2]);

// the frames: runs of columns with anything on them, the wide ones, left to right
const used = [];
for (let x = 0; x < W; x++) { let n = 0; for (let y = 0; y < H; y++) if (!isBg(y * W + x)) n++; used.push(n); }
const runs = [];
for (let x = 0, s = -1; x <= W; x++) {
  const on = x < W && used[x] > 0;
  if (on && s < 0) s = x;
  if (!on && s >= 0) { if (x - s > W * 0.05) runs.push([s, x - 1]); s = -1; }
}
if (runs.length < 1 || runs.length > 2) throw new Error(`expected one or two frames, found ${runs.length}`);
const boxes = runs.map(([x0, x1]) => {
  let y0 = H, y1 = 0;
  for (let x = x0; x <= x1; x++) for (let y = 0; y < H; y++) if (!isBg(y * W + x)) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0, x1, y0, y1 };
});

// the pitch: the period every row-edge in the first frame agrees on, when not given
function pitchOf(b) {
  const edges = [];
  for (let x = b.x0; x < b.x1; x += 2) for (let y = b.y0; y < b.y1; y++) if (diff(y * W + x, (y + 1) * W + x) > 80) edges.push(y + 1);
  let best = 0, at = 8;
  for (let p = 4; p <= 16; p += 0.005) {
    let c = 0, s = 0;
    for (const e of edges) { const a = 2 * Math.PI * e / p; c += Math.cos(a); s += Math.sin(a); }
    const m = Math.hypot(c, s) / edges.length;
    if (m > best) { best = m; at = p; }
  }
  return at;
}
const P = Number(opt('pitch', 0)) || pitchOf(boxes[0]);
// two cells of water round each frame, so the grid starts before the art and ends after it
for (const b of boxes) {
  const m = Math.ceil(P * 2);
  b.x0 = Math.max(1, b.x0 - m); b.x1 = Math.min(W - 2, b.x1 + m); b.y0 = Math.max(1, b.y0 - m); b.y1 = Math.min(H - 2, b.y1 + m);
}

// ------------------------------------------------------------------ onto the grid

function gridOf(b) {
  const colE = k => { let s = 0; for (let y = b.y0; y < b.y1; y++) s += diff(y * W + k - 1, y * W + k); return s; };
  const rowE = k => { let s = 0; for (let x = b.x0; x < b.x1; x++) s += diff((k - 1) * W + x, k * W + x); return s; };
  const anchor = (from, edge) => { let at = from, be = -1; for (let k = from; k < from + Math.ceil(P); k++) { const e = edge(k); if (e > be) { be = e; at = k; } } return at; };
  const bounds = (from, to, edge) => {
    const o = [from]; let last = from;
    while (last + P * 1.5 < to) {
      let best = -1, at = Math.round(last + P);
      for (let k = Math.round(last + P - P * 0.18); k <= Math.round(last + P + P * 0.18); k++) { const e = edge(k); if (e > best) { best = e; at = k; } }
      o.push(at); last = at;
    }
    return o;
  };
  const xs = bounds(anchor(b.x0 + 1, colE), b.x1, colE), ys = bounds(anchor(b.y0 + 1, rowE), b.y1, rowE);
  const w = xs.length - 1, h = ys.length - 1, cells = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ink = [];
    let bg = 0, n = 0;
    for (let y = ys[j] + 1; y < ys[j + 1] - 1; y++) for (let x = xs[i] + 1; x < xs[i + 1] - 1; x++) {
      const p = y * W + x; n++;
      if (isBg(p)) bg++; else ink.push([D[p * 4], D[p * 4 + 1], D[p * 4 + 2]]);
    }
    if (!n || bg > n / 2) { cells.push(null); continue; }
    const med = k => ink.map(c => c[k]).sort((a, z) => a - z)[ink.length >> 1];
    cells.push([med(0), med(1), med(2)]);
  }
  return { w, h, cells };
}
const grids = boxes.map(gridOf);

// one palette for both frames: k-means from colours spread far apart
const all = grids.flatMap(g => g.cells.filter(Boolean));
const cent = [all[0].slice()];
while (cent.length < Math.min(K, all.length)) {
  let best = null, bd = -1;
  for (let i = 0; i < all.length; i += 3) {
    const p = all[i], d = Math.min(...cent.map(c => (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2));
    if (d > bd) { bd = d; best = p; }
  }
  cent.push(best.slice());
}
const near = p => { let b = 0, bd = Infinity; cent.forEach((c, i) => { const d = (c[0] - p[0]) ** 2 * 0.3 + (c[1] - p[1]) ** 2 * 0.59 + (c[2] - p[2]) ** 2 * 0.11; if (d < bd) { bd = d; b = i; } }); return b; };
for (let it = 0; it < 16; it++) {
  const s = cent.map(() => [0, 0, 0, 0]);
  for (const p of all) { const k = near(p); s[k][0] += p[0]; s[k][1] += p[1]; s[k][2] += p[2]; s[k][3]++; }
  s.forEach((v, k) => { if (v[3]) cent[k] = [v[0] / v[3], v[1] / v[3], v[2] / v[3]]; });
}
const pal = cent.map(c => c.map(Math.round));
const snapped = grids.map(g => g.cells.map(c => c ? near(c) : -1));

// ------------------------------------------------------------------ the strike, reduced to what moves

const rest = grids[0], R = snapped[0];
let frameH = rest.h, strikeIdx = null, keep = null, off = [0, 0];
if (grids[1]) {
  const S = grids[1], s = snapped[1];
  const at = (g, idx, i, j) => (i < 0 || j < 0 || i >= g.w || j >= g.h) ? -1 : idx[j * g.w + i];
  let best = -1;
  for (let dx = -6; dx <= 6; dx++) for (let dy = -6; dy <= 6; dy++) {
    let same = 0, n = 0;
    for (let j = 0; j < rest.h; j++) for (let i = 0; i < Math.floor(rest.w * 0.55); i++) {
      const a = at(rest, R, i, j), b = at(S, s, i + dx, j + dy);
      if (a < 0 && b < 0) continue;
      n++; if (a === b) same++;
    }
    if (same / n > best) { best = same / n; off = [dx, dy]; }
  }
  frameH = Math.max(rest.h, S.h - off[1]);
  const given = opt('keep');
  if (given) {
    const [x0, y0, x1, y1] = given.split(',').map(Number);
    keep = { x0, y0, x1, y1 };
  } else {
    // where one silhouette has the animal and the other does not — but a redrawn outline
    // disagrees by a cell all the way round, so only the cells whose whole neighbourhood
    // disagrees count: what is left is a part that moved. Its box, grown by four cells.
    const xor = (i, j) => (at(rest, R, i, j) < 0) !== (at(S, s, i + off[0], j + off[1]) < 0);
    keep = { x0: Infinity, y0: Infinity, x1: -1, y1: -1 };
    for (let j = 0; j < frameH; j++) for (let i = 0; i < rest.w; i++) {
      let all = true;
      for (let dj = -1; dj <= 1 && all; dj++) for (let di = -1; di <= 1 && all; di++) all = xor(i + di, j + dj);
      if (all) { keep.x0 = Math.min(keep.x0, i); keep.y0 = Math.min(keep.y0, j); keep.x1 = Math.max(keep.x1, i); keep.y1 = Math.max(keep.y1, j); }
    }
    keep = keep.x1 < 0 ? { x0: 0, y0: 0, x1: -1, y1: -1 }
      : { x0: keep.x0 - 4, y0: keep.y0 - 4, x1: keep.x1 + 4, y1: keep.y1 + 4 };
  }
  strikeIdx = [];
  for (let j = 0; j < frameH; j++) for (let i = 0; i < rest.w; i++) {
    const inside = i >= keep.x0 && i <= keep.x1 && j >= keep.y0 && j <= keep.y1;
    strikeIdx.push(inside ? at(S, s, i + off[0], j + off[1]) : at(rest, R, i, j));
  }
}
const restIdx = [];
for (let j = 0; j < frameH; j++) for (let i = 0; i < rest.w; i++) restIdx.push(j < rest.h ? R[j * rest.w + i] : -1);

// ------------------------------------------------------------------ landmarks

const fw = rest.w;
const solid = (i, j) => i >= 0 && j >= 0 && i < fw && j < frameH && restIdx[j * fw + i] >= 0;
const col = [];
for (let i = 0; i < fw; i++) { let t = -1, b = -1, n = 0; for (let j = 0; j < frameH; j++) if (solid(i, j)) { if (t < 0) t = j; b = j; n++; } col.push({ t, b, n }); }
const most = Math.max(...col.map(c => c.n));
// the tail root: the narrowest column of the back third, between the fan and the body
let tail = 0, tw = Infinity;
for (let i = Math.floor(fw * 0.05); i < Math.floor(fw * 0.35); i++) { const c = col[i]; if (c.n > 0 && c.b - c.t < tw) { tw = c.b - c.t; tail = i; } }
const axis = Math.round((col[tail].t + col[tail].b) / 2);
// the snout: the last column with body just under the axis — a lure's rod and bulb hang
// above it and a feeler is a line, so neither has a few cells there
const band = Math.max(3, Math.round(frameH * 0.15));
const bodyAt = i => { let n = 0; for (let j = axis; j < axis + band; j++) if (solid(i, j)) n++; return n >= 3; };
let snout = fw - 1;
while (snout > tail && !bodyAt(snout)) snout--;
snout += 1;
void most;
// lights: bright cyan-white clusters, the one past the snout a bulb and the one in the head an eye
const lit = [];
for (let j = 0; j < frameH; j++) for (let i = 0; i < fw; i++) {
  const k = restIdx[j * fw + i];
  if (k >= 0 && pal[k][1] > 170 && pal[k][2] > 200) lit.push([i, j]);
}
const mean = a => a.length ? a.reduce((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0]).map(v => +(v / a.length + 0.5).toFixed(1)) : null;
const bulb = mean(lit.filter(p => p[0] > snout));
// the eye: the biggest lit blob in the head above the axis — specks are single cells
const head = new Set(lit.filter(p => p[0] <= snout && p[0] > tail + (snout - tail) * 0.55 && p[1] < axis).map(p => p[1] * fw + p[0]));
let eyeBlob = [];
for (const start of head) {
  const blob = [], stack = [start];
  head.delete(start);
  while (stack.length) {
    const c = stack.pop(); blob.push([c % fw, Math.floor(c / fw)]);
    for (const n of [c - 1, c + 1, c - fw, c + fw]) if (head.has(n)) { head.delete(n); stack.push(n); }
  }
  if (blob.length > eyeBlob.length) eyeBlob = blob;
}
const eye = eyeBlob.length >= 3 ? mean(eyeBlob) : null;

// ------------------------------------------------------------------ out

const toPx = idx => {
  const o = new Uint8Array(fw * frameH * 4);
  idx.forEach((k, i) => { if (k < 0) return; o[i * 4] = pal[k][0]; o[i * 4 + 1] = pal[k][1]; o[i * 4 + 2] = pal[k][2]; o[i * 4 + 3] = 255; });
  return o;
};
mkdirSync(out, { recursive: true });
writeFileSync(join(out, `${id}.png`), encodePng(fw, frameH, toPx(restIdx)));
if (strikeIdx) writeFileSync(join(out, `${id}-strike.png`), encodePng(fw, frameH, toPx(strikeIdx)));

// a preview at six times, both frames on the deep water
const S6 = 6, frames = strikeIdx ? [restIdx, strikeIdx] : [restIdx];
const pw = (fw * S6 + 12) * frames.length + 12, ph = frameH * S6 + 24;
const prev = new Uint8Array(pw * ph * 4);
for (let i = 0; i < pw * ph; i++) { prev[i * 4] = 11; prev[i * 4 + 1] = 21; prev[i * 4 + 2] = 48; prev[i * 4 + 3] = 255; }
frames.forEach((idx, f) => idx.forEach((k, i) => {
  if (k < 0) return;
  const x0 = 12 + f * (fw * S6 + 12) + (i % fw) * S6, y0 = 12 + Math.floor(i / fw) * S6;
  for (let y = y0; y < y0 + S6; y++) for (let x = x0; x < x0 + S6; x++) { const o = (y * pw + x) * 4; prev[o] = pal[k][0]; prev[o + 1] = pal[k][1]; prev[o + 2] = pal[k][2]; }
}));
const previewPath = join(tmpdir(), `${id}-sprite-preview.png`);
writeFileSync(previewPath, encodePng(pw, ph, prev));

const lm = [`w: ${fw}`, `h: ${frameH}`, `snout: ${snout}`, `tail: ${tail}`, `axis: ${axis}`];
if (bulb) lm.push(`bulb: [${bulb.join(', ')}]`);
if (eye) lm.push(`eye: [${eye.join(', ')}]`);
console.log(`pitch ${P.toFixed(3)} px · grid ${grids.map(g => `${g.w}×${g.h}`).join(' and ')} · ${pal.length} colours`);
if (strikeIdx) console.log(`strike lined up at (${off.join(', ')}); taken from it: x ${keep.x0}..${keep.x1}, y ${keep.y0}..${keep.y1} (--keep to override)`);
console.log(`wrote ${join(out, `${id}.png`)}${strikeIdx ? ` and ${id}-strike.png` : ''}`);
console.log(`preview ${previewPath}`);
console.log(`\ncontent/sprites.ts — check on the board before trusting it:\n  ${id}: { ${lm.join(', ')} },`);
