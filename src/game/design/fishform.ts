/**
 * PROTOTYPE — the shape playground.
 *
 * The game builds a creature's form from its plan and genome (`form.ts`, `fishbake.ts`).
 * This exists to drive those same parameters by hand: what `fore` and `aft` do to a
 * silhouette, what a life stage is as a parameter drift, what a line weight of zero buys.
 * It shares the geometry with the game on purpose — a playground that has drifted from
 * what ships answers questions about itself instead of about the game.
 *
 * Nothing here is imported by the game.
 */
import { Container, Graphics, MeshSimple, type Renderer, type Texture } from 'pixi.js';
import { halfWidth, quintic, R, shoulderAt, spineAt, type Form } from '../form';
import { fbm, fbmSigned } from '../noise';
import { hsl, lerp } from '../util';

export type { Form } from '../form';
export { halfWidth, shoulderAt, spineAt } from '../form';

/** The baseline this board explores around — the game's darter, give or take. */
export const SPINDLE: Form = {
  len: 2.2, width: 0.6, fore: 0.85, aft: 1.3, peduncle: 0.15, cheek: 0.1,
  fluke: 0.34, fork: 0.55,
};

/**
 * Sample one flank and lay it down as a smooth path, nudged by noise. Kept local rather
 * than shared with `fishbake.ts`: this one is here to be edited.
 */
function flank(gr: Graphics, f: Form, t0: number, t1: number, dir: -1 | 1, n: number,
               move: boolean, ox = 0, wob = 0, seed = 0) {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = lerp(t0, t1, i / n);
    const w = halfWidth(t, f);
    const k = 1 + fbmSigned(t * 7, dir * 3.7, seed) * wob * (1 - Math.abs(t * 2 - 1) * 0.35);
    pts.push({ x: spineAt(t, f) - ox, y: w * k * dir });
  }
  if (move) gr.moveTo(pts[0].x, pts[0].y);
  else gr.lineTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    gr.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2,
                        (pts[i].y + pts[i + 1].y) / 2);
  }
  const last = pts[pts.length - 1];
  gr.lineTo(last.x, last.y);
}

export interface FormSpec {
  /** Edge irregularity, as a fraction of local half-width. Past ~0.1 it stops being a fish. */
  wobble: number;
  /** Mottling strength — the speckle that stands in for texture now that there is no line. */
  grain: number;
  /** Pectorals, pelvics, caudal, eyes, mouth, gill cover. */
  detail: boolean;
  /** Countershading: the dark back a fish shows to anything above it. */
  dorsal: boolean;
  hue: number;
  /** Everything noisy on this animal comes off this seed, so a fish is always itself. */
  seed: number;
}


export const DEFAULT_FORM_SPEC: FormSpec = {
  wobble: 0.035, grain: 1, detail: true, dorsal: true, hue: 196, seed: 7,
};

/**
 * The renderer, needed once per fish to bake its art into a texture. Set from `main.ts`.
 * A prototype-grade seam: the real game would hand this in.
 */
let renderer: Renderer | null = null;
export function setFormRenderer(r: Renderer) {
  renderer = r;
}

/** Columns along the body. 28 is past the point where more stops changing the curve. */
const COLS = 28;
/** How many full waves of the swimming undulation fit on the body at once. */
const WAVES = 0.85;

/**
 * The fish as one continuous surface.
 *
 * The art is painted flat, once, into a texture: outline, countershading, mottle, caudal,
 * head marks. That texture is then skinned onto a triangle strip whose centre line is a
 * travelling wave. Bending it moves vertices, never geometry, so there are no sections to
 * overlap, no z-order to get right, and nothing that can draw twice — the objection to the
 * sectioned version was correct and unfixable, because two rigid pieces sharing a boundary
 * always show it the moment they rotate about different points.
 *
 * Cost per frame is 2 * COLS vertex writes. Nothing is re-tessellated and no path is re-issued.
 */
export class FishForm extends Container {
  private mesh: MeshSimple | null = null;
  private finL = new Graphics();
  private finR = new Graphics();
  private verts = new Float32Array(0);
  /** Column x positions in the straight body, nose first. */
  private colX: number[] = [];
  private halfH = 0;
  private form: Form = SPINDLE;
  private spec: FormSpec = DEFAULT_FORM_SPEC;
  private skin = 0;
  private back = 0;
  private belly = 0;
  private finAt = { s: 0.3, y: 0 };
  private tex: Texture | null = null;

  constructor(form: Form, spec: Partial<FormSpec> = {}, private scale_ = 1) {
    super();
    this.addChild(this.finL, this.finR);
    this.rebuild(form, spec);
  }

