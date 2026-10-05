/**
 * The shot organs on the body: what the shots carry (`sim/organs/shots.ts`), each marked
 * where it would be made — the needle at the mouth that throws it, the nares that smell for
 * it, the glands, the brood, a halo over the head. Each colour is its shot's own
 * (`render/shots.ts`), so the body and what it fires read as one system.
 */
import { edgeAt, halfWidth, spineAt, R, type Form } from '../../../content/form';
import type { Genome } from '../../../content/genome';
import type { RGB } from './palette';
import { M, type Pt, type Sheet } from './sheet';

const SULPHUR: RGB = [212, 240, 74];
const GOLD: RGB = [255, 228, 154];
const LILAC: RGB = [184, 168, 255];
const MINT: RGB = [122, 240, 200];
const ICE: RGB = [216, 246, 255];
const ROE: RGB = [244, 200, 224];
const PEARL: RGB = [232, 244, 255];
const WHITE: RGB = [255, 255, 255];
const WATER: RGB = [120, 196, 240];
const DARK: RGB = [8, 10, 18];
/** A fry's glass, the larva's own (`render/shots.ts`). */
const FRY: RGB = [220, 232, 255];

/** How far the needle stands off the nose: inside the sheet's own margin there (`paint`). */
export const NEEDLE = 0.3;

/** Needle Jet: a bill off the snout, a needlefish's, pale at the point the shots leave by. */
export function needleBill(s: Sheet, f: Form) {
  const x = spineAt(0.01, f), y = edgeAt(0.03, f, 0.1);
  const len = R * NEEDLE;
  s.line([[x, y], [x + len, y]], M.TOOTH);
  s.dot(x + len, y, WHITE, 1);
}

/** Hunting Nares: two nostrils ahead of the eye, each a dark pit with the seeking shot's mint in its rim. */
export function nares(s: Sheet, f: Form) {
  for (const t of [0.05, 0.085]) {
    const x = spineAt(t, f), y = edgeAt(t, f, -0.45);
    s.dot(x, y, [8, 18, 22], 1);
    s.dot(x - s.texel, y, MINT, 0.8);
  }
}

/** Galvanic Cells: the lateral line become a crooked live wire, lit where it bends. */
export function galvanicLine(s: Sheet, f: Form) {
  let prev: Pt | null = null;
  for (let i = 0, t = 0.3; t <= 0.76; t += 0.065, i++) {
    const at: Pt = [spineAt(t, f), edgeAt(t, f, i % 2 ? 0.18 : -0.18)];
    if (prev) {
      const n = Math.max(2, Math.round(Math.hypot(at[0] - prev[0], at[1] - prev[1]) * s.res));
      for (let k = 0; k <= n; k++) {
        s.dot(prev[0] + (at[0] - prev[0]) * k / n, prev[1] + (at[1] - prev[1]) * k / n, LILAC, 0.85);
      }
    }
    prev = at;
  }
  s.light(spineAt(0.3, f), edgeAt(0.3, f, -0.18), LILAC, 0.5);
}

/** Vent Gland: sulphur glands on the gill cover, hot enough to glow. */
export function ventGlands(s: Sheet, f: Form) {
  const t = 0.24;
  const w = halfWidth(t, f);
  for (const [dt, e] of [[0, -0.2], [0.03, 0.15], [-0.02, 0.4]]) {
    s.blot(spineAt(t + dt, f), edgeAt(t + dt, f, e), w * 0.1, SULPHUR, 1, M.BODY);
  }
  s.light(spineAt(t, f), edgeAt(t, f, 0.05), SULPHUR, 0.6);
}

/**
 * Cavitation: a bladder of gas behind the gills, drawn as the bubble it fires — a pearl ring
 * with the body showing through it and a glint on its shoulder.
 */
export function cavityBladder(s: Sheet, f: Form) {
  const t = 0.33;
  const w = halfWidth(t, f);
  const x = spineAt(t, f), y = edgeAt(t, f, 0.05);
  const r = w * 0.3;
  const n = Math.max(8, Math.round(r * s.res * 6));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    s.dot(x + Math.cos(a) * r, y + Math.sin(a) * r, PEARL, 0.9);
  }
  s.dot(x - r * 0.4, y - r * 0.5, WHITE, 1);
}

