#!/usr/bin/env node
/**
 * Import a generated sprite sheet as an enemy's frames — the code side of `docs/sprites.md`.
 *
 *   npm run sprite -- <sheet.png> --id <species> [--pitch 6.54] [--colours 22]
 *                     [--keep x0,y0,x1,y1[;x0,y0,x1,y1…]] [--key green] [--fringe [hue]]
 *                     [--frames rest,strike,wounded,wounded-strike] [--keep-wounded x0,y0,x1,y1]
 *                     [--wounded-palette #a1,#b1,…/#a2,#b2,…]
 *                     [--out src/render/creature/sprites]
 *
 * The sheet is one to four frames side by side on flat #FF00FF, or #00FF00 with `--key green`
 * for an animal that is violet, pink or red, into which magenta's bleed cannot be told from
 * paint. Left to right they are the rest, the strike, the wounded and the wounded strike, as
 * many as there are; `--frames` names them otherwise (a drifter's `rest,wounded`). A
 * generator's "8× pixel art" is never on a clean grid — the anglerfish's was 6.5
 * image pixels to the art pixel, and its columns drifted by three art pixels across a frame —
 * so the grid is found, not assumed: each cell boundary is the strongest colour edge a pitch on
 * from the last, which follows a drifting grid where a fixed pitch would double or drop
 * columns. Each cell takes its median colour, and each pair of frames is clustered to one palette.
 *
 * The strike is lined up on the rest by the back half of the body, which should not move, and
 * then only the part that differs is taken from it: a generator redraws the whole fish for a
 * second frame, and swapping the whole of it in made the body shimmer on every bite. That part
 * is the box round where the two silhouettes disagree, grown by a few cells, or `--keep`. The
 * wounded frame is the animal turned at half health (`woundedGenome` in `sim/roles.ts`): lined
 * up on the rest by its outline and taken whole, since all of it changes; the wounded strike
 * is to it what the strike is to the rest.
 *
 * Writes `<id>.png` (and `<id>-strike.png`, `<id>-wounded.png`, `<id>-wounded-strike.png`) at
 * one pixel per art pixel, a preview at six, and
 * prints the landmarks for `content/sprites.ts` — check them on the board before trusting them.
 * Reads PNG only (8-bit RGB or RGBA); `sips -s format png in.webp --out in.png` converts.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodePng, encodePng } from './png.mjs';

// ------------------------------------------------------------------ arguments

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const sheet = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const id = opt('id');
if (!sheet || !id) {
  console.error('usage: npm run sprite -- <sheet.png> --id <species> [--pitch n] [--colours n] [--keep x0,y0,x1,y1] [--key green] [--fringe [hue]] [--frames names] [--keep-wounded x0,y0,x1,y1] [--wounded-palette from/to] [--out dir]');
  process.exit(1);
}
const out = opt('out', 'src/render/creature/sprites');
const K = Number(opt('colours', 22));

// ------------------------------------------------------------------ the sheet

const { w: W, h: H, px: D } = decodePng(readFileSync(sheet));
const green = opt('key', 'magenta') === 'green';
const isBg = i => D[i * 4 + 3] < 128 || (green
  ? D[i * 4 + 1] > 170 && D[i * 4] < 110 && D[i * 4 + 2] < 110 && D[i * 4 + 1] - Math.max(D[i * 4], D[i * 4 + 2]) > 100
  : D[i * 4] > 170 && D[i * 4 + 1] < 110 && D[i * 4 + 2] > 170 && D[i * 4] - D[i * 4 + 1] > 100);
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
const FRAMES = ['rest', 'strike', 'wounded', 'wounded-strike'];
const names = opt('frames')?.split(',') ?? FRAMES.slice(0, runs.length);
if (runs.length < 1 || runs.length > 4) throw new Error(`expected one to four frames, found ${runs.length}`);
if (names.length !== runs.length) throw new Error(`--frames names ${names.length} frames, the sheet has ${runs.length}`);
if (names[0] !== 'rest' || names.some(n => !FRAMES.includes(n)) || new Set(names).size !== names.length) throw new Error(`--frames: rest first, then any of ${FRAMES.slice(1).join(', ')}`);
if (names.includes('wounded-strike') && !names.includes('wounded')) throw new Error('a wounded strike needs its wounded frame');
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
  for (let p = 2.5; p <= 16; p += 0.005) {
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

// the fringe, with `--fringe`: cells the background bled into. The barracuda's sheet ringed
// its outline with a cell of dark magenta, too dark for `isBg` to key out, and clustered it
// became three of the palette's colours. A magenta cell on the rim with a dark cell inside it
// is the bleed round an outline and goes; any other is a cell of the animal the bleed tinted,
// and takes the clean colour nearest its brightness — the siphonophore's thin tentacles were
// tinted whole, and darkened to the outline they were gone against the water. Opt-in, because
// hue is all that tells bleed from paint: the gulper and the mantis shrimp are violet-magenta
// themselves, and it ate their outlines. `--fringe 240` takes bleed from 240° (violet) up,
// for a sheet with no violet in it, where bleed into blue lands at 245–270°; by default from
// 272°, which spares the barracuda's violet fins (257°). On green (`--key green`) bleed is
// green from 75° to 170° — clear of a yellow fin's 50°, which green bleed pushes toward 70° —
// and the number moves the 75. Bled into a red outline it is a brown at 35–40°, which the
// mackerel's flushed frames were specked with: `--fringe 30` takes it, on an animal with no
// yellow or orange in it.
const fringeAt = argv.indexOf('--fringe');
const fringeFrom = fringeAt >= 0 && /^\d+$/.test(argv[fringeAt + 1] ?? '') ? Number(argv[fringeAt + 1]) : green ? 75 : 272;
const fringeTo = green ? 170 : 330;
const hue = ([r, g, b]) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx - mn < 24 || (mx - mn) / mx < 0.4) return -1;
  return mx === b ? 240 + 60 * (r - g) / (mx - mn) : mx === r ? (360 + 60 * (g - b) / (mx - mn)) % 360
    : 120 + 60 * (b - r) / (mx - mn);
};
const lum = c => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
// on green, a dark outline the bleed only greyed is too dull for a hue at all: the larva's
// violet-grey outline came out a grey-green and a grey-teal, whose green over its red is the tell
const dullGreen = c => green && lum(c) < 160 && c[1] > c[0] + 6;
const isFringe = c => c && ((hue(c) >= fringeFrom && hue(c) <= fringeTo &&
  (green ? c[1] > c[2] : c[1] < c[0] && c[1] < c[2])) || dullGreen(c));
let fringe = 0;
if (fringeAt >= 0) for (const g of grids) {
  const at = (i, j) => i < 0 || j < 0 || i >= g.w || j >= g.h ? null : g.cells[j * g.w + i];
  const ink = g.cells.filter(c => c && !isFringe(c)).sort((a, z) => lum(a) - lum(z));
  const nearest = l => {
    let lo = 0, hi = ink.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (lum(ink[m]) < l) lo = m + 1; else hi = m; }
    return lo > 0 && l - lum(ink[lo - 1]) < lum(ink[lo]) - l ? ink[lo - 1] : ink[lo];
  };
  const next = g.cells.slice();
  for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) {
    const c = at(i, j);
    if (!isFringe(c)) continue;
    const nb = [at(i + 1, j), at(i - 1, j), at(i, j + 1), at(i, j - 1)];
    const rim = nb.includes(null), backed = nb.some(n => n && !isFringe(n) && lum(n) < 40);
    next[j * g.w + i] = rim && backed ? null : nearest(lum(c));
    fringe++;
  }
  g.cells = next;
}

// a palette for each pair, k-means from colours spread far apart: the rest and the strike
// share one, and the wounded pair has its own, since a body flushed red or glowing hotter
// shares few colours with the whole animal and would have taken the rest's slots
function cluster(cells) {
  const all = cells.filter(Boolean);
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
  return { colours: cent.map(c => c.map(Math.round)), near };
}
const pal = [], snapped = [];
for (const pair of [['rest', 'strike'], ['wounded', 'wounded-strike']]) {
  const fs = pair.map(n => names.indexOf(n)).filter(f => f >= 0);
  if (!fs.length) continue;
  const { colours, near } = cluster(fs.flatMap(f => grids[f].cells));
  const base = pal.length;
  pal.push(...colours);
  for (const f of fs) snapped[f] = grids[f].cells.map(c => c ? base + near(c) : -1);
}

// ------------------------------------------------------------------ the frames, lined up on the rest

const rest = grids[0];
const at = (f, i, j) => { const g = grids[f]; return i < 0 || j < 0 || i >= g.w || j >= g.h ? -1 : snapped[f][j * g.w + i]; };
const same = (p, q) => p === q, shape = (p, q) => (p < 0) === (q < 0);

/**
 * How frame `b` sits on frame `a`: the shift that puts b's cell (i + dx, j + dy) on a's (i, j),
 * by the best agreement over a's first `part` of columns from the tail. A frame bigger than the
 * other (spines raised) is searched for as far as it is bigger: each frame is cut to its own
 * box, and a few cells' search cut off the lionfish's spines, seventy cells over its back.
 */
