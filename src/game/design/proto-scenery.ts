/**
 * PROTOTYPE — biome-specific scenery as *fields*. THROWAWAY CODE, not imported by the game.
 *
 * The question was how a tier should be told apart by what is in its water, when today the
 * bands place four generic primitives everywhere and the biome only reweights them. Three
 * answers were drawn on this board; this file is the one that won, kept so the composition
 * can be tuned before any of it is folded into `scenery.ts`.
 *
 *   A · vocabulary — the same scatter with per-biome props. Read as confetti: more nouns,
 *       no more meaning, and it still filled the frame evenly.
 *   B · anchors — few enormous edge-anchored formations. Strongest identity, but they are
 *       painted at prop resolution and turn to mush enlarged, and they leave no open water.
 *   C · fields  — WON. One motif many times, gathered into a structure that moves as one,
 *       occupying part of the frame with water around it. Survives the fourfold zoom change
 *       for free, which is what killed the two earlier background attempts.
 *
 * The rule the tuning pass added: **a field is a thing in the water, not a texture on it.**
 * Every tier is one localised structure plus open water to swim through — the Abyss column
 * was already that and was the only cell that read; the other four were fields spread wall
 * to wall, which is just noise with a biome's colour on it.
 *
 * It borrows the shipping rules — soft shapes, blur baked at boot, nothing stroked, contrast
 * flipping to emission below the twilight — so the comparison stays honest. Placement is its
 * own; the real bands are untouched.
 */
import { Container, Sprite, Texture } from 'pixi.js';
import { blurred } from '../props';
import { shadeFor } from '../scenery';
import { hash01 as h, lerp, Rng, TAU } from '../util';
import { lightAt } from '../water';

/** The patch every tier composes into — read it as one screen of water. */
export const PROTO_W = 1000;
export const PROTO_H = 700;

// ------------------------------------------------------------------ painting

const SRC = 256;
const cache = new Map<string, Texture>();

interface Sample { x: number; y: number; w: number }

/**
 * A closed shape swept along a centreline. Every prop here is built from these rather
 * than stroked paths — a stroke has a position of its own and doubles up where parts
 * cross, which is the rule the creature art already lives under.
 */
function band(ctx: CanvasRenderingContext2D, pts: Sample[], a: number) {
  const n = pts.length;
  const nx: Sample[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(n - 1, i + 1)];
    const dx = p1.x - p0.x, dy = p1.y - p0.y;
    const L = Math.hypot(dx, dy) || 1;
    nx.push({ x: -dy / L, y: dx / L, w: 0 });
  }
  ctx.beginPath();
  ctx.moveTo(pts[0].x + nx[0].x * pts[0].w, pts[0].y + nx[0].y * pts[0].w);
  for (let i = 1; i < n; i++) ctx.lineTo(pts[i].x + nx[i].x * pts[i].w, pts[i].y + nx[i].y * pts[i].w);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(pts[i].x - nx[i].x * pts[i].w, pts[i].y - nx[i].y * pts[i].w);
  ctx.closePath();
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.fill();
}

function soft(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,255,255,${a})`);
  g.addColorStop(0.55, `rgba(255,255,255,${a * 0.42})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

type Params = Record<string, number>;
type Paint = (ctx: CanvasRenderingContext2D, s: number, p: Params) => void;
/** The shapes a field can be built from; `PAINT` holds one painter per name. */
type PaintKind = 'ribbon' | 'chain' | 'branch' | 'stack' | 'cluster' | 'bell';

/** A blade or frond: rooted at the bottom, curling, tapering to nothing. */
const paintRibbon: Paint = (ctx, s, p) => {
  const pts: Sample[] = [];
  for (let i = 0; i <= 26; i++) {
    const t = i / 26;
    pts.push({
      x: s * 0.5 + Math.sin(t * p.curl) * s * 0.2 * t,
      y: s * (0.97 - t * 0.94),
      // the root is thin too — a blade that meets the floor at full width reads as a wall
      w: s * p.wide * (1 - p.taper * t) * Math.sin(Math.min(1, t * 3.2 + 0.12) * Math.PI * 0.5),
    });
  }
  band(ctx, pts, 0.42);
  band(ctx, pts.map(q => ({ ...q, w: q.w * 0.28 })), 0.4);
};