/** Brood Pouch: a clutch of roe bulging the belly behind the throat, a seahorse's pouch. */
export function broodPouch(s: Sheet, f: Form) {
  for (let i = 0; i < 5; i++) {
    const t = 0.33 + i * 0.035;
    const w = halfWidth(t, f);
    const r = Math.max(s.texel, w * (0.16 + (i % 2) * 0.04));
    const x = spineAt(t, f), y = edgeAt(t, f, 0.92) + (i % 2) * r * 0.5;
    s.ellipse(x, y, r, r, M.BODY);
    s.blot(x, y, r, ROE, 0.9);
    s.dot(x + r * 0.3, y - r * 0.3, WHITE, 0.7);
  }
}

/** Brine Gland: rime standing up off the back, crystals of the brine the shots are chilled in. */
export function rime(s: Sheet, f: Form, seed: number) {
  for (let i = 0; i < 4; i++) {
    const t = 0.18 + i * 0.075;
    const w = halfWidth(t, f);
    const len = Math.max(s.texel * 2, w * (0.35 + ((seed + i * 5) % 3) * 0.1));
    const x = spineAt(t, f), y = edgeAt(t, f, -0.92);
    s.poly([[x - len * 0.25, y + s.texel], [x + len * 0.1, y - len], [x + len * 0.3, y + s.texel]], M.TOOTH);
    s.dot(x + len * 0.1, y - len + s.texel * 0.5, ICE, 1);
  }
}

/** Surface Halo: a ring of the surface's gold hung over the head, lit. */
export function halo(s: Sheet, f: Form, g: Genome) {
  const t = 0.12;
  const w = halfWidth(t, f);
  const cx = spineAt(t, f), cy = edgeAt(t, f, -1) - w * (1.1 + Math.min(1, g.halo - 1) * 0.15);
  const rx = w * 0.75, ry = Math.max(s.texel, w * 0.2);
  const n = Math.max(10, Math.round(rx * s.res * 5));
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  s.line(pts);
  for (const [x, y] of pts) s.dot(x, y, GOLD, 1);
  s.light(cx, cy + ry, GOLD, 0.8);
}

/**
 * Parietal Eye: the third eye on the crown that lampreys and tuataras keep, open — a dark
 * socket on the top of the head with a pale, lit lens in it, the multishot's mark.
 */
export function parietalEye(s: Sheet, f: Form) {
  // behind the eye and up on the crown, where it is clear of the eye and of the dorsal line
  const t = 0.17;
  const w = halfWidth(t, f);
  const x = spineAt(t, f), y = edgeAt(t, f, -0.7);
  const r = Math.max(s.texel * 1.2, w * 0.22);
  s.blot(x, y, r * 1.35, DARK, 1);
  s.blot(x, y, r * 0.8, GOLD, 1);
  s.dot(x + r * 0.3, y - r * 0.3, WHITE, 1);
  s.light(x, y, GOLD, 0.5);
}

/** Twin Spout: a second water sac behind the first, with its own line of water to the lip. */
export function twinSac(s: Sheet, f: Form) {
  const t = 0.23;
  const w = halfWidth(t, f);
  const x = spineAt(t, f), y = edgeAt(t, f, 0.62);
  s.blot(x, y, w * 0.3, WATER, 0.85, M.BODY);
  s.dot(x + w * 0.1, y - w * 0.12, PEARL, 0.9);
  const nose = spineAt(0.03, f), lip = edgeAt(0.04, f, 0.32);
  const n = Math.max(2, Math.round((nose - x) * s.res));
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    s.dot(x + (nose - x) * k, y + (lip - y) * k, WATER, 0.6);
  }
}

/**
 * Mouthbrooder: the throat let down into a pouch, the young showing through it — a pale bulge
 * under the jaw and the dark eyes of the fry packed in it, looking out.
 */
export function broodThroat(s: Sheet, f: Form) {
  const t = 0.12;
  const w = halfWidth(t, f);
  const x = spineAt(t, f), y = edgeAt(t, f, 0.78);
  const r = Math.max(s.texel * 1.5, w * 0.42);
  s.ellipse(x, y + r * 0.2, r, r * 0.8, M.BODY);
  s.blot(x, y + r * 0.2, r * 0.85, FRY, 0.55);
  for (const [dx, dy] of [[-0.45, 0.05], [0.05, 0.35], [0.4, -0.05]]) {
    s.dot(x + dx * r, y + r * 0.2 + dy * r, DARK, 1);
    s.dot(x + dx * r + s.texel, y + r * 0.2 + dy * r - s.texel, WHITE, 0.6);
  }
}
