/**
 * Parallax background — soft organic props drifting on bands behind and in front of
 * the action. The placement machinery is the survivor of two art passes; the props
 * themselves are the third try. See `docs/decisions.md`.
 */
import { Container, Sprite } from 'pixi.js';
import { tierBiome } from './biomes';
import { drifts, PROP_SIZE, propTexture, type PropKind } from './props';
import { clamp, lerp, TAU } from './util';
import { lightAt, waterColor } from './water';

interface Band {
  /** Camera follow factor: below 1 sits behind you, above 1 passes in front. */
  parallax: number;
  /** World size of one placement cell — bigger is sparser. */
  cell: number;
  /** Multiplier on the biome's prop scale. */
  scale: number;
  /** Multiplier on the water colour where there is light to make a silhouette with. */
  dark: number;
  /** Multiplier on the biome accent where there is not — deep props have to emit. */
  lit: number;
  alpha: number;
  sway: number;
  /** Index into the prop blur table — how far away this band reads as. */
  blur: number;
}

const BANDS: Band[] = [
  // dark is lower than the old silhouette pass — soft props need more contrast against
  // the water shader's own clouds or they vanish into the same haze
  { parallax: 0.3, cell: 440, scale: 1, dark: 0.14, lit: 0.95, alpha: 0.9, sway: 0.05, blur: 2 },
  { parallax: 0.58, cell: 390, scale: 0.68, dark: 0.12, lit: 0.8, alpha: 0.85, sway: 0.08, blur: 1 },
  // the foreground stays a silhouette at every depth: in black water it simply
  // disappears, which is what a shape between you and nothing should do. It is blurred
  // as hard as the far band — it is out of focus in the other direction.
  { parallax: 1.35, cell: 950, scale: 1.25, dark: 0.08, lit: 0.18, alpha: 0.7, sway: 0.12, blur: 2 },
];

/** Stable per-cell noise, so a landmark is in the same place every time you pass it. */
function hash2(x: number, y: number, seed: number) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + seed * 1274126177;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

interface Placed {
  sprite: Sprite;
  /** Where the shape sits before it wanders, in band-local coordinates. */
  homeX: number; homeY: number;
  base: number; phase: number;
  /** Turn rate for tumbling props; 0 for anything with a forward axis. */
  spin: number;
  /** How far this one drifts from home, in band-local units. */
  wander: number;
}

/**
 * Contrast, not colour, is what makes a landmark read — and which way the contrast runs
 * flips with depth. In lit water a prop is a shape darker than the water behind it; in
 * the dark tiers there is nothing behind it, so the only way to be seen is to give off
 * the biome's own light.
 */
function shadeFor(depth: number, b: Band) {
  const deep = 1 - lightAt(depth);
  const water = waterColor(depth);
  const accent = tierBiome(depth).accent;
  let rgb = 0;
  for (let i = 0; i < 3; i++) {
    // ramped, not squared: the middle tiers are the awkward case — too dim for a dark
    // silhouette to carry on its own, not dark enough to be pure emission
    const v = lerp(water[i] * b.dark, accent[i] * b.lit, deep * (0.4 + 0.6 * deep));
    rgb = (rgb << 8) | Math.round(clamp(v, 0, 1) * 255);
  }
  return rgb;
}

class BandLayer {
  root = new Container();
  private live = new Map<string, Placed>();
  private free: Sprite[] = [];

  constructor(private band: Band) {}

