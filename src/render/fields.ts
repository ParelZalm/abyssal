/**
 * Fields — the scenery that says which band you are in by what stands in its water.
 *
 * The planes (`scenery.ts`) scatter one soft prop per hashed cell, so a band is told apart
 * only by colour and density. A field is the other half: one motif many times, gathered into
 * one or two things adrift with open water around them — a clump of weed, a torn sea fan,
 * a siphonophore in falling snow, a ring of sparks, a column of embers, a sinking ribcage.
 * Nothing stands on anything: the column has no floor to stand a structure on. It was chosen
 * on the design board over a per-band vocabulary (confetti) and edge-pinned anchors (mush
 * when enlarged, no open water); see `docs/decisions.md`.
 *
 * Three things made it not a port of the prototype:
 *
 * - **A cell seeds a whole field.** Each band's stretch of the plane is laid in rows, a field
 *   stands in every other cell along a row, and it is built all at once from its cell's own
 *   seed, from the band's own parts. A prop per cell cannot make a structure; a structure
 *   per cell is the unit. Rows are per band so that no band goes without (`CELL_W`).
 * - **Phase comes from position.** Every part's sway and pulse is phased by where it sits,
 *   so a bend travels across a stand and a pulse runs round a ring, and the same field is
 *   in the same state however it came into view.
 * - **Shadows multiply, lights add.** In lit water a silhouette darkens the water behind it
 *   by a share rather than being painted a colour, and a flake or a bubble is added over it;
 *   in the dark, as on the planes, everything is light (`GLOW_BELOW`).
 *
 * Like the planes, the field plane holds its apparent size (scaled by 1/zoom), which is what
 * lets it survive the fourfold zoom change that killed two earlier background passes. Its
 * parts are painted smooth and brought down to pixels (`pixelArt`) at a texel density fixed
 * against the frame, per size, so a big part is more texels rather than bigger ones.
 */
import { Container, Sprite, type Texture } from 'pixi.js';
import { BANDS, bandWater, DEPTH_MAX } from '../content/zones';
import { clamp, hash01 as h, lerp, rgb, Rng, TAU } from '../core/util';
import { pixelArt, shadeFor } from './props';
import type { View } from './view';
import { lightAt, waterColor } from './water';

// ------------------------------------------------------------------ painting

/** Source canvas for a part, before it is brought down to pixels. */
const SRC = 256;

interface Sample { x: number; y: number; w: number }

/**
 * A closed shape swept along a centreline. Nothing here is stroked, for the reason nothing on
 * a creature is: a stroke has a position of its own and doubles wherever parts cross.
 */
function sweep(ctx: CanvasRenderingContext2D, pts: Sample[], a: number) {
  const n = pts.length;
  const nx: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(n - 1, i + 1)];
    const dx = p1.x - p0.x, dy = p1.y - p0.y;
    const L = Math.hypot(dx, dy) || 1;
    nx.push({ x: -dy / L, y: dx / L });
  }
  ctx.beginPath();
  ctx.moveTo(pts[0].x + nx[0].x * pts[0].w, pts[0].y + nx[0].y * pts[0].w);
  for (let i = 1; i < n; i++) ctx.lineTo(pts[i].x + nx[i].x * pts[i].w, pts[i].y + nx[i].y * pts[i].w);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(pts[i].x - nx[i].x * pts[i].w, pts[i].y - nx[i].y * pts[i].w);
  ctx.closePath();
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.fill();
}

/**
 * A hard mote: a half-alpha disc with a solid core set up and to one side, where the light
 * from above lands. What a pebble, a bubble or a spark is made of — a radial gradient came
 * out of the dither as a cloud of stipple, which reads as fog and not as a thing.
 */
function mote(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.beginPath();
  ctx.arc(x - r * 0.2, y - r * 0.25, r * 0.55, 0, TAU);
  ctx.fill();
}

/** A glow, for what gives off light: a bell's dome, a vent's mouth. */
function soft(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,255,255,${a})`);
  g.addColorStop(0.6, `rgba(255,255,255,${a * 0.6})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

type Params = Record<string, number>;
type Paint = (ctx: CanvasRenderingContext2D, s: number, p: Params) => void;

