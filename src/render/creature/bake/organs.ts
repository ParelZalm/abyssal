/**
 * Organ morphology on the body, side-on: spines and plates, claws and the stinging fringe,
 * and the marks of an active organ — electroplates, prickles, the ink sac. Each is a
 * mechanic in `sim/organs/` as well as a shape here; a stat with no visible consequence is
 * not how this game communicates.
 */
import { armourOf, type Genome } from '../../../content/genome';
import { edgeAt, halfWidth, shoulderAt, spineAt, R, type Form } from '../../../content/form';
import { fbm } from '../../../core/noise';
import { lerp } from '../../../core/util';
import { hasSynergy } from '../../../sim/organs';
import { tAt } from './body';
import { TOXIC, type DrawnEye } from './head';
import { rgbOf, type Palette, type RGB } from './palette';
import { M, type Pt, type Sheet } from './sheet';

/** Spines standing up out of the back. Count rides menace: evolving grows the weapon. */
export function spines(s: Sheet, f: Form, g: Genome, men: number) {
  const n = Math.min(7, Math.round(men * 4 + g.spikes * 1.4));
  for (let i = 0; i < n; i++) {
    const t = 0.3 + (i / Math.max(1, n)) * 0.4;
    const w = halfWidth(t, f);
    const len = Math.max(s.texel * 2, w * (0.35 + men * 0.5) * (1 - i * 0.06));
    const x = spineAt(t, f), y = edgeAt(t, f, -1);
    s.poly([[x + len * 0.18, y + s.texel], [x - len * 0.35, y - len], [x - len * 0.3, y + s.texel]], M.FIN);
    s.dot(x - len * 0.33, y - len + s.texel * 0.5, rgbOf(72, 0.2, 0.8), 0.9);
  }
}

