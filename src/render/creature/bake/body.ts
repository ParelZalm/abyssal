/**
 * The trunk and its surface, side-on: the flank itself, markings and what shows through a
 * see-through body. Countershading and speckle are not painted here — the shader derives
 * them from the palette (`sheet.ts`), so they cannot disagree with the body they sit on.
 */
import { edgeAt, halfWidth, shoulderAt, spineAt, R, type Form } from '../../../content/form';
import { fbm, fbmSigned } from '../../../core/noise';
import { lerp, TAU } from '../../../core/util';
import type { Palette, RGB } from './palette';
import { M, type Pt, type Sheet } from './sheet';

/** The t of a column's centre, from its x in R units. Inverse of `spineAt`. */
export const tAt = (x: number, f: Form) => (f.len * 0.52 * R - x) / (f.len * R);

/**
 * The flank, one pixel column at a time. The edge is nudged by the same noise the water
 * runs on, by up to `wob` of the local depth — which is what keeps a parametric curve from
 * reading as machinery.
 */
export function flank(s: Sheet, f: Form, wob: number, seed: number) {
  const layer = s.next();
  const x0 = Math.floor(s.px(spineAt(1, f))), x1 = Math.ceil(s.px(spineAt(0, f)));
  for (let ix = x0; ix < x1; ix++) {
    const t = tAt(s.rx(ix), f);
    if (t < 0 || t > 1) continue;
    const h = halfWidth(t, f);
    const k = wob * (1 - Math.abs(t * 2 - 1) * 0.35);
    const top = s.py(edgeAt(t, f, -1) + fbmSigned(t * 7, 3.7, seed) * k * h);
    const bot = s.py(edgeAt(t, f, 1) + fbmSigned(t * 7, -3.7, seed) * k * h);
    s.column(ix, top, bot);
    for (let iy = Math.floor(top); iy <= Math.ceil(bot); iy++) {
      if (iy + 0.5 >= top && iy + 0.5 <= bot) s.set(ix, iy, M.BODY, 0, layer);
    }
    // a body thinner than a texel is still one texel, or a whip tail breaks into dashes
    // wherever its depth falls between two pixel centres
    if (bot - top < 1) s.set(ix, (top + bot) / 2, M.BODY, 0, layer);
  }
}

/** A shape laid over the body that is part of it: taken into the light pass's columns. */
export function mass(s: Sheet, pts: Pt[]) {
  s.poly(pts, M.BODY);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  for (let ix = Math.floor(s.px(x0)); ix <= Math.ceil(s.px(x1)); ix++) s.column(ix, s.py(y0), s.py(y1));
}

/**
 * Scales (`PlanArt.scales`): rows of them across the flank behind the head, each one's free
 * edge a dark arc bowed toward the tail, every other row offset by half. Each arc is walked a
 * texel at a time, so it reads as a line and not as a dotted screen. Painted last, and only
 * on bare flank — not through a fin, the jaw or anything lit — so the shading under them
 * still models the body. Below three texels a scale they are only noise, and are left off.
 */
export function scales(s: Sheet, f: Form, pal: Palette) {
  const size = halfWidth(shoulderAt(f), f) * 0.36;
  if (size * s.res < 3) return;
  const rowH = size * 0.75, r = size * 0.6;
  const steps = Math.max(4, Math.ceil(r * Math.PI * s.res));
  const x0 = spineAt(0.94, f), x1 = spineAt(0.26, f);
  for (let row = Math.floor(-s.halfH / rowH); row * rowH < s.halfH; row++) {
    const cy = (row + 0.5) * rowH;
    const off = row & 1 ? size * 0.5 : 0;
    for (let cx = Math.floor(x0 / size) * size + off; cx < x1; cx += size) {
      for (let i = 0; i <= steps; i++) {
        const a = Math.PI * (0.5 + i / steps);
        const ix = Math.floor(s.px(cx + Math.cos(a) * r)), iy = Math.floor(s.py(cy + Math.sin(a) * r));
        const j = iy * s.w + ix;
        if (s.get(ix, iy) !== M.BODY || s.decal.has(j)) continue;
        const t = tAt(s.rx(ix), f);
        if (t < 0.26 || t > 0.94) continue;
        s.dotPx(ix, iy, pal.ramp[1], 0.55);
      }
    }
  }
}