// The dither steps alpha to empty, half and solid, so each painter lays a half-alpha body
// and a solid core: the part comes out two-toned — a pixel-art ramp — rather than as one
// flat stamp. Exactly a half, since anything over it dithers between half and solid and the
// body turns to stipple; only the antialiased edge is left to dither, which is the softness.

/** A blade or frond: rooted at the bottom, curling, tapering to nothing. */
const frond: Paint = (ctx, s, p) => {
  const pts: Sample[] = [];
  for (let i = 0; i <= 26; i++) {
    const t = i / 26;
    pts.push({
      x: s * 0.5 + Math.sin(t * p.curl) * s * 0.2 * t,
      y: s * (0.97 - t * 0.94),
      // the root is thin too — a blade that meets its root at full width reads as a wall
      w: s * p.wide * (1 - p.taper * t) * Math.sin(Math.min(1, t * 3.2 + 0.12) * Math.PI * 0.5),
    });
  }
  sweep(ctx, pts, 0.5);
  sweep(ctx, pts.map(q => ({ ...q, w: q.w * 0.4 })), 1);
};

/** A strand with beads on it: a bubble string, marine snow, a siphonophore. */
const chain: Paint = (ctx, s, p) => {
  const line: Sample[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    line.push({ x: s * 0.5 + Math.sin(t * p.wave) * s * 0.13, y: s * (0.96 - t * 0.92), w: s * 0.008 });
  }
  if (p.strand) sweep(ctx, line, 0.5);
  const n = Math.round(p.nodes);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = s * 0.5 + Math.sin(t * p.wave) * s * 0.13;
    const y = s * (0.96 - t * 0.92);
    const r = s * p.node * (1 + p.grow * (t - 0.5) * 2) * (0.75 + h(i * 31 + p.nodes) * 0.5);
    mote(ctx, x, y, r);
  }
};