/** Organs grown by mutation — the parts that make a build legible at a glance. */
export function organs(s: Sheet, f: Form, pal: Palette, g: Genome, club = false) {
  const reef: RGB = rgbOf(348, 0.45, 0.52);

  // coral: knobbed plates crusting the back, breaking the top of the outline
  for (let i = 0; i < g.coral; i++) {
    for (let k = 0; k < 5; k++) {
      const t = 0.28 + k * 0.1 + i * 0.03;
      const w = halfWidth(t, f);
      const r = w * (0.18 + ((k * 7 + i * 3) % 4) * 0.05);
      const x = spineAt(t, f), y = edgeAt(t, f, -0.85);
      s.ellipse(x, y, r, r * 0.8, M.BODY);
      s.blot(x, y, r, reef, 0.8);
      s.dot(x - r * 0.3, y - r * 0.4, [255, 220, 226], 0.5);
    }
  }

  // frill: stinging tentacles along the rear of the belly — unless they have let go and
  // trail behind, which is the Drifting Bloom and is painted under the body
  if (g.frill > 0 && !hasSynergy(g, 'driftingbloom')) {
    const n = Math.round(4 + g.frill * 2);
    for (let i = 0; i < n; i++) {
      const t = 0.62 + (i / Math.max(1, n - 1)) * 0.32;
      const x = spineAt(t, f), y = edgeAt(t, f, 1);
      const len = Math.max(s.texel * 2, R * (0.18 + g.frill * 0.08));
      const pts: Pt[] = [[x, y], [x - len * 0.4, y + len * 0.7], [x - len * 0.9, y + len]];
      s.line(pts);
      s.dot(pts[2][0], pts[2][1], pal.accent, 0.9);
    }
  }

  // claws: pincers under the head reaching forward — or, with the siphon behind them, the
  // mantis shrimp's club folded under the jaw, which is the Ballistic body
  if (club || hasSynergy(g, 'ballistic')) raptorials(s, f, pal, g);
  const vivisect = hasSynergy(g, 'vivisect');
  for (let i = 0; !hasSynergy(g, 'ballistic') && i < g.claws; i++) {
    const t = shoulderAt(f) * (0.75 - i * 0.12);
    const w = halfWidth(t, f);
    const len = Math.max(s.texel * 3, w * 0.95);
    const x = spineAt(t, f), y = edgeAt(t, f, 0.8);
    const tip: Pt = [x + len, y + len * 0.35];
    // two jaws opening forward: the lower one hooked up, the upper one straight
    s.poly([[x, y - len * 0.1], [x + len * 0.7, y - len * 0.05], tip, [x + len * 0.5, y + len * 0.1],
            [x + len * 0.1, y + len * 0.3]], M.TOOTH);
    s.poly([[x + len * 0.3, y + len * 0.25], [x + len * 0.95, y + len * 0.7], [x + len * 0.55, y + len * 0.4]], M.TOOTH);
    if (vivisect) {
      for (let j = 0; j < 4; j++) {
        const k = (j + 0.5) / 4;
        s.dot(lerp(x + len * 0.5, tip[0], k), lerp(y + len * 0.1, tip[1], k) + s.texel, pal.dark, 1);
      }
    }
  }

  // jet: a siphon under the peduncle, the only organ that points backwards. Drawn, it is rooted
  // where the painted one is, and inked for a Smoke Screen
  const jt = 0.84;
  if (g.jet > 0 && !s.mark(hasSynergy(g, 'smokescreen') ? 'smoke' : 'siphon', spineAt(jt, f) + halfWidth(jt, f),
                           edgeAt(jt, f, 0.9), { layer: 'under' })) {
    const t = jt;
    const w = halfWidth(t, f);
    const x = spineAt(t, f), y = edgeAt(t, f, 0.9);
    s.poly([[x + w, y - w * 0.3], [x - w * 0.8, y], [x - w * 0.8, y + w * 0.6], [x + w * 0.4, y + w * 0.4]], M.FIN);
    s.dot(x - w * 0.7, y + w * 0.3, pal.accent, 0.9);
    if (hasSynergy(g, 'smokescreen')) {
      // Smoke Screen: the ink duct opens into the siphon, and it is stained black from the
      // opening forward, thinning as it goes — decals only land on the body, so the smear
      // is on the siphon and not in the water behind it
      const n = Math.max(3, Math.round(w * 1.6 * s.res));
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const sx = x - w * (0.75 - k * 1.3), sy = y + w * (0.3 - k * 0.15);
        s.dot(sx, sy, INK, 1 - k * 0.5);
        if (k < 0.6) s.dot(sx, sy + s.texel, INK, 0.8 - k);
      }
      // black on the siphon's shaded underside barely reads; the sac's own sheen does
      s.dot(x - w * 0.75, y + w * 0.3 - s.texel, INK_SHEEN, 0.9);
    }
  }

  // venom: the sacs show through the flank as a bright patch
  if (g.venom > 0) {
    const t = 0.6;
    const w = halfWidth(t, f);
    const x = spineAt(t, f), y = edgeAt(t, f, 0.25);
    s.blot(x, y, w * 0.4, TOXIC, 0.4 + Math.min(0.35, g.venom * 0.1), M.BODY);
    if (hasSynergy(g, 'nematocyst')) {
      // capsules round the sac, and a duct forward to the gut: venom out, healing back in
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        s.dot(x + Math.cos(a) * w * 0.55, y + Math.sin(a) * w * 0.45, [236, 255, 200], 0.9);
      }
      const gut = spineAt(0.42, f);
      const n = Math.max(2, Math.round((x - gut) * s.res));
      for (let i = 0; i <= n; i++) s.dot(lerp(x, gut, i / n), y, TOXIC, 0.6);
    }
  }
}

/**
 * Ballistic: the mantis shrimp's raptorial club, folded — cocked along the underside of
 * the head from the shoulder to past the snout, ending in a heavy heel. Past the nose on
 * purpose: the heel is what lands, and it has to reach whatever you boost at first.
 */
function raptorials(s: Sheet, f: Form, pal: Palette, g: Genome) {
  const t0 = shoulderAt(f) * 0.9;
  const tip = spineAt(0, f) + ballisticReach(g);
  const y0 = edgeAt(t0, f, 0.85), y1 = edgeAt(0.05, f, 1);
  const heavy = 1 + Math.min(1, (g.claws - 1) * 0.35);
  const th = Math.max(s.texel, halfWidth(0.1, f) * 0.18 * heavy);
  s.poly([[spineAt(t0, f), y0 - th], [tip - th * 2, y1 - th], [tip, y1], [tip - th * 2, y1 + th * 1.4],
          [spineAt(t0, f), y0 + th]], M.TOOTH);
  s.blot(tip - th, y1, th * 1.3, pal.bone, 1);
}

/** How far past the nose the Ballistic heel reaches — shared with the strip bounds. */
export const ballisticReach = (g: Genome) => R * (0.22 + Math.min(1, (g.claws - 1) * 0.35) * 0.08);