/** A strand with beads on it: bubble string, marine snow, siphonophore. */
const paintChain: Paint = (ctx, s, p) => {
  const line: Sample[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    line.push({ x: s * 0.5 + Math.sin(t * p.wave) * s * 0.13, y: s * (0.96 - t * 0.92), w: s * 0.006 });
  }
  band(ctx, line, 0.3);
  const n = Math.round(p.nodes);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = s * 0.5 + Math.sin(t * p.wave) * s * 0.13;
    const y = s * (0.96 - t * 0.92);
    const r = s * p.node * (1 + p.grow * (t - 0.5) * 2) * (0.75 + h(i * 31 + p.nodes) * 0.5);
    soft(ctx, x, y, r, 0.55);
    soft(ctx, x, y, r * 0.4, 0.85);
  }
};

/** A recursive fork: sea fan, tube worms. */
const paintBranch: Paint = (ctx, s, p) => {
  const twig = (x: number, y: number, ang: number, len: number, w: number, d: number, seed: number) => {
    const pts: Sample[] = [];
    const bend = (h(seed) - 0.5) * 0.9;
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const a = ang + bend * t;
      pts.push({ x: x + Math.cos(a) * len * t, y: y + Math.sin(a) * len * t, w: w * (1 - t * 0.55) });
    }
    band(ctx, pts, 0.34);
    const ex = x + Math.cos(ang + bend) * len, ey = y + Math.sin(ang + bend) * len;
    if (d <= 0) { soft(ctx, ex, ey, w * 2.4, p.tip); return; }
    const spread = p.spread * (0.7 + h(seed + 7) * 0.6);
    twig(ex, ey, ang + bend - spread, len * 0.72, w * 0.7, d - 1, seed * 3 + 1);
    twig(ex, ey, ang + bend + spread, len * 0.72, w * 0.7, d - 1, seed * 3 + 2);
  };
  const arms = Math.round(p.arms);
  for (let i = 0; i < arms; i++) {
    const a = -Math.PI / 2 + (i - (arms - 1) / 2) * p.fan;
    twig(s * 0.5, s * 0.97, a, s * p.len, s * p.thick, Math.round(p.depth), i * 13 + 5);
  }
};

/** A standing column: barrel sponge, vent chimney. */
const paintStack: Paint = (ctx, s, p) => {
  const pts: Sample[] = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    // lumped, not smooth — a clean cone reads as a traffic cone at any scale
    const lump = 1 + Math.sin(t * 9 + p.lean * 3) * 0.08;
    pts.push({
      x: s * 0.5 + Math.sin(t * p.lean) * s * 0.12,
      y: s * (0.98 - t * 0.9),
      w: s * p.wide * (1 - p.taper * t) * lump,
    });
  }
  band(ctx, pts, 0.42);
  const mx = s * 0.5 + Math.sin(p.lean) * s * 0.12;
  soft(ctx, mx, s * 0.09, s * 0.13, p.mouth);
};

/** Scattered motes: fry cloud, rubble, sparks, ember plume. */
const paintCluster: Paint = (ctx, s, p) => {
  const n = Math.round(p.n);
  for (let i = 0; i < n; i++) {
    const a = h(i * 17 + p.n) * TAU;
    const rr = Math.sqrt(h(i * 29 + 3)) * s * p.spread;
    const x = s * 0.5 + Math.cos(a) * rr;
    const y = s * 0.5 + Math.sin(a) * rr * p.squash;
    soft(ctx, x, y, s * p.r * (0.5 + h(i * 41) * 0.9), 0.62);
  }
};