/** A recursive fork: a sea fan, tube worms. */
const branch: Paint = (ctx, s, p) => {
  const twig = (x: number, y: number, ang: number, len: number, w: number, d: number, seed: number) => {
    const pts: Sample[] = [];
    const bend = (h(seed) - 0.5) * 0.9;
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const a = ang + bend * t;
      pts.push({ x: x + Math.cos(a) * len * t, y: y + Math.sin(a) * len * t, w: w * (1 - t * 0.55) });
    }
    sweep(ctx, pts, 0.9);
    const ex = x + Math.cos(ang + bend) * len, ey = y + Math.sin(ang + bend) * len;
    if (d <= 0) { if (p.tip > 0) mote(ctx, ex, ey, w * 1.8 * p.tip + w); return; }
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

/** A standing column: a barrel sponge, a vent chimney. */
const stack: Paint = (ctx, s, p) => {
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
  sweep(ctx, pts, 0.5);
  // the lit side is the solid one: light comes down, so the column's crown and one flank
  sweep(ctx, pts.map(q => ({ ...q, x: q.x + q.w * 0.3, w: q.w * 0.45 })), 1);
  const mx = s * 0.5 + Math.sin(p.lean) * s * 0.12;
  soft(ctx, mx, s * 0.09, s * 0.12, p.mouth);
};

/** Scattered motes: rubble, fry, sparks, embers, a mat of weed. */
const cluster: Paint = (ctx, s, p) => {
  const n = Math.round(p.n);
  for (let i = 0; i < n; i++) {
    const a = h(i * 17 + p.n) * TAU;
    const rr = Math.sqrt(h(i * 29 + 3)) * s * p.spread;
    const x = s * 0.5 + Math.cos(a) * rr;
    const y = s * 0.5 + Math.sin(a) * rr * p.squash;
    mote(ctx, x, y, s * p.r * (0.5 + h(i * 41) * 0.9));
  }
};

/** A medusa: dome rings and trailing threads. */
const bell: Paint = (ctx, s, p) => {
  const cx = s * 0.5, cy = s * 0.36, r = s * 0.3;
  for (const k of [1, 0.74]) {
    const pts: Sample[] = [];
    for (let i = 0; i <= 26; i++) {
      const a = Math.PI + (i / 26) * Math.PI;
      pts.push({ x: cx + Math.cos(a) * r * k, y: cy + Math.sin(a) * r * k * 0.92, w: s * 0.016 });
    }
    sweep(ctx, pts, 1);
  }
  soft(ctx, cx, cy - r * 0.15, r * 0.85, 0.35);
  const t = Math.round(p.threads);
  for (let i = 0; i < t; i++) {
    const off = (i / (t - 1) - 0.5) * r * 1.6;
    const pts: Sample[] = [];
    for (let j = 0; j <= 20; j++) {
      const u = j / 20;
      pts.push({ x: cx + off + Math.sin(u * 5 + i) * s * 0.03, y: cy + u * s * 0.56, w: s * 0.008 * (1 - u * 0.6) });
    }
    sweep(ctx, pts, 0.5);
  }
};

/** A whale's rib: a tapering arc off the spine, bone-thick at the root. */
const rib: Paint = (ctx, s, p) => {
  const pts: Sample[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const a = Math.PI * (1 - t * p.arc);
    pts.push({ x: s * 0.72 + Math.cos(a) * s * 0.5, y: s * 0.95 - Math.sin(a) * s * 0.85,
               w: s * 0.03 * (1 - t * 0.6) });
  }
  sweep(ctx, pts, 0.5);
  sweep(ctx, pts.map(q => ({ ...q, w: q.w * 0.5 })), 1);
};

const PAINT = { frond, chain, branch, stack, cluster, bell, rib } satisfies Record<string, Paint>;
type PaintKind = keyof typeof PAINT;

// ------------------------------------------------------------------ the vocabulary

interface Kind {
  id: string;
  paint: PaintKind;
  p: Params;
  /** Plane size of the long side at scale 1 — about CSS pixels, since the plane holds size. */
  size: number;
  /** `up` is rooted at its foot, `down` hangs from its root, `free` may tumble. */
  axis: 'up' | 'down' | 'free';
  /**
   * A thing that is light rather than a shadow — a bubble, a flake, a spark, a bell. In lit
   * water it is added over the water instead of darkening it, since a multiply can only
   * take light away and snow drawn that way is not there at all.
   */
  light?: true;
  /**
   * Bone: pale in the dark instead of the band's accent. The trench's accent is a red, and a
   * skeleton in it came out as a row of neon.
   */
  bone?: true;
}

/**
 * Each band's parts bin, by `BANDS` index. Every field is one or two things adrift: the water
 * column has no floor to stand a structure on, so nothing here is rooted in anything — a
 * mound, a vent chimney or a whale fall lying on the bottom read as scenery from a sea bed
 * the player never sees.
 */
const VOCAB: Kind[][] = [
  [ // Open Water — a clump of weed adrift, and the fry that shelter under it
    { id: 'mat', paint: 'cluster', size: 300, axis: 'free', p: { n: 26, spread: 0.46, squash: 0.28, r: 0.07 } },
    { id: 'frond', paint: 'frond', size: 360, axis: 'down', p: { curl: 2.4, taper: 0.6, wide: 0.07 } },
    { id: 'fry', paint: 'cluster', size: 150, axis: 'free', p: { n: 20, spread: 0.4, squash: 0.6, r: 0.04 } },
  ],
  [ // Reef Shelf — a sea fan the current tore off the reef, tumbling as it goes
    { id: 'fan', paint: 'branch', size: 300, axis: 'free', p: { arms: 3, fan: 0.5, spread: 0.42, len: 0.24, thick: 0.024, depth: 3, tip: 0.5 } },
  ],
  [ // Twilight Zone — nothing grows, everything falls or hangs
    // snow as loose flakes, a few to a sprite: as beads on a string it read as dotted lines
    { id: 'snow', paint: 'cluster', size: 90, axis: 'free', light: true, p: { n: 4, spread: 0.42, squash: 1, r: 0.06 } },
    { id: 'siphon', paint: 'chain', size: 440, axis: 'down', light: true, p: { wave: 5.5, nodes: 16, node: 0.03, grow: -0.5, strand: 1 } },
  ],
  [ // Midnight Zone — the only light is alive: a swarm holding a ring, a bell below it
    { id: 'bell', paint: 'bell', size: 230, axis: 'free', light: true, p: { threads: 7 } },
    { id: 'spark', paint: 'cluster', size: 120, axis: 'free', light: true, p: { n: 6, spread: 0.34, squash: 1, r: 0.08 } },
  ],
  [ // The Abyss — warm water rising from a vent far below, embers and all
    { id: 'ember', paint: 'cluster', size: 110, axis: 'free', light: true, p: { n: 5, spread: 0.3, squash: 1.2, r: 0.1 } },
  ],
  [ // The Trenches — a carcass on its way down: the ribcage of something that died above
    // a rib leaves the spine and sweeps over, a quarter arc: past that it closed into a hoop.
    // Hung from the backbone, as a ribcage is side-on; stood up off it, a row of ribs read as
    // a comb lying on a floor the column does not have
    { id: 'rib', paint: 'rib', size: 300, axis: 'down', bone: true, p: { arc: 0.42 } },
    { id: 'spine', paint: 'cluster', size: 90, axis: 'free', bone: true, p: { n: 3, spread: 0.18, squash: 0.7, r: 0.2 } },
    { id: 'snow', paint: 'cluster', size: 80, axis: 'free', light: true, p: { n: 4, spread: 0.42, squash: 1, r: 0.06 } },
  ],
];

/**
 * Plane units per texel. A plane unit is about a CSS pixel and the frame is two CSS pixels
 * to a texel (`render/pixel.ts`); a little over two keeps the parts a touch coarser than the
 * creatures in front of them, which is what distance should do.
 */
const TEXEL = 2.4;
/**
 * Blur on the source canvas by how far back a part sits, 0 near to 1 far, as a share of it.
 * None at the front: the structure's heart is the one thing in the background meant to read
 * as an object, so only its antialiased edge dithers. Behind it the dither widens, which is
 * how the planes say distance too.
 */
const blurFor = (far: number) => SRC * 0.05 * far * far;

const cache = new Map<string, Texture>();

/**
 * The texture for a part of `kind` drawn `long` plane units across at distance `far`. Sizes
 * are bucketed by thirds of an octave and distance by quarters, so a field shares a few
 * textures across its parts and the bake is a handful of small canvases per band, once.
 */
function textureFor(kind: Kind, long: number, far: number): Texture {
  const texels = Math.round(clamp(2 ** (Math.round(Math.log2(long / TEXEL) * 3) / 3), 10, 220));
  const blur = Math.round(far * 3) / 3;
  const key = `${kind.id}|${kind.paint}|${texels}|${blur}`;
  let tex = cache.get(key);
  if (!tex) {
    const c = document.createElement('canvas');
    c.width = c.height = SRC;
    PAINT[kind.paint](c.getContext('2d')!, SRC, kind.p);
    tex = pixelArt(c, texels, blurFor(blur));
    cache.set(key, tex);
  }
  return tex;
}

// ------------------------------------------------------------------ the fields

interface Part {
  sprite: Sprite;
  /** Home in plane units, before the wander. */
  hx: number; hy: number;
  base: number; phase: number;
  sway: number; spin: number;
  /** Plane units a second of travel, up positive; the part wraps inside its field. */
  rise: number;
  /** Depth of the alpha pulse, 0 for anything that does not breathe. */
  pulse: number;
  alpha: number;
  wander: number;
}

interface Field {
  /**
   * The field's own two layers, each with its own blend: `shade` for its shadows (multiplied
   * in lit water, added in the dark) and `shine` for its lights (always added). Per field
   * rather than per plane, because a field keeps the shading of the water it was built in —
   * a lit-water silhouette is grey, and on a plane that had gone additive as the camera sank
   * past it, it glowed grey.
   */
  node: Container;
  parts: Part[];
  /** The vertical span a rising part wraps through, in the field's own units about its centre. */
  top: number; bottom: number;
  /** Where the field sits on the plane before its drift, and the drift's own phase. */
  x: number; y: number;
  shift: number;
}

/** How a part is set down: everything but where and how big has a default. */
interface Opts {
  /** 0 nearest the structure's heart to 1 furthest back: blur, fade and tint. */
  far?: number;
  alpha?: number; dark?: number; lit?: number;
  base?: number; sway?: number; spin?: number; rise?: number; pulse?: number; wander?: number;
  /** Overrides the positional phase, for a sequence that runs round something. */
  phase?: number;
  /** False for a part whose handedness is the structure's — a skeleton's ribs all lean one way. */
  mirror?: boolean;
}

/** The patch a field is laid out in, as the design board framed it: a screen of water. */
const PATCH_W = 1000, PATCH_H = 700;
/**
 * Scale from the patch to the plane. The board frames a patch to fill its cell; in play at
 * 0.8 a raft of weed was half the screen and a black wall behind the fish. At this a field is
 * a third of a screen across, and the rest of the frame is the water around it.
 */
const FIELD_SCALE = 0.5;
/**
 * Below this much light the field plane glows (additive, as the planes do); above it, it
 * multiplies. A flat tint could not be right in lit water: the water shader's clouds swing
 * the local colour so far that a fixed shade was black in the bright patches — a wall behind
 * the fish — and paler than the water in the shadowed ones. A multiply darkens whatever is
 * behind it by a share, which is what water between you and a silhouette does.
 */
const GLOW_BELOW = 0.22;

/** How much of the water's own colour a light part adds over it in lit water, near to far. */
const GLINT: [number, number] = [1.2, 0.6];

/**
 * The share of the water a part lets through when the plane multiplies. The layouts shade
 * in the planes' terms (`dark`, 0.05 for the reef's nearest to 0.18), mapped so the nearest
 * takes about half the light behind it and the far parts a fifth.
 */
const through = (dark: number, far: number) => clamp(0.3 + dark * 2.4 + far * 0.2, 0.3, 0.85);

type Add = (kind: number, x: number, y: number, scale: number, o?: Opts) => void;

/** Points gathered round a centre, densest in the middle; `t` is 0 at the core, 1 at the edge. */
function clump(rng: Rng, n: number, cx: number, cy: number, rx: number, ry: number) {
  const out: { x: number; y: number; t: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = rng.next() * TAU;
    const t = Math.sqrt(rng.next());
    out.push({ x: cx + Math.cos(a) * rx * t, y: cy + Math.sin(a) * ry * t, t });
  }
  return out;
}

/**
 * One or two things per band, laid out in the patch, adrift. What names the band is the
 * object; the water around it is what you swim through, so each sits in the middle of the
 * patch with nothing else in it — the board's finding was that a field spread wall to wall
 * is just noise in a colour, and play's that more than a couple of things read as clutter.
 * Parts of one object carry no wander of their own: the whole field drifts (`animate`), so
 * an object holds together and only its fronds and threads move on it.
 * Coordinates are patch units, 0..PATCH_W across and 0..PATCH_H down.
 */
const LAYOUTS: ((add: Add, rng: Rng) => void)[] = [
  (add, rng) => { // a clump of sargassum adrift, fronds hanging under it; a knot of fry beside
    for (const q of clump(rng, 4, 470, 190, 110, 18)) {
      add(0, q.x, q.y, lerp(1.05, 0.8, q.t), { far: q.t * 0.3, dark: 0.07, base: rng.range(-0.1, 0.1), sway: 0.02, wander: 0 });
    }
    for (let i = 0; i < 4; i++) {
      add(1, 395 + i * 48 + rng.range(-10, 10), 200, lerp(1.1, 0.75, i % 2), {
        far: (i % 2) * 0.3, dark: 0.08, sway: 0.12, wander: 0,
      });
    }
    add(2, 650, 360, 0.9, { far: 0.2, dark: 0.1, wander: 16 });
  },
  (add, rng) => { // a sea fan torn off the reef, turning over in the current; a smaller piece behind
    add(0, 520, 360, 1.5, { dark: 0.06, base: rng.range(0, TAU), spin: 0.03, sway: 0.03, wander: 0 });
    add(0, 330, 270, 0.75, { far: 0.6, dark: 0.1, base: rng.range(0, TAU), spin: -0.045, sway: 0.03, wander: 14 });
  },
  (add, rng) => { // a siphonophore hanging in the water, one loose drift of snow falling past it
    add(1, 500, 30, 1.6, { far: 0.45, alpha: 0.75, sway: 0.05, wander: 0 });
    for (let i = 0; i < 10; i++) {
      const far = rng.next();
      add(0, 640 + rng.range(-110, 110), rng.range(0, PATCH_H), lerp(1.2, 0.6, far), {
        far: far * 0.8, alpha: lerp(1, 0.5, far), rise: -lerp(26, 10, far), spin: rng.range(-0.1, 0.1),
        sway: 0, wander: 14,
      });
    }
  },
  (add) => { // a swarm holding a ring in the dark, and one bell drifting under it for scale
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      add(1, 500 + Math.cos(a) * 210, 290 + Math.sin(a) * 150, 0.95, {
        far: 0.4, alpha: 0.9, pulse: 0.9, phase: (i / n) * TAU, wander: 12, spin: 0.02,
      });
    }
    // not all the way back: blurred to the far planes' dither, a bell is a puff and not a bell
    add(0, 360, 560, 1.3, { far: 0.35, alpha: 0.65, pulse: 0.5, sway: 0.04, wander: 0 });
  },
  (add, rng) => { // a column of embers rising from a vent too far below to see
    // with no chimney to say where it comes from, the column has to be dense enough to read
    // as one thing: tighter and brighter at its core than the plume that stood on a vent
    for (let i = 0; i < 26; i++) {
      const far = rng.next();
      add(0, PATCH_W / 2 + (h(i * 5) - 0.5) * 220 * (0.4 + far), rng.range(0, PATCH_H), lerp(1.25, 0.5, far), {
        far: far * 0.7, alpha: lerp(1, 0.45, far), rise: lerp(55, 20, far), pulse: 0.4, phase: rng.range(0, TAU), wander: 14, sway: 0.06,
      });
    }
  },
  (add, rng) => { // a whale's ribcage sinking through the dark, a few flakes falling with it
    const n = 8;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = 180 + t * 640;
      // the backbone arches, and the vertebrae shrink toward the tail
      const y = 250 - Math.sin(t * Math.PI) * 50;
      add(1, x, y, lerp(1.3, 0.7, t), { far: 0.15, alpha: 0.85, base: rng.range(-0.3, 0.3), sway: 0, wander: 0 });
      if (i === 0 || i === n - 1) continue;
      // longest at mid-chest, short toward the neck and the tail; swept back a little more
      // the further along, as a real cage is. The far side's rib hangs just behind, fainter
      const len = 0.65 + Math.sin(t * Math.PI) * 0.85;
      const sweep = 0.1 + t * 0.25;
      add(0, x, y + 8, len, { far: 0.1, alpha: 0.8, base: sweep, sway: 0.01, wander: 0, mirror: false });
      add(0, x + 18, y + 14, len * 0.9, { far: 0.6, alpha: 0.4, base: sweep + 0.05, sway: 0.01, wander: 0, mirror: false });
    }
    for (let i = 0; i < 6; i++) {
      add(2, rng.range(200, 800), rng.range(0, PATCH_H), rng.range(0.4, 0.7), {
        far: 0.9, alpha: 0.35, rise: -rng.range(10, 20), base: rng.range(-0.3, 0.3), wander: 8,
      });
    }
  },
];

