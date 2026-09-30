import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { Plan } from '../content/form';
import type { Genome } from '../content/genome';
import { DIORAMA, tankIndex, type Tank } from '../content/tanks';
import { clamp, lerp } from '../core/util';
import { Terrain } from '../sim/terrain';
import { FishView } from './creature/fishview';
import { DecorView, placeDecor } from './decor';
import { PIXEL } from './pixel';
import { RoomView, stepped } from './room';
import { glowTexture } from './textures';
import { lightAt, waterColor } from './water';

/**
 * The drop-in's timeline, in seconds: the gallery fades up, the animal falls from above the
 * screen and hits the water, sinks and swims down, and the view pushes in through the glass.
 * Short — it plays at every descent and at the start of every run — and any key cuts to the end.
 */
const FADE_IN = 0.45;
const RELEASE = 0.3;
/** How long the fall from the top of the screen to the water takes, whatever the screen. */
const FALL_T = 0.6;
const SINK = 2.7;
const OUT = [2.9, 3.3] as const;
const END = 3.6;

/**
 * Milliseconds a frame spends baking the tank's inside while it is not ready. The screen is
 * black meanwhile, so the frame rate is nobody's concern; it is only kept from locking the
 * page solid.
 */
const BAKE_MS = 12;

/** Where the animal is let go — clear of the lamp — and the air line, as shares of the tank's width. */
const DROP_X = 0.63;
const PIPE_X = 0.84;
/**
 * The top of the rockscape that sits above the waterline, in tiles. Off the grid a terrain
 * is rock, so its top edge grows a rim of stone half a tile deep; the waterline is drawn
 * below it, and the rim is the part of the tank above the water that is not shown.
 */
const RIM = 0.6;

type Rgb = [number, number, number];
/** The lamp's light, and the water it lifts the tank's colour toward. */
const LAMP: Rgb = [0.62, 0.82, 1];
const LIT_WATER: Rgb = [0.12, 0.28, 0.44];

const hex = ([r, g, b]: Rgb) =>
  (Math.round(clamp(r, 0, 1) * 255) << 16) | (Math.round(clamp(g, 0, 1) * 255) << 8) | Math.round(clamp(b, 0, 1) * 255);
/** A screen length on the art grid. */
const snap = (v: number) => Math.round(v / PIXEL) * PIXEL;
const U = PIXEL;

/** The tank's place on a `W` × `H` screen: the glass's inside, and the waterline in it. */
function layout(W: number, H: number, tank: Tank) {
  const width = DIORAMA.rows[0].length * tank.tile, height = DIORAMA.rows.length * tank.tile;
  const tw = snap(Math.min(W * 0.66, H * 0.98));
  const k = tw / width;
  const air = snap(tw * 0.05);
  const water = snap((height - RIM * tank.tile) * k);
  const th = air + water;
  // a little below the middle: the tank's name is captioned over it, and the lamp hangs between
  const tx = snap((W - tw) / 2), ty = snap((H - th) / 2 + H * 0.05);
  return { tw, th, tx, ty, k, surface: ty + air };
}

/**
 * The tank's inside as the gallery sees it: the rockscape (`DIORAMA`) painted by the rooms'
 * own painters — the rock by `RoomView`, the growth by `DecorView` from the tank's set —
 * over its water, lit from a lamp above. Baked once per tank and tank width, a few
 * milliseconds at a time, at one texel to a pixel of the frame. World units; the drop-in
 * scales it onto the screen.
 */
class Diorama {
  readonly root = new Container();
  readonly terrain: Terrain;
  readonly mirror: boolean;
  private readonly room: RoomView;
  private decor: DecorView | null = null;
  private readonly water = new Sprite();
  private readonly shade = new Sprite();
  private readonly lamp = new Sprite();
  private job: Generator<void> | null;
  private deadline = 0;