/** A medusa: dome rings and trailing threads. */
const paintBell: Paint = (ctx, s, p) => {
  const cx = s * 0.5, cy = s * 0.36, r = s * 0.3;
  for (const k of [1, 0.76, 0.52]) {
    const pts: Sample[] = [];
    for (let i = 0; i <= 26; i++) {
      const a = Math.PI + (i / 26) * Math.PI;
      pts.push({ x: cx + Math.cos(a) * r * k, y: cy + Math.sin(a) * r * k * 0.92, w: s * 0.011 });
    }
    band(ctx, pts, 0.38);
  }
  soft(ctx, cx, cy - r * 0.15, r * 0.85, 0.2);
  const t = Math.round(p.threads);
  for (let i = 0; i < t; i++) {
    const off = (i / (t - 1) - 0.5) * r * 1.6;
    const pts: Sample[] = [];
    for (let j = 0; j <= 20; j++) {
      const u = j / 20;
      pts.push({ x: cx + off + Math.sin(u * 5 + i) * s * 0.03, y: cy + u * s * 0.56, w: s * 0.005 * (1 - u * 0.7) });
    }
    band(ctx, pts, 0.28);
  }
};

const PAINT: Record<PaintKind, Paint> = {
  ribbon: paintRibbon, chain: paintChain, branch: paintBranch,
  stack: paintStack, cluster: paintCluster, bell: paintBell,
};

function bake(kindId: string, paint: PaintKind, p: Params, blurFrac: number): Texture {
  const key = `${kindId}|${blurFrac}`;
  let tex = cache.get(key);
  if (!tex) {
    const src = document.createElement('canvas');
    src.width = src.height = SRC;
    PAINT[paint](src.getContext('2d')!, SRC, p);
    tex = blurred(src, SRC * blurFrac);
    cache.set(key, tex);
  }
  return tex;
}

// ------------------------------------------------------------------ the vocabulary

interface Kind {
  id: string;
  paint: PaintKind;
  p: Params;
  /** World size of the long side inside the 1000-wide patch. */
  size: number;
  /** `up` keeps a rooted thing upright; `free` may tumble. */
  axis: 'up' | 'free';
}

/** The parts bin: three props per tier, from which that tier's field is built. */
const VOCAB: Kind[][] = [
  [ // Sunlit Shallows — growth and gas: blades from below, bubbles going up, fry hanging
    { id: 'kelp', paint: 'ribbon', size: 430, axis: 'up', p: { curl: 2.2, taper: 0.55, wide: 0.075 } },
    { id: 'bubbles', paint: 'chain', size: 300, axis: 'up', p: { wave: 3.4, nodes: 9, node: 0.05, grow: 0.7 } },
    { id: 'fry', paint: 'cluster', size: 170, axis: 'free', p: { n: 22, spread: 0.4, squash: 0.7, r: 0.05 } },
  ],
  [ // Reef Shelf — built structure: fans, barrels, and the rubble they shed
    { id: 'fan', paint: 'branch', size: 330, axis: 'up', p: { arms: 3, fan: 0.5, spread: 0.42, len: 0.24, thick: 0.022, depth: 3, tip: 0.3 } },
    { id: 'barrel', paint: 'stack', size: 270, axis: 'up', p: { lean: 0.35, taper: 0.28, wide: 0.17, mouth: 0.4 } },
    { id: 'rubble', paint: 'cluster', size: 190, axis: 'free', p: { n: 9, spread: 0.3, squash: 0.85, r: 0.1 } },
  ],
  [ // Twilight Zone — nothing grows, everything falls or hangs
    { id: 'snow', paint: 'chain', size: 230, axis: 'up', p: { wave: 1.2, nodes: 7, node: 0.035, grow: 0 } },
    { id: 'siphon', paint: 'chain', size: 470, axis: 'up', p: { wave: 5.5, nodes: 16, node: 0.03, grow: -0.5 } },
    { id: 'drift', paint: 'ribbon', size: 270, axis: 'free', p: { curl: 4.1, taper: 0.8, wide: 0.05 } },
  ],
  [ // Midnight Zone — the only light is alive: bells, sparks, one long feeler
    { id: 'bell', paint: 'bell', size: 250, axis: 'up', p: { threads: 7 } },
    { id: 'spark', paint: 'cluster', size: 160, axis: 'free', p: { n: 7, spread: 0.36, squash: 1, r: 0.07 } },
    { id: 'tendril', paint: 'ribbon', size: 390, axis: 'up', p: { curl: 3.3, taper: 0.9, wide: 0.032 } },
  ],
  [ // The Abyss — mineral: chimneys, what they exhale, and what feeds on it
    { id: 'chimney', paint: 'stack', size: 430, axis: 'up', p: { lean: 0.5, taper: 0.62, wide: 0.2, mouth: 0.85 } },
    { id: 'plume', paint: 'cluster', size: 350, axis: 'up', p: { n: 16, spread: 0.34, squash: 1.35, r: 0.055 } },
    { id: 'worms', paint: 'branch', size: 210, axis: 'up', p: { arms: 5, fan: 0.34, spread: 0.2, len: 0.17, thick: 0.02, depth: 1, tip: 0.55 } },
  ],
];