  rebuild(form: Form, spec: Partial<FormSpec> = {}) {
    this.form = form;
    const given = Object.fromEntries(
      Object.entries(spec).filter(([, v]) => v !== undefined)) as Partial<FormSpec>;
    this.spec = { ...DEFAULT_FORM_SPEC, ...given };
    const f = this.form;

    const h = this.spec.hue;
    this.skin = hsl(h, 0.24, 0.34);
    this.back = hsl(h + 10, 0.4, 0.13);
    this.belly = hsl(h - 14, 0.18, 0.62);

    this.finL.clear();
    this.finR.clear();
    this.mesh?.destroy();
    this.tex?.destroy(true);

    // the strip has to be tall enough to hold the widest part AND the caudal spread, since
    // the texture is mapped at one constant half-height from nose to tail
    let widest = 0;
    for (let i = 0; i <= 40; i++) widest = Math.max(widest, halfWidth(i / 40, f));
    const caudalSpread = halfWidth(1, f) * (2.4 + f.fork * 1.8);
    this.halfH = Math.max(widest * (1 + this.spec.wobble), caudalSpread) * 1.06;

    const nose = spineAt(0, f);
    const tailEnd = spineAt(1, f) - f.len * f.fluke * R * 1.02;
    this.tex = this.bake(f, nose, tailEnd);

    // one quad per column pair, built once and never touched again
    const verts = new Float32Array(COLS * 4);
    const uvs = new Float32Array(COLS * 4);
    const idx = new Uint32Array((COLS - 1) * 6);
    this.colX = [];
    for (let j = 0; j < COLS; j++) {
      const s = j / (COLS - 1);
      const x = lerp(nose, tailEnd, s);
      this.colX.push(x);
      // u runs with the TEXTURE's x, which increases to the right, while the columns run
      // nose to tail, which decreases. Reading s straight into u mirrors the fish.
      const u = (x - tailEnd) / (nose - tailEnd);
      uvs[j * 4] = u; uvs[j * 4 + 1] = 0;
      uvs[j * 4 + 2] = u; uvs[j * 4 + 3] = 1;
      if (j < COLS - 1) {
        const a = j * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.set([a, c, b, b, c, d], j * 6);
      }
    }
    this.verts = verts;
    this.mesh = new MeshSimple({ texture: this.tex, vertices: verts, uvs, indices: idx });
    this.addChild(this.mesh);

    if (this.spec.detail) this.pectorals(f);
    this.pose(0, 0);
    this.scale.set(this.scale_);
  }

  /** Paint the straight fish once and hand back a texture of it. */
  private bake(f: Form, nose: number, tailEnd: number): Texture {
    const art = new Graphics();
    // an invisible rect fixes the bounds, so the texture covers exactly the strip's rect and
    // the UVs line up with the body instead of with whatever the art happened to touch
    art.rect(tailEnd, -this.halfH, nose - tailEnd, this.halfH * 2)
      .fill({ color: 0x000000, alpha: 0 });

    if (this.spec.detail) this.caudal(art, f);
    this.bodyFill(art, f);
    if (this.spec.dorsal) this.dorsalBand(art, f);
    if (this.spec.grain) this.mottle(art, f);
    if (this.spec.detail) this.head(art, f);

    if (!renderer) throw new Error('setFormRenderer() must be called before building a fish');
    const tex = renderer.generateTexture({ target: art, resolution: 16, antialias: true });
    art.destroy();
    return tex;
  }

  /** The silhouette: both flanks, one fill, no outline. */
  private bodyFill(gr: Graphics, f: Form) {
    const n = 90;
    const { wobble, seed } = this.spec;
    flank(gr, f, 0, 1, -1, n, true, 0, wobble, seed);
    flank(gr, f, 1, 0, 1, n, false, 0, wobble, seed);
    gr.closePath().fill({ color: this.skin, alpha: 1 });
  }