  constructor(readonly tank: Tank, readonly tw: number) {
    // every other tank is the rockscape the other way round, so a descent is not the same view
    this.mirror = tankIndex(tank.id) % 2 === 1;
    const t = this.terrain = new Terrain(DIORAMA, tank, 1, 0, tank.depth, [], this.mirror);
    const d = tw / PIXEL / t.width;
    this.room = new RoomView(t, d, 0);
    this.lamp.blendMode = 'add';
    this.root.addChild(this.water, this.room.root, this.shade, this.lamp);
    this.job = this.bake(d);
  }

  get ready() { return !this.job; }

  prepare(deadline: number) {
    this.deadline = deadline;
    while (this.job && performance.now() < deadline) if (this.job.next().done) this.job = null;
  }

  update(t: number) {
    this.decor?.update(t);
    // the lamp's light breathes a little, the way light through a moving surface does
    this.lamp.alpha = 0.85 + Math.sin(t * 1.7) * 0.08 + Math.sin(t * 4.3) * 0.04;
  }

  destroy() {
    this.room.destroy();
    this.decor?.destroy();
    for (const s of [this.water, this.shade, this.lamp]) if (s.texture !== Texture.EMPTY) s.texture.destroy(true);
    this.root.destroy({ children: true });
  }

  private *bake(d: number): Generator<void> {
    const t = this.terrain;
    while (!this.room.ready) {
      this.room.prepare(this.deadline);
      if (!this.room.ready) yield;
    }
    // growth behind the rock, as in a room, and its blooms over everything; nothing hangs
    // from the rim above the waterline, since it is not there to hang from
    const decor = this.decor = new DecorView(
      placeDecor(t, 5, this.tank.id).filter(p => p.y > t.y0 + t.tile * 1.2), t.cy, d);
    yield;
    decor.update(0);
    this.root.addChildAt(decor.root, 1);
    this.root.addChild(decor.glow);
    yield;

    // the water and the lamp's light over it, from the waterline down
    const top = t.y0 + RIM * t.tile;
    const w = Math.ceil(t.width * d), h = Math.ceil((t.y0 + t.height - top) * d);
    const base = waterColor(t.cy);
    // the deep's lamp is turned down, so what glows in it is what the tank is seen by
    const strength = 0.45 + 0.55 * Math.sqrt(lightAt(t.cy) / lightAt(3200));
    const water = new ImageData(w, h), shade = new ImageData(w, h), lamp = new ImageData(w, h);
    for (let py = 0; py < h; py++) {
      const v = py / h;
      for (let px = 0; px < w; px++) {
        const u = px / w;
        // a cone from a lamp above the middle, widening as it falls, cut into rays fanning
        // from the lamp, and the whole of it spent toward the sand
        const across = Math.abs(u - 0.5), half = 0.2 + 0.34 * v;
        const cone = clamp(1 - across / half, 0, 1) ** 2.2;
        const ang = Math.atan2(u - 0.5, v + 0.35);
        const ray = 0.7 + 0.18 * Math.sin(ang * 29) + 0.12 * Math.sin(ang * 47 + 1.3);
        const fall = (1 - v) ** 1.5;
        const L = fall * (0.2 + 0.8 * cone * ray) * strength;
        const o = (py * w + px) * 4;
        // the water's own colour lifted toward the lamp's, stepped the way the rock is
        const lift = stepped(clamp(L * 0.8 + (1 - v) ** 4 * 0.18, 0, 1), 7, px, py);
        const surf = py < 2 ? 0.45 : 0;
        const c: Rgb = [0, 1, 2].map(i => lerp(lerp(base[i], LIT_WATER[i], lift), LAMP[i], surf)) as Rgb;
        water.data[o] = Math.round(c[0] * 255);
        water.data[o + 1] = Math.round(c[1] * 255);
        water.data[o + 2] = Math.round(c[2] * 255);
        water.data[o + 3] = 255;
        // the dark the lamp does not reach, over the rock and the growth: the room's own
        // lighting falls off from what glows, and this is the tank's version of it
        const dark = stepped(clamp(0.2 + 0.6 * v ** 1.1 - L * 0.9, 0, 0.8), 5, px, py);
        shade.data[o + 3] = Math.round(dark * 255);
        // and the light, added over them, so a ledge in the cone is lit
        const a = stepped(clamp(L * cone * 0.4, 0, 1), 5, px, py);
        lamp.data[o] = Math.round(LAMP[0] * 255);
        lamp.data[o + 1] = Math.round(LAMP[1] * 255);
        lamp.data[o + 2] = Math.round(LAMP[2] * 255);
        lamp.data[o + 3] = Math.round(a * 255);
      }
      if ((py & 7) === 7) yield;
    }
    for (const [sprite, img] of [[this.water, water], [this.shade, shade], [this.lamp, lamp]] as const) {
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.putImageData(img, 0, 0);
      const tex = Texture.from(canvas);
      tex.source.scaleMode = 'nearest';
      sprite.texture = tex;
      sprite.position.set(t.x0, top);
      sprite.width = t.width;
      sprite.height = t.y0 + t.height - top;
    }
  }
}