// ------------------------------------------------------------------ the scene

interface Part {
  sprite: Sprite;
  hx: number; hy: number;
  base: number; phase: number;
  sway: number; spin: number;
  /** World units/s of vertical travel; the part wraps through the frame. */
  rise: number;
  /** Depth of the alpha pulse, 0 for anything that does not breathe. */
  pulse: number;
  alpha: number;
  wander: number;
}

export class ProtoScene extends Container {
  private parts: Part[] = [];
  private t = 0;

  constructor(readonly depth: number) {
    super();
    // same switch the shipping bands make: below the twilight a normal blend has nothing
    // to darken against, so shapes read as the faint light they would be
    this.blendMode = lightAt(depth) < 0.22 ? 'add' : 'normal';
  }

  add(kind: Kind, x: number, y: number, scale: number, o: Partial<Part> & { blur?: number; dark?: number; lit?: number } = {}) {
    const tex = bake(kind.id, kind.paint, kind.p, o.blur ?? 0.03);
    const s = new Sprite(tex);
    s.anchor.set(0.5, kind.axis === 'up' ? 0.9 : 0.5);
    const long = kind.size * scale;
    s.scale.set(long / Math.max(tex.width, tex.height));
    if (o.spin === undefined && h(x * 7 + y) < 0.5) s.scale.x *= -1;
    s.x = x - PROTO_W / 2;
    s.y = y - PROTO_H / 2;
    // the shipping band's own shading, so what the board shows is comparable with it
    s.tint = shadeFor(this.depth, o.dark ?? 0.16, o.lit ?? 0.9);
    s.alpha = o.alpha ?? 0.9;
    s.rotation = o.base ?? 0;
    this.addChild(s);
    this.parts.push({
      sprite: s, hx: s.x, hy: s.y, base: o.base ?? 0, phase: o.phase ?? h(x * 13 + y * 7) * 7,
      sway: o.sway ?? 0.05, spin: o.spin ?? 0, rise: o.rise ?? 0, pulse: o.pulse ?? 0,
      alpha: s.alpha, wander: o.wander ?? 10,
    });
    return s;
  }