function lineUp(a, b, part, agree) {
  const A = grids[a], B = grids[b];
  const rx = Math.max(0, B.w - A.w), ry = Math.max(0, B.h - A.h), cols = Math.floor(A.w * part);
  let best = -1, off = [0, 0];
  for (let dx = -6; dx <= 6 + rx; dx++) for (let dy = -6; dy <= 6 + ry; dy++) {
    let hit = 0, n = 0;
    for (let j = 0; j < A.h; j++) for (let i = 0; i < cols; i++) {
      const p = at(a, i, j), q = at(b, i + dx, j + dy);
      if (p < 0 && q < 0) continue;
      n++; if (agree(p, q)) hit++;
    }
    if (hit / n > best) { best = hit / n; off = [dx, dy]; }
  }
  return off;
}
// a strike by the back half of the body, which should not move; the wounded by its whole
// outline, since all of its colours change; the wounded strike on the wounded, as the strike
// is on the rest
const S = names.indexOf('strike'), Wd = names.indexOf('wounded'), WS = names.indexOf('wounded-strike');
const off = names.map(() => [0, 0]);
if (S > 0) off[S] = lineUp(0, S, 0.55, same);
if (Wd > 0) off[Wd] = lineUp(0, Wd, 1, shape);
if (WS > 0) { const o = lineUp(Wd, WS, 0.55, same); off[WS] = [off[Wd][0] + o[0], off[Wd][1] + o[1]]; }