/** Urchin thorn length as a multiple of the threshold plate, capped so a tank is not a starburst. */
export const urchinReach = (g: Genome) => Math.min(1.6, armourOf(g) / 11);

/**
 * Urchin: the spines stand in the plate. Thorns out of the whole back and belly, radiating
 * from the middle of the body the way an urchin's test does, so the animal is a pincushion
 * rather than a fish with a crest. Length rides the armour the recoil is paid in.
 */
export function urchinSpines(s: Sheet, f: Form, g: Genome, seed: number) {
  const reach = urchinReach(g);
  const cx = spineAt(0.5, f), cy = edgeAt(0.5, f, 0);
  for (let t = 0.12; t <= 0.9; t += 0.06) {
    for (const k of [-1, 1] as const) {
      const w = halfWidth(t, f);
      const x = spineAt(t, f), y = edgeAt(t, f, k);
      const a = Math.atan2(y - cy, (x - cx) * 0.6);
      const len = Math.max(s.texel * 2, w * 0.63 * reach * (0.7 + fbm(t * 31, k, seed + 211, 1) * 0.6));
      s.line([[x, y], [x + Math.cos(a) * len, y + Math.sin(a) * len]], M.TOOTH);
    }
  }
}

/**
 * Electric Organ: the electrocytes stacked in columns down the flank behind the head, as the
 * torpedo ray's are — pale cells in a field the shock comes out of. On an Electric Eel the
 * field runs back to the tail, as the eel's organ fills four fifths of its length.
 */
export function electroplates(s: Sheet, f: Form, g: Genome) {
  const pale: RGB = [200, 232, 255];
  const step = Math.max(s.texel * 2, R * 0.08);
  const tail = hasSynergy(g, 'electriceel') ? 0.9 : 0.42;
  for (let x = spineAt(tail, f); x < spineAt(0.18, f); x += step) {
    const t = tAt(x, f);
    for (let k = -0.5; k <= 0.55; k += 0.35) {
      const off = (Math.round(x / step) % 2) * 0.17;
      s.dot(x, edgeAt(t, f, k + off), pale, 0.7);
    }
  }
}

/**
 * Inflation: the puffer's skin, stubbled with prickles that lie flat until it swells —
 * short pale thorns off the whole outline. With spines behind them they are the
 * porcupinefish's quills instead: three times as long, raked back, and spaced wider so each
 * stays one quill — at the prickles' spacing they merged into a dithered fringe.
 */
export function prickles(s: Sheet, f: Form, g: Genome, seed: number) {
  const quills = hasSynergy(g, 'porcupine');
  for (let t = 0.1; t < 0.9; t += quills ? 0.075 : 0.045) {
    for (const k of [-1, 1] as const) {
      if (fbm(t * 41, k, seed + 181, 1) < (quills ? 0.15 : 0.4)) continue;
      const x = spineAt(t, f), y = edgeAt(t, f, k);
      const len = Math.max(s.texel * 1.5, halfWidth(t, f) * (quills ? 0.6 : 0.2));
      const tip: Pt = [x - (quills ? len * 0.55 : s.texel), y + k * len];
      s.line([[x, y], tip], M.TOOTH);
    }
  }
}

/**
 * Stonefish: warts along the back, each tipped in the venom sacs' green where a barb comes
 * through it. Knobs rather than spines, so the ridge reads as rock and the colour as a
 * warning; the camouflage blotches under them are already Lie in Wait's.
 */
export function stoneWarts(s: Sheet, f: Form, seed: number) {
  for (let t = 0.18; t < 0.82; t += 0.07) {
    const w = halfWidth(t, f);
    const n = fbm(t * 17, 5, seed + 331, 1);
    const r = Math.max(s.texel * 1.5, w * (0.18 + n * 0.12));
    const x = spineAt(t, f), y = edgeAt(t, f, -0.9);
    s.ellipse(x, y - r * 0.5, r, r * 0.9, M.BODY);
    s.dot(x, y - r * 1.3, TOXIC, 1);
    s.dot(x + s.texel, y - r * 1.3, TOXIC, 0.8);
  }
}

/**
 * Ink Sac: the dark sac on the gut, glossy, with a duct forward to where it fires — low on
 * the body, where a squid's sits under the mantle.
 */