/**
 * How a whole field drifts: plane units of slow wander, and radians it rocks by. Nothing out
 * here is moored, so a field is never still, but it is heavy water — the drift is a slow
 * lissajous, not a velocity, or a field would leave the cell it is keyed to.
 */
const DRIFT = 26, ROCK = 0.07;

/**
 * The plane the fields stand on. Between the two back planes: behind the near motes, in
 * front of the far haze — near enough to read as objects, behind everything that swims.
 */
const PARALLAX = 0.45;
/**
 * Cell size in plane units: across, and the most a row is allowed to be apart.
 *
 * The plane holds its apparent size, so it moves only `PARALLAX / k` of the camera's travel,
 * and the whole world is only `extent × PARALLAX / k` of it: zoomed out at full size the
 * trenches are a strip a few hundred units tall and the world under two cells wide. A grid
 * laid evenly over the plane and filled by lottery left whole bands without a field there,
 * so rows are laid per band instead — every band gets at least one, however thin the zoom
 * makes it — and along a row a field stands in every other cell, brick-offset from the row
 * above, with one in six left out so the spacing does not read as a pattern.
 */
const CELL_W = 1000, CELL_H = 520;
/** Share of a row's fielded cells left empty anyway. */
const GAPS = 0.16;
/** Plane units a wrapping part fades over at each end of its field. */
const FADE = 110;