// the frames share one size: the rest's box, grown to hold every other frame's rows — the
// lionfish's raised spines padded both frames 38 cells at the top — and its columns wherever
// the wounded frame's art reaches past it, with the box's own margin of water round that. The
// wounded is the only frame taken whole: of a strike only the part that moved is used, and the
// archerfish's, redrawn a cell along, would have widened every frame and moved its landmarks.
let lft = 0, top = 0, rgt = 0, bot = 0;
grids.forEach((g, f) => {
  if (!f) return;
  top = Math.max(top, off[f][1]);
  bot = Math.max(bot, g.h - off[f][1] - rest.h);
  if (f !== Wd) return;
  for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) {
    if (snapped[f][j * g.w + i] < 0) continue;
    const x = i - off[f][0];
    if (x < 0) lft = Math.max(lft, 2 - x);
    if (x >= rest.w) rgt = Math.max(rgt, x - rest.w + 3);
  }
});
const fw = rest.w + lft + rgt, frameH = rest.h + top + bot;
const cellOf = (f, i, j) => at(f, i - lft + off[f][0], j - top + off[f][1]);
const whole = f => { const o = []; for (let j = 0; j < frameH; j++) for (let i = 0; i < fw; i++) o.push(cellOf(f, i, j)); return o; };

// only the part of a strike that moved is taken from it: a generator redraws the whole animal
// for a second frame, and swapping all of it in made the body shimmer on every bite
// `--keep-wounded` for the wounded strike alone, when its head is not where the rest's is: the
// pufferfish's ball was drawn shorter than the fish, its eye further back, and a box round the
// rest's beak took the wounded strike's eye with it, drawn differently and smeared
function moved(base, f) {
  const given = (f === WS && opt('keep-wounded')) || opt('keep');
  if (given) {
    // in the rest frame's cells, so a box written for an unpadded frame still holds; several
    // split by `;`, for parts that move apart — the vampire squid's two light organs open
    // above and below its body, and one box round both swapped the body between them too
    return given.split(';').map(b => {
      const [x0, y0, x1, y1] = b.split(',').map(Number);
      return { x0: x0 + lft, y0: y0 + top, x1: x1 + lft, y1: y1 + top };
    });
  }
  // where one silhouette has the animal and the other does not — but a redrawn outline
  // disagrees by a cell all the way round, so only the cells whose whole neighbourhood
  // disagrees count: what is left is a part that moved. Its box, grown by four cells.
  const xor = (i, j) => (cellOf(base, i, j) < 0) !== (cellOf(f, i, j) < 0);
  const k = { x0: Infinity, y0: Infinity, x1: -1, y1: -1 };
  for (let j = 0; j < frameH; j++) for (let i = 0; i < fw; i++) {
    let all = true;
    for (let dj = -1; dj <= 1 && all; dj++) for (let di = -1; di <= 1 && all; di++) all = xor(i + di, j + dj);
    if (all) { k.x0 = Math.min(k.x0, i); k.y0 = Math.min(k.y0, j); k.x1 = Math.max(k.x1, i); k.y1 = Math.max(k.y1, j); }
  }
  return [k.x1 < 0 ? { x0: 0, y0: 0, x1: -1, y1: -1 } : { x0: k.x0 - 4, y0: k.y0 - 4, x1: k.x1 + 4, y1: k.y1 + 4 }];
}
function struck(base, f) {
  const keep = moved(base, f), idx = [];
  for (let j = 0; j < frameH; j++) for (let i = 0; i < fw; i++) {
    const inside = keep.some(k => i >= k.x0 && i <= k.x1 && j >= k.y0 && j <= k.y1);
    idx.push(cellOf(inside ? f : base, i, j));
  }
  return { idx, keep };
}
const restIdx = whole(0);
const out4 = [{ name: 'rest', idx: restIdx }];
if (S > 0) out4.push({ name: 'strike', ...struck(0, S) });
if (Wd > 0) out4.push({ name: 'wounded', idx: whole(Wd) });
if (WS > 0) out4.push({ name: 'wounded-strike', ...struck(Wd, WS) });