  /**
   * Countershading — the dark back that makes a shape read as a fish from above, and the
   * thing that carries the form now there is no line. Two passes, each bounded by its own
   * noise curve, so the back meets the flank along a ragged join rather than a drawn one.
   */
  private dorsalBand(gr: Graphics, f: Form) {
    const n = 90;
    const bands: [number, number, number][] = [
      [0.78, 0.3, 13],
      [0.44, 0.55, 29],
    ];
    for (const [k, alpha, salt] of bands) {
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const edge = fbmSigned(t * 13, salt * 0.11, this.spec.seed + salt) * 0.12;
        pts.push({ x: spineAt(t, f), y: halfWidth(t, f) * (k + edge) * (1 - t * 0.3) });
      }
      const run = (sign: 1 | -1, list: { x: number; y: number }[]) => {
        for (let i = 1; i < list.length - 1; i++) {
          const mid = { x: (list[i].x + list[i + 1].x) / 2, y: (list[i].y + list[i + 1].y) / 2 };
          gr.quadraticCurveTo(list[i].x, sign * list[i].y, mid.x, sign * mid.y);
        }
        const last = list[list.length - 1];
        gr.lineTo(last.x, sign * last.y);
      };
      gr.moveTo(pts[0].x, -pts[0].y);
      run(-1, pts);
      gr.lineTo(pts[n].x, pts[n].y);
      run(1, [...pts].reverse());
      gr.closePath().fill({ color: this.back, alpha });
    }
  }

  /** Mottling: the speckle that stands in for texture now that nothing is stroked. */
  private mottle(gr: Graphics, f: Form) {
    for (let t = 0; t < 1; t += 0.02) {
      const w = halfWidth(t, f);
      const rows = Math.max(3, Math.round(w / (R * 0.11)));
      for (let j = 0; j < rows; j++) {
        const v = (j + 0.5) / rows;
        const y = (v * 2 - 1) * w * 0.94;
        const d = fbm(t * 16, v * 9, this.spec.seed + 101);
        if (d < 0.58) continue;
        const r = R * 0.035 * (0.6 + d) * this.spec.grain;
        // dark over the spine, pale toward the belly: one pass reads as scale on top and as
        // counter-lighting at the edge
        const dark = Math.abs(y) < w * 0.55;
        gr.ellipse(spineAt(t, f), y, r * 1.5, r)
          .fill({ color: dark ? this.back : this.belly, alpha: dark ? 0.22 : 0.16 });
      }
    }
  }

  /** The caudal fin, painted into the same texture so it bends with the body that drives it. */
  private caudal(gr: Graphics, f: Form) {
    const x = spineAt(1, f);
    const w = halfWidth(1, f);
    const len = f.len * f.fluke * R;
    const spread = w * (2.4 + f.fork * 1.8);
    const notch = len * (0.18 + f.fork * 0.42);
    gr.moveTo(x + w * 1.6, -w * 0.9)
      .quadraticCurveTo(x - len * 0.5, -spread * 0.72, x - len, -spread)
      .quadraticCurveTo(x - len + notch * 0.7, -spread * 0.3, x - len + notch, 0)
      .quadraticCurveTo(x - len + notch * 0.7, spread * 0.3, x - len, spread)
      .quadraticCurveTo(x - len * 0.5, spread * 0.72, x + w * 1.6, w * 0.9)
      .closePath()
      .fill({ color: this.skin, alpha: 0.88 });
    for (let i = -3; i <= 3; i++) {
      const v = i / 3;
      const ty = spread * v * 0.82;
      const tx = x - len * (1 - Math.abs(v) * 0.24) + notch * (1 - Math.abs(v)) * 0.8;
      gr.moveTo(x, 0).lineTo(tx, ty).lineTo(tx, ty + spread * 0.06)
        .closePath().fill({ color: this.back, alpha: 0.18 });
    }
  }

  /** Eyes, mouth, gill cover and pelvics — fills, since there are no lines on this animal. */
  private head(gr: Graphics, f: Form) {
    const peak = shoulderAt(f);

    const tm = 0.05;
    const mw = halfWidth(tm, f);
    gr.moveTo(spineAt(tm * 0.2, f), -mw * 0.7)
      .quadraticCurveTo(spineAt(tm * 1.9, f), 0, spineAt(tm * 0.2, f), mw * 0.7)
      .quadraticCurveTo(spineAt(tm * 0.1, f), 0, spineAt(tm * 0.2, f), -mw * 0.7)
      .closePath().fill({ color: this.back, alpha: 0.75 });

    const te = peak * 0.42;
    const r = Math.max(R * 0.06, halfWidth(te, f) * 0.2);
    for (const dir of [-1, 1]) {
      const y = dir * halfWidth(te, f) * 0.64;
      gr.circle(spineAt(te, f), y, r).fill({ color: 0x0b0d14, alpha: 0.95 });
      gr.circle(spineAt(te, f) + r * 0.3, y - r * 0.3, r * 0.3)
        .fill({ color: 0xeaf4f6, alpha: 0.75 });
    }

    const tg = peak * 0.95;
    for (const dir of [-1, 1]) {
      gr.moveTo(spineAt(tg - 0.07, f), dir * halfWidth(tg - 0.07, f) * 0.98)
        .quadraticCurveTo(spineAt(tg + 0.03, f), dir * halfWidth(tg, f) * 0.5,
                          spineAt(tg + 0.1, f), dir * halfWidth(tg + 0.1, f) * 0.96)
        .quadraticCurveTo(spineAt(tg + 0.02, f), dir * halfWidth(tg, f) * 0.78,
                          spineAt(tg - 0.07, f), dir * halfWidth(tg - 0.07, f) * 0.98)
        .closePath().fill({ color: this.back, alpha: 0.4 });
    }

    // pelvics ride the body, so they are painted in rather than hung off it
    const tp = 0.56;
    const plen = halfWidth(tp, f) * 0.62;
    for (const dir of [-1, 1] as const) {
      const x = spineAt(tp, f), y = halfWidth(tp, f) * dir * 0.7;
      gr.moveTo(x, y)
        .quadraticCurveTo(x - plen * 0.1, y + dir * plen * 0.5, x - plen * 0.78,
                          y + dir * plen * 0.8)
        .quadraticCurveTo(x - plen * 0.6, y + dir * plen * 0.16, x, y)
        .closePath().fill({ color: this.back, alpha: 0.55 });
    }
  }

  /** The one pair that moves on its own, so they stay separate objects riding the spine. */
  private pectorals(f: Form) {
    const t = shoulderAt(f) * 1.15;
    const len = halfWidth(t, f) * 0.78;
    for (const [fin, dir] of [[this.finL, -1], [this.finR, 1]] as const) {
      fin.moveTo(0, 0)
        .quadraticCurveTo(-len * 0.1, dir * len * 0.5, -len * 0.78, dir * len * 0.8)
        .quadraticCurveTo(-len * 0.6, dir * len * 0.16, 0, 0)
        .closePath().fill({ color: this.back, alpha: 0.62 });
    }
    // where on the body they sit, as a fraction of the strip
    const nose = this.colX[0], tail = this.colX[this.colX.length - 1];
    this.finAt = { s: (spineAt(t, f) - nose) / (tail - nose), y: halfWidth(t, f) * 0.66 };
  }

  /**
   * Lay the strip along the spine for this instant. The centre line is a travelling wave
   * under a quintic envelope; every vertex is that line plus the strip's constant half-height
   * along the local normal, so the texture keeps its proportions through the bend.
   */
  private pose(beat: number, bank: number) {
    if (!this.mesh) return;
    const n = this.colX.length;
    const spine: { x: number; y: number }[] = [];
    for (let j = 0; j < n; j++) {
      const s = j / (n - 1);
      const amp = this.halfH * 0.5 * quintic(s);
      spine.push({
        x: this.colX[j],
        y: Math.sin(s * WAVES * Math.PI * 2 - beat) * amp + bank * quintic(s) * this.halfH * 0.3,
      });
    }
    for (let j = 0; j < n; j++) {
      const p = spine[j];
      const a = spine[Math.max(0, j - 1)], b = spine[Math.min(n - 1, j + 1)];
      // the normal comes from the neighbours, which is what keeps the width perpendicular to
      // the curve instead of to the axis — the difference between a fish and a bent sprite
      const dx = b.x - a.x, dy = b.y - a.y;
      const l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l, ny = dx / l;
      this.verts[j * 4] = p.x + nx * this.halfH;
      this.verts[j * 4 + 1] = p.y + ny * this.halfH;
      this.verts[j * 4 + 2] = p.x - nx * this.halfH;
      this.verts[j * 4 + 3] = p.y - ny * this.halfH;
    }
    this.mesh.vertices = this.verts;

    // the pectorals ride the same curve rather than a fixed point on a straight body
    const fj = Math.min(n - 2, Math.max(1, Math.round(this.finAt.s * (n - 1))));
    const p = spine[fj];
    const dx = spine[fj + 1].x - spine[fj - 1].x, dy = spine[fj + 1].y - spine[fj - 1].y;
    const ang = Math.atan2(dy, dx);
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    const flap = Math.sin(beat) * 0.3;
    for (const [fin, dir] of [[this.finL, -1], [this.finR, 1]] as const) {
      fin.x = p.x + nx * this.finAt.y * dir;
      fin.y = p.y + ny * this.finAt.y * dir;
      fin.rotation = ang - flap - bank * 0.3;
    }
  }

  animate(dt: number, beat: number, bank: number) {
    void dt;
    this.pose(beat, bank);
  }
}