interface Drop { x: number; y: number; vx: number; vy: number }
interface Bubble { x: number; y: number; vy: number; big: boolean; phase: number }

/**
 * The drop-in: the one moment a tank is seen from outside the glass (`CONTEXT.md`). A dark
 * gallery with a lamp hung over the tank; in the glass, the tank's own rock and growth lit
 * from it; and the animal dropped in from above — a splash, a sink, a swim down — before the
 * view pushes in through the glass and play takes over. Drawn in screen space over
 * everything, on the pixel grid with the rest of the frame.
 *
 * The inside of the tank is a bake, and the tank is known before it is needed — the title
 * sits over the first one, a run swims above the next — so `prepare` bakes it ahead and a
 * drop-in can start on the frame it is asked for. One asked for early only holds black
 * until its bake is done.
 */
export class DropIn {
  readonly root = new Container();
  /** Everything but the fade, which the push-in scales about the animal. */
  private readonly stage = new Container();
  private readonly gallery = new Graphics();
  private readonly wallGlow = new Sprite(glowTexture());
  private readonly inside = new Container();
  private readonly mask = new Graphics();
  private readonly holder = new Container();
  /** The pool of light the larva carries, as it does in a room: the brightest thing in the tank. */
  private readonly pool = new Sprite(glowTexture());
  private readonly fx = new Graphics();
  private readonly frame = new Graphics();
  private readonly bulb = new Sprite(glowTexture());
  private readonly fade = new Graphics();
  private readonly dioramas = new Map<string, Diorama>();
  /** The tank the drop-in is into, and the animal dropped. */
  private tank: Tank | null = null;
  private fish: FishView | null = null;
  private size = 1;
  private t = END;
  private clock = 0;
  private drawnFor = '';
  private drops: Drop[] = [];
  private bubbles: Bubble[] = [];
  private splashed = -1;
  private fishY = 0;
  private fishV = 0;

  constructor() {
    for (const s of [this.wallGlow, this.bulb, this.pool]) {
      s.anchor.set(0.5);
      s.blendMode = 'add';
    }
    this.inside.mask = this.mask;
    this.stage.addChild(this.gallery, this.wallGlow, this.inside, this.mask, this.pool, this.holder, this.fx,
      this.frame, this.bulb);
    this.root.addChild(this.stage, this.fade);
    this.root.visible = false;
  }

  get running() { return this.t < END; }

  /** Black, with the tank gone: where a drop-in waits for the room it drops into. */
  get dark() { return this.t >= OUT[1]; }

  /** Bake `tank`'s inside for a `W` × `H` screen, until `deadline`, so a drop-in into it starts at once. */
  prepare(tank: Tank, W: number, H: number, deadline: number) {
    this.dioramaFor(tank, W, H).prepare(deadline);
  }

  private dioramaFor(tank: Tank, W: number, H: number) {
    let d = this.dioramas.get(tank.id);
    // the bake is one texel to a pixel at the tank's width, so a resized window is a new one
    const { tw } = layout(W, H, tank);
    if (!d || d.tw !== tw) {
      d?.destroy();
      d = new Diorama(tank, tw);
      this.dioramas.set(tank.id, d);
    }
    return d;
  }