  /** Called by the design board every frame; `beat` is the shared swim clock. */
  animate(dt: number, beat: number) {
    this.t += dt;
    for (const p of this.parts) {
      p.sprite.rotation = p.base + p.spin * this.t + Math.sin(beat * 0.22 + p.phase) * p.sway;
      p.sprite.x = p.hx + Math.sin(this.t * 0.17 + p.phase) * p.wander;
      let y = p.hy + Math.cos(this.t * 0.11 + p.phase * 1.7) * p.wander * 0.5;
      if (p.rise !== 0) {
        // wrapped travel, not a velocity: a part that drifted for real would leave the
        // patch and never come back, and a still frame of the field would be a lie.
        // Positive rise moves up, which is y decreasing.
        const span = PROTO_H + 200;
        const top = -PROTO_H / 2 - 100;
        y = top + ((((y - top - this.t * p.rise) % span) + span) % span);
      }
      p.sprite.y = y;
      if (p.pulse > 0) p.sprite.alpha = p.alpha * (1 - p.pulse + p.pulse * (0.5 + 0.5 * Math.sin(beat * 0.9 + p.phase * 2)));
    }
  }
}

/**
 * Points gathered around a centre, densest in the middle. `t` is 0 at the core and 1 at the
 * edge, and every caller fades and shrinks with it — a clump that ends at a hard boundary
 * reads as a cut-out, and the water on the far side of it stops looking like water.
 */
function clump(rng: Rng, n: number, cx: number, cy: number, rx: number, ry: number) {
  const out: { x: number; y: number; t: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = rng.next() * TAU;
    const t = Math.sqrt(rng.next());
    out.push({ x: cx + Math.cos(a) * rx * t, y: cy + Math.sin(a) * ry * t, t });
  }
  return out;
}

/** Four distances, so a field has depth of its own rather than sitting on one plane. The
 * nearest is sharper than any shipping band — the structure a field is built around is the
 * one thing in it you are meant to read as an object. */
function blurFor(far: number) {
  return far < 0.25 ? 0.018 : far < 0.5 ? 0.028 : far < 0.75 ? 0.05 : 0.085;
}

// ------------------------------------------------------------------ the five fields

/**
 * One structure per tier, and water around it. The structure is what names the biome; the
 * water is what you actually swim through, so it gets most of the frame — the abyss column
 * was the only cell that worked in the first pass and this is the shape of it.
 */