// `--wounded-palette <from>/<to>`, two rows of hex swatches in the same roles, the Stage A
// palette's: a wounded frame (and wounded strike) made from the rest (and strike) by recolouring
// it, for a turn that changes colour and nothing else. Each colour goes to its nearest swatch
// in the first row and is moved by that swatch's step to the second, so the shades between the
// swatches keep their place. The sea nettle's sheet came with its rest alone, and its wounded
// was only its colours, lit hot: recoloured, it cannot drift off the rest as a redrawn frame does.
const recolour = opt('wounded-palette');
if (recolour) {
  if (Wd > 0) throw new Error('--wounded-palette makes the wounded frame; this sheet has one');
  const [from, to] = recolour.split('/').map(row => row.split(',').map(h => [0, 2, 4].map(i => parseInt(h.replace(/^#|^0x/, '').slice(i, i + 2), 16))));
  if (from.length !== to.length || from.some(c => c.some(Number.isNaN))) throw new Error('--wounded-palette: two rows of hex colours, the same length, split by /');
  const moved = new Map();
  const hot = k => {
    if (k < 0) return -1;
    if (!moved.has(k)) {
      const c = pal[k];
      let best = 0, bd = Infinity;
      from.forEach((f, i) => { const d = (f[0] - c[0]) ** 2 * 0.3 + (f[1] - c[1]) ** 2 * 0.59 + (f[2] - c[2]) ** 2 * 0.11; if (d < bd) { bd = d; best = i; } });
      pal.push(c.map((v, ch) => Math.max(0, Math.min(255, Math.round(v + to[best][ch] - from[best][ch])))));
      moved.set(k, pal.length - 1);
    }
    return moved.get(k);
  };
  out4.push({ name: 'wounded', idx: restIdx.map(hot) });
  const strike = out4.find(f => f.name === 'strike');
  if (strike) out4.push({ name: 'wounded-strike', idx: strike.idx.map(hot) });
}

// ------------------------------------------------------------------ landmarks

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
// lights: blobs of bright, saturated colour (a lure's bulb, an eye, a tail organ) — single
// cells are photophores, painted into the art and lit by the body's halo, not lights of
// their own. A lit blob past the snout is printed as the bulb too, if the animal has a lure.
// bright, or a warm organ's pink-red: a body's lit blue tops out well under either
const hot = k => { const [r, g, b] = pal[k]; return r * 0.3 + g * 0.59 + b * 0.11 > 140 || (r > 200 && g < 140); };
const litSet = new Set();
for (let j = 0; j < frameH; j++) for (let i = 0; i < fw; i++) { const k = restIdx[j * fw + i]; if (k >= 0 && hot(k)) litSet.add(j * fw + i); }
const blobs = [];
for (const start of [...litSet]) {
  if (!litSet.has(start)) continue;
  const blob = [], stack = [start];
  litSet.delete(start);
  while (stack.length) {
    const c = stack.pop(); blob.push(c);
    for (const n of [c - 1, c + 1, c - fw, c + fw, c - fw - 1, c - fw + 1, c + fw - 1, c + fw + 1]) if (litSet.has(n)) { litSet.delete(n); stack.push(n); }
  }
  if (blob.length < 3) continue;
  const at = [blob.reduce((t, c) => t + (c % fw), 0) / blob.length + 0.5, blob.reduce((t, c) => t + Math.floor(c / fw), 0) / blob.length + 0.5].map(v => +v.toFixed(1));
  const rgb = [0, 1, 2].map(ch => Math.round(blob.reduce((t, c) => t + pal[restIdx[c]][ch], 0) / blob.length));
  blobs.push({ at, size: blob.length, color: '0x' + rgb.map(v => v.toString(16).padStart(2, '0')).join('') });
}
blobs.sort((p, q) => q.size - p.size);
// the biggest few are the candidates: teeth and specks catch the light too
blobs.splice(4);
const bulb = blobs.find(b => b.at[0] > snout)?.at ?? null;

// the hitbox: nine samples snout to tail (sim/hull.ts's SAMPLES), each the run that holds the
// axis — fins joined to the body count, a lure's rod above it is a run of its own and does
// not — at 85% of its depth, a little inside the picture as Isaac's hitboxes are
const hull = [];
for (let n = 0; n < 9; n++) {
  const i = Math.round(snout - 1 - (0.03 + (n / 8) * 0.94) * (snout - 1 - tail));
  let j = axis, best = -1;
  for (let d = 0; d < frameH && best < 0; d++) { if (solid(i, axis - d)) best = axis - d; else if (solid(i, axis + d)) best = axis + d; }
  if (best < 0) { hull.push([i + 0.5, axis, 0.5]); continue; }
  let t = best, b = best;
  while (solid(i, t - 1)) t--;
  while (solid(i, b + 1)) b++;
  j = (t + b + 1) / 2;
  hull.push([i + 0.5, +j.toFixed(1), +(((b + 1 - t) / 2) * 0.85).toFixed(1)]);
}

// ------------------------------------------------------------------ out

const toPx = idx => {
  const o = new Uint8Array(fw * frameH * 4);
  idx.forEach((k, i) => { if (k < 0) return; o[i * 4] = pal[k][0]; o[i * 4 + 1] = pal[k][1]; o[i * 4 + 2] = pal[k][2]; o[i * 4 + 3] = 255; });
  return o;
};
const fileOf = name => name === 'rest' ? `${id}.png` : `${id}-${name}.png`;
mkdirSync(out, { recursive: true });
for (const f of out4) writeFileSync(join(out, fileOf(f.name)), encodePng(fw, frameH, toPx(f.idx)));

// a preview at six times, every frame on the deep water
const S6 = 6;
const pw = (fw * S6 + 12) * out4.length + 12, ph = frameH * S6 + 24;
const prev = new Uint8Array(pw * ph * 4);
for (let i = 0; i < pw * ph; i++) { prev[i * 4] = 11; prev[i * 4 + 1] = 21; prev[i * 4 + 2] = 48; prev[i * 4 + 3] = 255; }
out4.forEach(({ idx }, f) => idx.forEach((k, i) => {
  if (k < 0) return;
  const x0 = 12 + f * (fw * S6 + 12) + (i % fw) * S6, y0 = 12 + Math.floor(i / fw) * S6;
  for (let y = y0; y < y0 + S6; y++) for (let x = x0; x < x0 + S6; x++) { const o = (y * pw + x) * 4; prev[o] = pal[k][0]; prev[o + 1] = pal[k][1]; prev[o + 2] = pal[k][2]; }
}));
const previewPath = join(tmpdir(), `${id}-sprite-preview.png`);
writeFileSync(previewPath, encodePng(pw, ph, prev));

const lm = [`w: ${fw}`, `h: ${frameH}`, `snout: ${snout}`, `tail: ${tail}`, `axis: ${axis}`];
if (bulb) lm.push(`bulb: [${bulb.join(', ')}] /* a lure's, or delete */`);
lm.push(`hull: [${hull.map(h => `[${h.join(', ')}]`).join(', ')}]`);
if (blobs.length) lm.push(`lights: [${blobs.map(b => `{ at: [${b.at.join(', ')}], color: ${b.color}, strength: 0.5 }`).join(', ')}] /* candidates: keep the real ones */`);
console.log(`pitch ${P.toFixed(3)} px · grid ${grids.map(g => `${g.w}×${g.h}`).join(', ')} · frames ${names.join(', ')} · ${pal.length} colours${fringe ? ` · ${fringe} fringe cells cleaned` : ''}`);
out4.forEach((f, k) => {
  if (!k) return;
  if (!names.includes(f.name)) { console.log(`${f.name} recoloured from the ${f.name === 'wounded' ? 'rest' : 'strike'} (--wounded-palette)`); return; }
  const o = off[names.indexOf(f.name)];
  const kept = f.keep ? `; taken from it: ${f.keep.map(k => `x ${k.x0 - lft}..${k.x1 - lft}, y ${k.y0 - top}..${k.y1 - top}`).join('; ')} (--keep to override)` : ', taken whole';
  console.log(`${f.name} lined up at (${o.join(', ')})${kept}`);
});
if (lft || top || rgt || bot) console.log(`every frame padded for the others: ${top} cells at the top, ${bot} at the bottom, ${lft} at the back, ${rgt} at the front`);
console.log(`wrote ${out4.map(f => join(out, fileOf(f.name))).join(', ')}`);
console.log(`preview ${previewPath}`);
console.log(`\ncontent/sprites.ts — check on the board before trusting it:\n  ${id}: { ${lm.join(', ')} },`);