  /** Drop `g` into `tank`. */
  play(tank: Tank, g: Genome, plan: Plan) {
    this.tank = tank;
    this.size = g.size;
    this.t = 0;
    this.clock = 0;
    this.splashed = -1;
    this.drops = [];
    this.bubbles = [];
    this.fishY = -Infinity;
    this.fishV = 0;
    this.fish?.destroy({ children: true });
    this.fish = new FishView(g, plan);
    this.holder.removeChildren();
    this.holder.addChild(this.fish.glow, this.fish);
    this.root.visible = true;
  }

  /** Straight to the view going into the glass. */
  skip() {
    if (this.t < OUT[0]) this.t = OUT[0];
  }

  /**
   * One frame at a `W` × `H` screen; false once it has finished. `ready` false holds it in
   * the black before the room, for the room still baking under it.
   */
  update(dt: number, W: number, H: number, ready = true): boolean {
    if (!this.running || !this.fish || !this.tank) { this.root.visible = false; return false; }
    const d = this.dioramaFor(this.tank, W, H);
    if (!d.ready && this.t < OUT[0]) {
      d.prepare(performance.now() + BAKE_MS);
      this.fade.clear().rect(0, 0, W, H).fill(0x020408);
      this.stage.visible = false;
      return true;
    }
    this.t = ready ? this.t + dt : Math.min(this.t + dt, Math.max(this.t, OUT[1]));
    this.clock += dt;
    const t = this.t;
    const L = layout(W, H, this.tank);
    const { tw, th, tx, ty, k, surface } = L;
    const key = `${W}x${H}:${d.tank.id}`;
    if (key !== this.drawnFor) {
      this.drawnFor = key;
      this.drawGallery(W, H, L, d);
      this.drawFrame(L, d);
      this.inside.removeChildren();
      this.inside.addChild(d.root);
    }
    d.root.scale.set(k);
    d.root.position.set(tx - d.terrain.x0 * k, surface - (d.terrain.y0 + RIM * d.terrain.tile) * k);
    d.update(this.clock);

    // the animal: let go above the screen, falling until it hits the water, then sinking
    // slow and levelling out into a swim
    const fx = tx + tw * DROP_X;
    // a body is drawn some three and a half times its `size` long, tail and all
    const len = this.size * 3.5 * k;
    if (this.fishY === -Infinity) this.fishY = -len;
    const g = (2 * (surface + len)) / (FALL_T * FALL_T);
    if (t > RELEASE && this.splashed < 0) {
      this.fishV += g * dt;
      this.fishY += this.fishV * dt;
      if (this.fishY >= surface) this.splash(fx, surface, tw, t);
    }
    if (this.splashed >= 0) {
      // the water takes the fall: it slows to a sink, and then the animal swims itself down
      this.fishV = lerp(this.fishV, tw * 0.04, clamp(dt * 3.5, 0, 1));
      this.fishY = Math.min(this.fishY + this.fishV * dt, surface + (th - (surface - ty)) * 0.42);
    }
    const swim = this.splashed >= 0 ? clamp((t - this.splashed) / (SINK - this.splashed), 0, 1) : 0;
    const angle = lerp(Math.PI * 0.42, 0.08, swim * swim * (3 - 2 * swim));
    this.fish.animate(dt, this.splashed >= 0 ? 0.3 + swim * 0.5 : 0, this.clock * 6, 0);
    this.holder.scale.set(k);
    this.fish.place(fx / k, this.fishY / k, angle, 1);
    this.fish.show(true, 1, 0xffffff);
    this.pool.position.set(fx, this.fishY);
    this.pool.width = this.pool.height = len * 5;
    this.pool.tint = 0xd8d0ff;
    this.pool.alpha = 0.55;
    if (this.splashed >= 0 && Math.random() < dt * 4) {
      this.bubbles.push({ x: fx + (Math.random() - 0.5) * U * 4, y: this.fishY, vy: -tw * 0.05, big: false,
        phase: Math.random() * 6 });
    }

    this.drawFx(dt, L, d);

    // in from black; out by pushing in through the glass toward the animal as it goes dark
    const out = clamp((t - OUT[0]) / (OUT[1] - OUT[0]), 0, 1);
    const push = 1 + out * out * 1.2;
    this.stage.pivot.set(fx, this.fishY);
    this.stage.position.set(fx, this.fishY);
    this.stage.scale.set(push);
    const a = t < FADE_IN ? 1 - t / FADE_IN
      : t < OUT[0] ? 0
        : t < OUT[1] ? out
          : 1 - (t - OUT[1]) / (END - OUT[1]);
    this.stage.visible = t < OUT[1];
    this.fade.clear().rect(0, 0, W, H).fill({ color: 0x020408, alpha: clamp(a, 0, 1) });
    if (!this.running) this.root.visible = false;
    return this.running;
  }