/** The sac's ink, and the stain Smoke Screen leaves on the siphon: one black, a violet cast. */
const INK: RGB = [8, 6, 14];
/** The wet light on ink, which is what lets a black organ read against a dark flank. */
const INK_SHEEN: RGB = [120, 120, 150];

export function inkSac(s: Sheet, f: Form) {
  const t = 0.5;
  const w = halfWidth(t, f);
  const x = spineAt(t, f), y = edgeAt(t, f, 0.3);
  s.blot(x, y, w * 0.32, INK, 0.95, M.BODY);
  s.dot(x + w * 0.1, y - w * 0.15, INK_SHEEN, 0.8);
  const n = Math.max(2, Math.round(w * 0.8 * s.res));
  for (let i = 0; i <= n; i++) s.dot(x + (i / n) * w * 0.9, y + (i / n) * w * 0.2, [20, 16, 30], 0.8);
}

/** Archer Spit's water, the shot's own blue (`render/shots.ts`), and the wet light on it. */
const WATER: RGB = [120, 196, 240];
const WATER_SHEEN: RGB = [236, 250, 255];

/**
 * Archer Spit: the archerfish's throat — a pale sac of water held under the jaw, and the
 * groove in the roof of the mouth it is squeezed forward down, drawn as a line of the same
 * blue to the lips. Low and forward, where a shot comes from. On a drawn body it sits in the
 * throat behind the drawn eye (`eye`), with no groove: where the painted one goes the drawn eye
 * is, and the larva came out with a blue tear in it, and hung under the eye it was still a tear.
 */
export function spitSac(s: Sheet, f: Form, eye: DrawnEye | null = null) {
  const t = 0.17;
  const w = halfWidth(t, f);
  const r = eye ? eye.r * 0.38 : w * 0.36;
  const x = eye ? eye.x - eye.r * 1.55 : spineAt(t, f), y = eye ? eye.y + eye.r * 0.7 : edgeAt(t, f, 0.5);
  if (s.mark('spit', x, y, { layer: 'skin' })) return;
  s.blot(x, y, r, WATER, 0.85, M.BODY);
  s.dot(x + r * 0.33, y - r * 0.4, WATER_SHEEN, 0.9);
  if (eye) return;
  const nose = spineAt(0.02, f), lip = edgeAt(0.04, f, 0.15);
  const n = Math.max(2, Math.round((nose - x) * s.res));
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    s.dot(x + (nose - x) * k, y + (lip - y) * k, WATER, 0.7);
  }
}

/**
 * Spine Volley: a rack of loose quills along the back, longer than the dorsal spines and
 * raked back flat, each with a pale point — spines that are not fixed in the body but set to
 * be thrown. Drawn over the ordinary spines, so a volley body reads as the pufferfish's
 * weapon and not as more armour.
 */
export function volleyQuills(s: Sheet, f: Form) {
  for (let i = 0; i < 5; i++) {
    const t = 0.3 + i * 0.075;
    const w = halfWidth(t, f);
    const x = spineAt(t, f), y = edgeAt(t, f, -0.95);
    const len = Math.max(s.texel * 3, w * 1.05);
    const tip: Pt = [x - len * 0.8, y - len * 0.5];
    s.line([[x, y], tip], M.TOOTH);
    s.dot(tip[0], tip[1], [255, 246, 226], 1);
  }
}

/**
 * A crustacean's armour: the trunk in plates, each seam a dark line across the body with the
 * next plate's edge lit behind it, from the head back to the tail fan — six to nine of them,
 * more with more segments, so a mantis shrimp reads as jointed and not as a fish.
 */
export function armourBands(s: Sheet, f: Form, pal: Palette, segments: number) {
  const n = Math.round(6 + Math.min(3, segments * 0.75));
  const t0 = 0.16, t1 = 0.9;
  for (let i = 1; i <= n; i++) {
    const t = t0 + (i / (n + 1)) * (t1 - t0);
    const x = spineAt(t, f);
    const steps = Math.max(3, Math.round(halfWidth(t, f) * 2 * s.res));
    for (let k = 0; k <= steps; k++) {
      const e = -0.95 + (k / steps) * 1.9;
      s.dot(x, edgeAt(t, f, e), pal.ramp[1], 0.85);
      s.dot(x - s.texel, edgeAt(t, f, e), pal.ramp[Math.min(pal.ramp.length - 1, 5)], 0.5);
    }
  }
}