/** Stable per-cell noise, so a field is in the same place every time you pass it. */
function hash2(x: number, y: number, seed: number) {
  let v = (x | 0) * 374761393 + (y | 0) * 668265263 + seed * 1274126177;
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
}

export class Fields {
  readonly root = new Container();
  private live = new Map<string, Field>();
  private free: Sprite[] = [];

  update(view: View) {
    const { x: camX, y: camY, t, zoom } = view;
    // held at its apparent size like the planes (`PlaneLayer.update`), for the same reason
    const k = clamp(1 / zoom, 0.6, 3.2);
    this.root.scale.set(k);
    this.root.x = camX * (1 - PARALLAX);
    this.root.y = camY * (1 - PARALLAX);
    const cx = camX * PARALLAX / k, cy = camY * PARALLAX / k;
    const halfW = view.w * 0.5 / k + CELL_W, halfH = view.h * 0.5 / k + CELL_H;
    const x0 = Math.floor((cx - halfW) / CELL_W), x1 = Math.floor((cx + halfW) / CELL_W);
    // plane units per unit of the depth a field appears at, as the planes reckon it
    const perDepth = PARALLAX / k;

    const keep = new Set<string>();
    BANDS.forEach((b, band) => {
      const top = b.top * perDepth, bottom = Math.min(b.bottom, DEPTH_MAX) * perDepth;
      if (bottom < cy - halfH || top > cy + halfH) return;
      const rows = Math.max(1, Math.round((bottom - top) / CELL_H));
      const rowH = (bottom - top) / rows;
      for (let r = 0; r < rows; r++) {
        for (let gx = x0; gx <= x1; gx++) {
          const odd = (r + band) & 1;
          if (((gx + odd) & 1) !== 0 || hash2(gx, r, band) < GAPS) continue;
          const fx = (gx + 0.3 + hash2(gx, r, band + 22) * 0.4) * CELL_W;
          const fy = top + (r + 0.35 + hash2(gx, r, band + 23) * 0.3) * rowH;
          if (Math.abs(fy - cy) > halfH) continue;
          // keyed by the row count too: a zoom change that re-lays the band's rows is a new
          // set of fields, not the old ones slid somewhere they were never meant to be
          const key = `${band},${rows},${r},${gx}`;
          keep.add(key);
          let f = this.live.get(key);
          if (!f) this.live.set(key, f = this.build(gx, r * 7 + band, band, fy / perDepth));
          // placed every frame, not once: a band's rows move on the plane as the zoom eases
          f.x = fx; f.y = fy;
        }
      }
    });
    for (const [key, f] of this.live) {
      if (!keep.has(key)) { this.release(f); this.live.delete(key); continue; }
      this.animate(f, t);
    }
  }