  update(camX: number, camY: number, viewW: number, viewH: number, t: number, zoom: number) {
    const b = this.band;
    // The band is a backdrop, not scenery you swim through, so it holds its apparent
    // size: the camera zooms out by a factor of four as you grow, and world-sized props
    // would go from filling the screen to being lost in it. Scaling the band by 1/zoom
    // makes the visible slice of band-space — and so the size and spacing of everything
    // on it — the same at every stage of a run.
    const k = clamp(1 / zoom, 0.6, 3.2);
    this.root.scale.set(k);
    // Below the twilight the water is black and a normal blend has nothing to darken
    // against, so the band switches to additive and its shapes read as the faint light
    // they would be. The switch happens where the two modes already look the same — a
    // dark tint over near-black — so it does not pop as you swim through it.
    this.root.blendMode = lightAt(camY) < 0.22 ? 'add' : 'normal';
    // a child at local L lands at camera-space R + L*k, and we want that to trail the
    // camera by the parallax factor, which fixes R regardless of k
    this.root.x = camX * (1 - b.parallax);
    this.root.y = camY * (1 - b.parallax);
    const cx = camX * b.parallax / k, cy = camY * b.parallax / k;
    const halfW = viewW * 0.5 / k + b.cell, halfH = viewH * 0.5 / k + b.cell;

    const x0 = Math.floor((cx - halfW) / b.cell), x1 = Math.floor((cx + halfW) / b.cell);
    const y0 = Math.floor((cy - halfH) / b.cell), y1 = Math.floor((cy + halfH) / b.cell);

    const keep = new Set<string>();
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const key = `${gx},${gy}`;
        // the depth this cell *appears* at: a band at 0.3 shows you what is around you
        // now, not what is at its own coordinate
        const depth = ((gy + 0.5) * b.cell * k) / b.parallax;
        const biome = tierBiome(depth);
        if (hash2(gx, gy, 1) > biome.scenery.density) continue;
        keep.add(key);
        if (!this.live.has(key)) this.place(key, gx, gy, depth, biome.scenery);
      }
    }

    for (const [key, p] of this.live) {
      if (!keep.has(key)) { this.release(key, p); continue; }
      // everything out here is hanging in moving water, so nothing is ever still. The
      // wander is a slow lissajous rather than a velocity: a prop that drifted for real
      // would leave the cell it is keyed to and vanish mid-screen when that cell exits.
      p.sprite.rotation = p.base + p.spin * t + Math.sin(t * 0.35 + p.phase) * b.sway;
      p.sprite.x = p.homeX + Math.sin(t * 0.13 + p.phase) * p.wander;
      p.sprite.y = p.homeY + Math.cos(t * 0.09 + p.phase * 1.7) * p.wander * 0.55;
    }
  }

  private place(key: string, gx: number, gy: number, depth: number,
                s: { kinds: PropKind[]; scale: [number, number] }) {
    const b = this.band;
    const kind = s.kinds[Math.floor(hash2(gx, gy, 2) * s.kinds.length)];
    const tex = propTexture(kind, b.blur);
    const sprite = this.free.pop() ?? new Sprite();
    sprite.texture = tex;
    sprite.anchor.set(0.5);
    const span = s.scale[0] + hash2(gx, gy, 3) * (s.scale[1] - s.scale[0]);
    const long = span * b.scale * PROP_SIZE[kind];
    const k = long / Math.max(tex.width, tex.height);

    const roll = hash2(gx, gy, 6);
    let base: number, spin = 0;
    if (drifts(kind) === 'tumble') {
      base = roll * TAU;
      spin = (hash2(gx, gy, 9) - 0.5) * 0.06;
    } else {
      base = (roll - 0.5) * 0.34;
    }
    // mirroring varies a field of one kind without ever flipping a filament upside down
    sprite.scale.set(hash2(gx, gy, 8) < 0.5 ? -k : k, k);
    sprite.rotation = base;

    const homeX = (gx + 0.2 + hash2(gx, gy, 4) * 0.6) * b.cell;
    const homeY = (gy + 0.2 + hash2(gx, gy, 5) * 0.6) * b.cell;
    sprite.x = homeX; sprite.y = homeY;
    sprite.tint = shadeFor(depth, b);
    sprite.alpha = b.alpha;
    sprite.visible = true;
    this.root.addChild(sprite);

    this.live.set(key, {
      sprite, homeX, homeY, base, phase: hash2(gx, gy, 7) * 7, spin,
      wander: b.cell * (0.02 + hash2(gx, gy, 10) * 0.06),
    });
  }

  private release(key: string, p: Placed) {
    this.root.removeChild(p.sprite);
    this.free.push(p.sprite);
    this.live.delete(key);
  }
}

export class Scenery {
  /** Behind the creatures: the two slow bands that give the water its depth. */
  back = new Container();
  /** In front of them: one fast band that sweeps past the camera. */
  front = new Container();
  private layers: BandLayer[];

  constructor() {
    this.layers = BANDS.map(b => new BandLayer(b));
    this.back.addChild(this.layers[0].root, this.layers[1].root);
    this.front.addChild(this.layers[2].root);
  }

  update(camX: number, camY: number, viewW: number, viewH: number, t: number, zoom: number) {
    for (const l of this.layers) l.update(camX, camY, viewW, viewH, t, zoom);
  }
}