/**
 * Whale Shark: pale spots across the back, in rows broken by lighter bars — the pattern that
 * says whale shark from any distance. Only on the upper flank, in the dark of the back,
 * where the real animal's are.
 */
export function whaleSpots(s: Sheet, f: Form, seed: number) {
  const spot: RGB = [226, 222, 196];
  const step = Math.max(s.texel * 2.5, 0.045 * f.len * R);
  for (let x = spineAt(0.9, f); x < spineAt(0.1, f); x += step) {
    const t = tAt(x, f);
    const top = edgeAt(t, f, -1), mid = edgeAt(t, f, 0);
    for (let j = 0; j < 3; j++) {
      const k = 0.2 + j * 0.28;
      const jit = fbm(t * 37, j * 23, seed + 223, 1);
      s.blot(x + (jit - 0.5) * step * 0.5, lerp(top, mid, k), halfWidth(t, f) * 0.06, spot, 0.85);
    }
  }
}

/**
 * Lie in Wait: a bottom-dweller's disruptive coat, and the fringe that breaks its outline.
 * Blotches rather than speckle — camouflage works by breaking up the shape, so the patches
 * have to be large enough to cross the silhouette's edge — and tassels of skin under the
 * jaw, the wobbegong's beard, so the front of the animal has no clean line.
 */
export function camouflage(s: Sheet, f: Form, pal: Palette, seed: number) {
  for (let t = 0.08; t < 0.96; t += 0.05) {
    const w = halfWidth(t, f);
    for (let j = 0; j < 3; j++) {
      const d = fbm(t * 9, j * 4, seed + 151);
      if (d < 0.5) continue;
      const dark = fbm(t * 5, j * 3, seed + 157) > 0.5;
      s.blot(spineAt(t, f), edgeAt(t, f, -0.8 + j * 0.8), w * (0.25 + (d - 0.5) * 0.8),
             dark ? pal.ramp[1] : pal.ramp[4], dark ? 0.7 : 0.45, M.BODY);
    }
  }
  for (let i = 0; i < 6; i++) {
    const t = 0.03 + i * 0.045;
    const x = spineAt(t, f), y = edgeAt(t, f, 1);
    const len = halfWidth(t, f) * (0.3 + fbm(t * 23, 1, seed + 163) * 0.3);
    s.poly([[x + len * 0.3, y - s.texel], [x, y + len], [x - len * 0.3, y - s.texel]], M.BODY);
  }
}

/**
 * Brittle Frame: the skin is crazed like fired glass — pale slivers across the flank, each
 * a short diagonal at its own angle, so the body reads as something already breaking.
 */
export function crazing(s: Sheet, f: Form, seed: number) {
  const pale: RGB = [236, 244, 234];
  for (let t = 0.12; t < 0.86; t += 0.05) {
    const n = fbm(t * 19, 3, seed + 251, 1);
    if (n < 0.3) continue;
    const x = spineAt(t, f), y = edgeAt(t, f, (n - 0.5) * 1.4);
    const a = (n - 0.5) * 2.4 + 0.6, len = halfWidth(t, f) * (0.4 + n * 0.5);
    const steps = Math.max(2, Math.round(len * s.res));
    for (let i = 0; i <= steps; i++) {
      const k = i / steps - 0.5;
      s.dot(x + Math.cos(a) * len * k, y + Math.sin(a) * len * k, pale, 0.85);
    }
  }
}

/**
 * Open Veins: the blood runs close under the skin — dark red veins branching back along the
 * flank from the gills, each a wandering line of single texels, so the body reads as one
 * that will bleed. Low on the flank and thin on purpose: a cursed mark, not a wound.
 */
export function veins(s: Sheet, f: Form, seed: number) {
  const red: RGB = [150, 22, 34];
  for (let v = 0; v < 3; v++) {
    const t0 = 0.24 + v * 0.05;
    const steps = Math.max(4, Math.round((spineAt(t0, f) - spineAt(0.8, f)) * s.res));
    for (let i = 0; i <= steps; i++) {
      const t = lerp(t0, 0.8 - v * 0.08, i / steps);
      const k = 0.05 + v * 0.22 + fbmSigned(t * 9, v * 3.1, seed + 307) * 0.18;
      s.dot(spineAt(t, f), edgeAt(t, f, k), red, 0.85);
    }
  }
}