  /**
   * One band's field alone, centred on the origin of `root`, for the design board — built
   * and animated by the same code the plane uses. Returns the frame step.
   */
  patch(band: number, seed = 1) {
    const depth = (BANDS[band].top + BANDS[band].bottom) / 2;
    const f = this.build(seed, 0, band, depth);
    return (t: number) => this.animate(f, t);
  }

  private build(gx: number, gy: number, band: number, depth: number): Field {
    const kinds = VOCAB[band] ?? VOCAB[VOCAB.length - 1];
    const rng = new Rng(Math.floor(hash2(gx, gy, 24) * 2 ** 31) + band);
    // shaded for the blend it will be drawn in, which follows its own depth
    const glow = lightAt(depth) < GLOW_BELOW;
    const shade = new Container(), shine = new Container();
    shade.blendMode = glow ? 'add' : 'multiply';
    shine.blendMode = 'add';
    const node = new Container();
    node.addChild(shade, shine);
    this.root.addChild(node);
    const water = waterColor(depth);
    // what the positional phase is offset by, so two fields of one band are not in step
    const shift = hash2(gx, gy, 26) * TAU;
    const f: Field = { node, parts: [], x: 0, y: 0, shift,
      top: -PATCH_H * FIELD_SCALE * 0.5 - FADE, bottom: PATCH_H * FIELD_SCALE * 0.5 + FADE };
    // mirrored as a whole, half the time: a thing drifting right of centre is also one drifting left
    const flip = hash2(gx, gy, 25) < 0.5 ? -1 : 1;
    const add: Add = (ki, x, y, scale, o = {}) => {
      const kind = kinds[ki];
      const far = o.far ?? 0;
      const px = (x - PATCH_W / 2) * FIELD_SCALE * flip;
      const py = (y - PATCH_H / 2) * FIELD_SCALE;
      const long = kind.size * scale * FIELD_SCALE;
      const tex = textureFor(kind, long, far);
      const s = this.free.pop() ?? new Sprite();
      s.texture = tex;
      // a rooted part is anchored at its root, near the foot of the texture, whether it stands
      // or hangs: hanging is the same texture flipped about that point
      s.anchor.set(0.5, kind.axis === 'free' ? 0.5 : 0.9);
      const ks = long / Math.max(tex.width, tex.height);
      // a hanging part is a rooted one upside down; the rest are mirrored at random to vary
      // a field of one motif, which never turns a frond or a rib upside down
      const mirror = o.mirror === false ? flip : h(Math.floor(px * 7 + py) + gx * 131) < 0.5 ? -1 : 1;
      s.scale.set(ks * mirror, kind.axis === 'down' ? -ks : ks);
      const dark = o.dark ?? lerp(0.1, 0.18, far);
      if (glow && kind.bone) {
        // bone is lit by the band's light, not coloured by it: a pale grey with a trace of it
        const acc = bandWater(depth).accent, lit = o.lit ?? lerp(0.75, 0.45, far);
        s.tint = rgb(lerp(0.78, acc[0], 0.25) * lit, lerp(0.8, acc[1], 0.25) * lit, lerp(0.78, acc[2], 0.25) * lit);
      } else if (glow) {
        s.tint = shadeFor(depth, dark, o.lit ?? lerp(0.95, 0.6, far));
      } else if (kind.light) {
        const g = lerp(GLINT[0], GLINT[1], far);
        s.tint = rgb(water[0] * g, water[1] * g, water[2] * g);
      } else {
        const k = through(dark, far);
        s.tint = rgb(k, k, k);
      }
      s.alpha = (o.alpha ?? 0.9) * lerp(1, 0.75, far);
      s.visible = true;
      (kind.light ? shine : shade).addChild(s);
      f.parts.push({
        sprite: s, hx: px, hy: py, base: o.base ?? 0,
        // phased by where it sits, so a bend travels across the structure: a stand of fronds
        // sways as a wave, not in unison, and one field is always in the same state
        phase: (o.phase ?? px * 0.006 + py * 0.002) + shift,
        sway: o.sway ?? 0.05, spin: o.spin ?? 0, rise: (o.rise ?? 0) * FIELD_SCALE,
        pulse: o.pulse ?? 0, alpha: s.alpha, wander: (o.wander ?? 10) * FIELD_SCALE,
      });
    };
    LAYOUTS[Math.min(band, LAYOUTS.length - 1)](add, rng);
    return f;
  }