export function protoScene(tier: number, depth: number): ProtoScene {
  const sc = new ProtoScene(depth);
  const k = VOCAB[tier];
  const rng = new Rng(4400 + tier * 97);

  switch (tier) {
    case 0: { // a kelp stand rooted at one side; the rest is bright open water
      const n = 7;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const far = (i % 3) / 2;
        // spread wider and kept under the frame height: blades that overlap along their
        // whole length stop being blades and become one dark mass
        sc.add(k[0], 120 + t * 300 + rng.range(-30, 30), PROTO_H + 40 + far * 45,
          lerp(1.5, 0.95, far), {
            blur: blurFor(far * 0.8), alpha: lerp(0.95, 0.5, far), dark: lerp(0.08, 0.14, far),
            // phase from x, so the bend crosses the stand instead of every blade nodding at once
            phase: t * 4.2, sway: 0.16, wander: 6,
          });
      }
      // two outliers further out, faint: the stand thins rather than ending at a line
      for (let i = 0; i < 2; i++) {
        sc.add(k[0], 530 + i * 120, PROTO_H + 110, 0.8,
          { blur: 0.085, alpha: 0.3, phase: 4.2 + i, sway: 0.13, wander: 5 });
      }
      // the open water is not empty water — a few strings going up read as a live column
      for (let i = 0; i < 4; i++) {
        sc.add(k[1], rng.range(640, 900), rng.range(120, PROTO_H), 0.75,
          { blur: 0.085, alpha: 0.38, rise: rng.range(28, 46), wander: 14 });
      }
      break;
    }
    case 1: { // a shelf shedding into the current: rubble mound low and right, thinning up
      for (const q of clump(rng, 16, 760, 580, 250, 120)) {
        sc.add(k[2], q.x, q.y, lerp(1.6, 0.7, q.t), {
          blur: blurFor(q.t), alpha: lerp(1, 0.45, q.t), dark: lerp(0.06, 0.13, q.t),
          spin: rng.range(-0.03, 0.03), wander: 14 + q.t * 20, sway: 0.04,
        });
      }
      // what stands on the mound names the biome; two of them, not a reef wall. Shaded
      // well below the band's usual dark — reef water is already dim, and a prop at 0.16
      // of it sits on the water instead of against it
      sc.add(k[1], 700, 560, 1.5, { blur: 0.018, dark: 0.05, base: -0.1, sway: 0.02 });
      sc.add(k[1], 895, 600, 1.1, { blur: 0.028, dark: 0.07, base: 0.12, sway: 0.03 });
      sc.add(k[0], 545, 625, 1.3, { blur: 0.028, dark: 0.06, base: -0.22, sway: 0.05 });
      // the current carries the fines away across the open half, small and nearly gone
      for (let i = 0; i < 7; i++) {
        sc.add(k[2], rng.range(140, 600), rng.range(150, 470), rng.range(0.35, 0.55), {
          blur: 0.085, alpha: rng.range(0.25, 0.4), dark: 0.11, spin: rng.range(-0.04, 0.04),
          wander: rng.range(26, 46), phase: i * 0.9,
        });
      }
      break;
    }
    case 2: { // snow falls in two loose drifts, and the gap between them is the tier
      for (const cx of [270, 700]) {
        for (let i = 0; i < 9; i++) {
          const far = rng.next();
          sc.add(k[0], cx + rng.range(-95, 95), rng.range(-90, PROTO_H), lerp(0.85, 0.35, far), {
            blur: blurFor(far), alpha: lerp(0.95, 0.4, far), rise: -lerp(30, 11, far),
            base: rng.range(-0.3, 0.3), sway: 0.08, wander: 12,
          });
        }
      }
      // one thing hanging in the gap, far off, so the emptiness has a scale
      sc.add(k[1], 900, 110, 2.6, { blur: 0.085, alpha: 0.45, sway: 0.05 });
      sc.add(k[2], 480, 300, 0.7, { blur: 0.085, alpha: 0.3, spin: 0.02, wander: 30 });
      break;
    }
    case 3: { // a swarm holding a ring in the dark, small in a lot of nothing
      const n = 16;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        sc.add(k[1], 620 + Math.cos(a) * 185, 300 + Math.sin(a) * 135, 0.55, {
          blur: 0.05, alpha: 0.85, pulse: 0.9, phase: (i / n) * 7, wander: 14, spin: 0.02,
        });
      }
      // two bells far below it, out of the ring's light — the dark needs a floor of scale
      sc.add(k[0], 240, 560, 1.2, { blur: 0.085, alpha: 0.4, pulse: 0.5, phase: 1.4 });
      sc.add(k[0], 400, 640, 0.8, { blur: 0.085, alpha: 0.3, pulse: 0.55, phase: 3.9 });
      break;
    }
    default: { // an ember column: everything the vent exhales, rising in one plume
      for (let i = 0; i < 30; i++) {
        const far = rng.next();
        const drift = (h(i * 5) - 0.5) * 520;
        sc.add(k[1], PROTO_W / 2 + drift, rng.range(-80, PROTO_H), lerp(0.9, 0.35, far), {
          blur: far < 0.4 ? 0.05 : 0.085, alpha: lerp(0.85, 0.35, far),
          rise: lerp(70, 22, far), pulse: 0.45, phase: rng.range(0, 7), wander: 22, sway: 0.06,
        });
      }
      sc.add(k[0], PROTO_W / 2, PROTO_H + 40, 2.1, { blur: 0.05, alpha: 0.7, sway: 0.01 });
      break;
    }
  }
  return sc;
}

/** What the tier's field is built from, for the board's focus panel. */
export function protoKinds(tier: number) {
  return VOCAB[tier].map(k => k.id).join(' ');
}