/**
 * Leaden Bones: a keel of dull grey plates down the belly, the ballast showing through — the
 * only mark on the animal that sits on its underside, because that is where the weight is.
 * A dim highlight on each keeps them bone and not a shadow on a dark flank.
 */
export function ballast(s: Sheet, f: Form) {
  const lead: RGB = [62, 66, 76], sheen: RGB = [148, 152, 164];
  for (let t = 0.2; t < 0.8; t += 0.075) {
    const w = halfWidth(t, f);
    const x = spineAt(t, f), y = edgeAt(t, f, 0.78);
    const r = Math.max(s.texel, w * 0.2);
    s.blot(x, y, r, lead, 0.95, M.BODY);
    s.dot(x + r * 0.3, y - r * 0.4, sheen, 0.7);
  }
}

/**
 * What shows through a body of smoke: a hard spine, ribs off it, and one opaque gut. These
 * are the only opaque things on the animal, which is what stops it reading as a pale blob —
 * a translucent shape with nothing inside it has no scale and no direction.
 */
export function viscera(s: Sheet, f: Form, pal: Palette) {
  const steps = Math.max(4, Math.round(f.len * R * s.res));
  for (let i = 0; i <= steps; i++) {
    const t = 0.12 + (i / steps) * 0.82;
    s.dot(spineAt(t, f), edgeAt(t, f, -0.1), pal.dark, 0.9);
  }
  for (let i = 0; i < 7; i++) {
    const t = 0.24 + i * 0.075;
    const x = spineAt(t, f);
    for (const k of [-0.55, -0.35, 0.2, 0.45]) {
      s.dot(x - Math.abs(k) * halfWidth(t, f) * 0.4, edgeAt(t, f, k), pal.dark, 0.6);
    }
  }
  // the gut: longer than it is deep, and not quite black — a flat disc of the darkest
  // value reads as a hole punched through the animal rather than as something inside it
  const tg = 0.42;
  const r = halfWidth(tg, f) * 0.26;
  for (const k of [-1, 0, 1]) s.blot(spineAt(tg, f) + k * r * 0.8, edgeAt(tg, f, 0.25), r, pal.ramp[2], 0.8);
}

/**
 * Mantle Pump: rings of muscle around the front of the body, and the funnel that fires. The
 * rings are what a squeeze is made of; the funnel sits under the head behind the eye,
 * pointing forward, because a mantle jet fires backwards by aiming its siphon the other way.
 */
export function mantle(s: Sheet, f: Form, pal: Palette) {
  for (let i = 0; i < 5; i++) {
    const t = 0.16 + i * 0.085;
    const x = spineAt(t, f);
    const y0 = s.py(edgeAt(t, f, -1)), y1 = s.py(edgeAt(t, f, 1));
    for (let iy = Math.floor(y0); iy <= y1; iy++) s.dotPx(Math.floor(s.px(x)), iy, pal.ramp[1], 0.45);
  }
  const tf = 0.3;
  const x = spineAt(tf, f), y = edgeAt(tf, f, 1);
  const w = halfWidth(tf, f);
  s.poly([[x - w * 0.5, y - w * 0.2], [x + w * 0.6, y - w * 0.1], [x + w * 0.6, y + w * 0.3],
          [x - w * 0.4, y + w * 0.15]], M.FIN);
  s.dot(x + w * 0.55, y + w * 0.1, pal.accent, 0.8);
}

/** A ring of cilia — the only thing that makes a single cell read as alive. */
export function cilia(s: Sheet, f: Form) {
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const t = 0.5 - Math.cos(a) * 0.48;
    const k = Math.sin(a) < 0 ? -1 : 1;
    const x = spineAt(t, f), y = edgeAt(t, f, k);
    const len = Math.max(s.texel * 1.5, R * 0.14);
    s.line([[x, y], [x - Math.cos(a) * len * 0.3, y + Math.sin(a) * len]]);
  }
}