  private splash(fx: number, surface: number, tw: number, t: number) {
    this.splashed = t;
    this.fishV *= 0.25;
    for (let i = 0; i < 22; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const v = tw * (0.12 + Math.random() * 0.28);
      this.drops.push({ x: fx + (Math.random() - 0.5) * tw * 0.03, y: surface, vx: Math.cos(a) * v, vy: Math.sin(a) * v });
    }
    // the air the fall took down with it
    for (let i = 0; i < 14; i++) {
      this.bubbles.push({ x: fx + (Math.random() - 0.5) * tw * 0.04, y: surface + Math.random() * tw * 0.06,
        vy: -tw * (0.04 + Math.random() * 0.08), big: Math.random() < 0.35, phase: Math.random() * 6 });
    }
  }

  /** The water's moving parts: the waterline, the splash, the bubbles off the air line and the animal. */
  private drawFx(dt: number, L: ReturnType<typeof layout>, d: Diorama) {
    const { tw, th, tx, ty, surface } = L;
    const f = this.fx.clear();
    const px = tx + tw * (d.mirror ? 1 - PIPE_X : PIPE_X);
    const stone = surface + (th - (surface - ty)) * 0.62;
    if (Math.random() < dt * 9) {
      this.bubbles.push({ x: px, y: stone - U * 2, vy: -tw * (0.05 + Math.random() * 0.04),
        big: Math.random() < 0.25, phase: Math.random() * 6 });
    }
    // the waterline: a lit line with a wave walking along it, a pixel up where it crests
    for (let x = 0; x < tw; x += U * 3) {
      const crest = Math.sin(x * 0.06 + this.clock * 2.4) + Math.sin(x * 0.023 - this.clock * 1.3) > 1.1;
      f.rect(tx + x, surface - (crest ? U : 0), U * 3, U).fill({ color: 0xcfeaff, alpha: crest ? 0.8 : 0.5 });
    }
    // the splash: drops thrown up and falling back, and a wavelet running out each way
    for (const p of this.drops) {
      p.vy += tw * 0.9 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y > surface) continue;
      f.rect(snap(p.x), snap(p.y), U, U).fill({ color: 0xe8f4ff, alpha: 0.9 });
    }
    this.drops = this.drops.filter(p => p.y <= surface + 2);
    if (this.splashed >= 0) {
      const s = this.t - this.splashed;
      if (s < 0.9) {
        const r = s * tw * 0.16, a = 1 - s / 0.9;
        const x0 = tx + tw * DROP_X;
        for (const x of [x0 - r - U * 4, x0 + r]) {
          f.rect(snap(x), surface - U, U * 4, U).fill({ color: 0xffffff, alpha: 0.8 * a });
        }
      }
    }
    // bubbles rise wobbling and burst at the waterline
    for (const b of this.bubbles) {
      b.y += b.vy * dt;
      b.phase += dt * 5;
    }
    this.bubbles = this.bubbles.filter(b => b.y > surface + U);
    for (const b of this.bubbles) {
      const x = snap(b.x + Math.sin(b.phase) * U), y = snap(b.y);
      if (b.big) {
        f.rect(x - U, y, U, U).rect(x + U, y, U, U).rect(x, y - U, U, U).rect(x, y + U, U, U)
          .fill({ color: 0xcfeaff, alpha: 0.55 });
      } else {
        f.rect(x, y, U, U).fill({ color: 0xcfeaff, alpha: 0.6 });
      }
    }
  }

  /**
   * The gallery: a dark brick wall the tank's light falls on, the stand the tank sits on and
   * the floor, the lamp hung over the water, and the air inside the glass above the waterline.
   */
  private drawGallery(W: number, H: number, L: ReturnType<typeof layout>, d: Diorama) {
    const { tw, th, tx, ty, surface } = L;
    const g = this.gallery.clear();
    const rimB = snap(tw * 0.035), lip = snap(tw * 0.03);
    const standTop = ty + th + rimB, standH = snap(Math.min(tw * 0.14, H - standTop - U * 6));
    const floorY = standTop + Math.max(standH, U * 4);

    // the wall: courses of brick, a shade lighter than the mortar, a few odd ones out
    g.rect(0, 0, W, floorY).fill(0x04060b);
    const ch = U * 6, bw = U * 16;
    for (let row = 0, y = 0; y < floorY; row++, y += ch) {
      const off = row % 2 ? bw / 2 : 0;
      for (let x = -off; x < W; x += bw) {
        const hsh = ((row * 73856093) ^ (Math.round(x / bw) * 19349663)) >>> 0;
        const c = hsh % 11 === 0 ? 0x0b0f18 : hsh % 5 === 0 ? 0x080b12 : 0x070a10;
        const x0 = Math.max(0, x + U), x1 = Math.min(W, x + bw);
        if (x1 > x0) g.rect(x0, y + U, x1 - x0, Math.min(ch - U, floorY - y - U)).fill(c);
      }
    }
    // the floor, and the tank's light lying on it in front of the stand
    const [wr, wg, wb] = waterColor(d.tank.depth);
    g.rect(0, floorY, W, H - floorY).fill(0x06080d);
    g.rect(0, floorY, W, U).fill(0x0e131c);
    g.rect(tx, floorY + U, tw, snap((H - floorY) * 0.5)).fill({ color: hex([wr * 3, wg * 3, wb * 3]), alpha: 0.05 });

    // the stand: a dark cabinet, lit along its top, two doors and a brass plate
    const sx = tx - lip, sw = tw + lip * 2;
    g.rect(sx, standTop, sw, standH).fill(0x0c1018);
    g.rect(sx, standTop, sw, U).fill(0x1c2432);
    if (standH > U * 10) {
      const inset = U * 3, doorW = snap((sw - inset * 3) / 2);
      for (const x of [sx + inset, sx + inset * 2 + doorW]) {
        g.rect(x, standTop + inset, doorW, standH - inset * 2).fill(0x0f141e);
        g.rect(x, standTop + inset, doorW, U).fill(0x151b27);
      }
      const plateW = snap(tw * 0.1);
      g.rect(snap(tx + tw / 2 - plateW / 2), standTop + inset + U * 2, plateW, U * 3).fill(0x5a4527);
      g.rect(snap(tx + tw / 2 - plateW / 2), standTop + inset + U * 2, plateW, U).fill(0x8a6c3c);
    }

    // the lamp, hung on its cable over the middle of the water
    // hung low, just over the rim, so the caption above has the wall to itself
    const rimT = Math.max(U * 2, snap(tw * 0.018));
    const lx = snap(tx + tw / 2), shadeH = snap(tw * 0.03), shadeBot = ty - rimT - U * 5;
    const shadeTop = shadeBot - shadeH;
    g.rect(lx - U / 2, 0, U, Math.max(0, shadeTop)).fill(0x121722);
    const steps = Math.max(1, Math.round(shadeH / U));
    for (let i = 0; i < steps; i++) {
      const half = snap(tw * 0.02 + (tw * 0.05 * i) / steps);
      g.rect(lx - half, shadeTop + i * U, half * 2, U).fill(i === 0 ? 0x2a3446 : 0x182030);
    }
    const halfBot = snap(tw * 0.07);
    g.rect(lx - halfBot, shadeBot, halfBot * 2, U).fill(0x4a5a72);
    g.rect(lx - U * 3, shadeBot + U, U * 6, U).fill(0xfff4d6);
    this.bulb.position.set(lx, shadeBot + U);
    this.bulb.width = this.bulb.height = tw * 0.5;
    this.bulb.tint = hex(LAMP);
    this.bulb.alpha = 0.35;

    // the tank's light on the wall behind it
    this.wallGlow.position.set(tx + tw / 2, ty + th / 2);
    this.wallGlow.width = tw * 1.9;
    this.wallGlow.height = th * 2.2;
    this.wallGlow.tint = hex([wr * 4 + 0.05, wg * 4 + 0.08, wb * 4 + 0.12]);
    this.wallGlow.alpha = 0.3;

    // inside the glass, above the waterline: the dim air under the lamp
    g.rect(tx, ty, tw, surface - ty).fill(0x0a121d);
    g.rect(tx, ty, tw, U).fill(0x121c2a);
    this.mask.clear().rect(tx, surface, tw, ty + th - surface).fill(0xffffff);
  }

  /** The glass and its frame: a riveted rim over and under the water, the posts, the air line, the glare. */
  private drawFrame(L: ReturnType<typeof layout>, d: Diorama) {
    const { tw, th, tx, ty, surface } = L;
    const g = this.frame.clear();
    const post = Math.max(U * 2, snap(tw * 0.012)), rimT = Math.max(U * 2, snap(tw * 0.018));
    const rimB = snap(tw * 0.035);
    const rivets = (y: number, x0: number, x1: number) => {
      for (let x = x0 + U * 4; x < x1 - U * 3; x += U * 14) g.rect(snap(x), y, U, U).fill(0x5a6a82);
    };

    // the air line: a hose down the inside of the glass into the water, a stone at its end
    const px = snap(tx + tw * (d.mirror ? 1 - PIPE_X : PIPE_X));
    const stone = snap(surface + (th - (surface - ty)) * 0.62);
    g.rect(px, ty, U, stone - ty).fill(0x223040);
    g.rect(px + U, ty, U, stone - ty).fill(0x152030);
    g.rect(px - U, stone, U * 4, U * 2).fill(0x3a4658);

    // the glass: a faint sheen over all of it, and two streaks of glare leaning across it
    g.rect(tx, ty, tw, th).fill({ color: 0xffffff, alpha: 0.015 });
    for (let y = 0; y < th; y += U) {
      const x = snap(tw * 0.08 + (th - y) * 0.35);
      g.rect(tx + x, ty + y, U * 3, U).fill({ color: 0xffffff, alpha: 0.045 });
      g.rect(tx + x + U * 6, ty + y, U, U).fill({ color: 0xffffff, alpha: 0.035 });
    }

    // the frame: posts at the panes' edges, a rim over the water and a deeper one under the sand
    g.rect(tx - post, ty - rimT, post, th + rimT + rimB).fill(0x111723);
    g.rect(tx + tw, ty - rimT, post, th + rimT + rimB).fill(0x111723);
    g.rect(tx - U, ty, U, th).fill(0x223049);
    g.rect(tx + tw, ty, U, th).fill(0x1a2538);
    g.rect(tx - post, ty - rimT, tw + post * 2, rimT).fill(0x1a2130);
    g.rect(tx - post, ty - rimT, tw + post * 2, U).fill(0x3c4a62);
    rivets(ty - rimT + U, tx - post, tx + tw + post);
    g.rect(tx - post, ty + th, tw + post * 2, rimB).fill(0x151b27);
    g.rect(tx - post, ty + th, tw + post * 2, U).fill(0x2c3850);
    rivets(snap(ty + th + rimB / 2), tx - post, tx + tw + post);
    // corner plates, where the rims meet the posts
    for (const x of [tx - post - U, tx + tw - U]) {
      for (const y of [ty - rimT - U, ty + th + rimB - rimT - U]) {
        g.rect(x, y, post + U * 2, rimT + U * 2).fill(0x232c3d);
        g.rect(x, y, post + U * 2, U).fill(0x46546c);
        g.rect(snap(x + (post + U * 2) / 2 - U / 2), snap(y + (rimT + U * 2) / 2), U, U).fill(0x6a7a92);
      }
    }
  }
}