  private animate(f: Field, t: number) {
    const d = f.shift;
    f.node.position.set(f.x + Math.sin(t * 0.07 + d) * DRIFT, f.y + Math.cos(t * 0.05 + d * 1.3) * DRIFT * 0.6);
    f.node.rotation = Math.sin(t * 0.09 + d * 0.7) * ROCK;
    const span = f.bottom - f.top;
    for (const p of f.parts) {
      const s = p.sprite;
      s.rotation = p.base + p.spin * t + Math.sin(t * 0.9 - p.phase) * p.sway;
      s.x = p.hx + Math.sin(t * 0.17 + p.phase) * p.wander;
      let y = p.hy + Math.cos(t * 0.11 + p.phase * 1.7) * p.wander * 0.5;
      let fade = 1;
      if (p.rise !== 0) {
        // wrapped travel inside the field, not a velocity: a field is a thing in the water,
        // so its plume rises through its own column and fades out at the ends of it rather
        // than leaving. Up is y decreasing
        y = f.top + ((((y - f.top - t * p.rise) % span) + span) % span);
        fade = clamp(Math.min(y - f.top, f.bottom - y) / FADE, 0, 1);
      }
      s.y = y;
      const breathe = p.pulse > 0 ? 1 - p.pulse + p.pulse * (0.5 + 0.5 * Math.sin(t * 1.6 + p.phase)) : 1;
      s.alpha = p.alpha * breathe * fade;
    }
  }

  private release(f: Field) {
    for (const p of f.parts) {
      p.sprite.removeFromParent();
      p.sprite.visible = false;
      this.free.push(p.sprite);
    }
    f.node.destroy({ children: true });
  }
}

/** For the design board: the band's field vocabulary, by name. */
export function fieldKinds(band: number) {
  return (VOCAB[band] ?? []).map(k => k.id).join(' ');
}
