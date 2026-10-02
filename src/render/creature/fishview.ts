/**
 * A creature seen side-on: one continuous surface that swims.
 *
 * It faces the way it swims by pitching toward its heading, and turns back by flipping: the
 * strip is mirrored in the frame the facing changes, and a squish and a crackle of displaced
 * texels as it settles are the whole of the turn. `face` is decided by the simulation
 * (`Creature.drive`, `faceFor`), because the lure's strike point has to agree with where the
 * light is drawn.
 *
 * The art is painted flat and baked into a texture once per distinct genome (`fishbake.ts`).
 * That texture is skinned onto a triangle strip whose centre line is a travelling wave, so
 * swimming moves vertices and never geometry. Nothing is re-issued per frame and no part of
 * the animal can overlap another part of it, because there are no parts — the jointed chain
 * this replaced showed its seams at every bend, and no draw order fixes two rigid pieces
 * that rotate about different points.
 *
 * Per frame this costs `2 × COLS` vertex writes and nothing else. The old view rebuilt no
 * geometry either, but it carried five `Graphics` objects per creature; this carries one
 * mesh and a shared texture, so a school is cheap in memory as well as in draw calls.
 */
import { Container, MeshSimple, Sprite } from 'pixi.js';
import { bakeFish, releaseFish, type Baked, type Rig } from './fishbake';
import { SPRITES } from '../../content/sprites';
import type { Species } from '../../content/species';
import { drawnAngle, PLAN_ART, quintic, R, type Plan } from '../../content/form';
import { menace, type Genome } from '../../content/genome';
import { glowTexture } from '../textures';
import type { Light } from '../lighting';
import { hsl, lerp } from '../../core/util';
import { artDensity, artVersion } from '../pixel';
import { livingSkin, type LivingSkin } from './living';
import type { Emitter } from './bake/sheet';

interface Motion {
  /** Columns in the strip. More only pays where the body is long enough to hold a wave. */
  cols: number;
  /** How many full waves of undulation fit on the body at once. */
  waves: number;
  /** Peak lateral sway, as a fraction of the strip's half-height. */
  amp: number;
  /** Bell contraction, for the things that swim by squeezing. */
  pulse: number;
}

/**
 * The plan's motion, bent by the locomotion organs — the swim is part of what the body
 * says. An eel carries more of the wave and needs the columns to hold it; a lurker barely
 * sways; a mantle contracts on its pulse, and the bell's squeeze is already in the pose.
 */
function motionFor(g: Genome, plan: Plan): Motion {
  const m = MOTION[plan];
  const eel = Math.min(1, g.eel);
  return {
    cols: m.cols + Math.round(eel * 14),
    waves: m.waves + eel * 0.8,
    amp: (m.amp + eel * 0.2) * (1 - Math.min(1, g.lurk) * 0.35),
    pulse: Math.max(m.pulse, Math.min(1, g.mantle) * 0.2),
  };
}

const MOTION: Record<Plan, Motion> = {
  microbe:   { cols: 14, waves: 0.5, amp: 0.16, pulse: 0.14 },
  darter:    { cols: 22, waves: 0.85, amp: 0.5, pulse: 0 },
  shark:     { cols: 26, waves: 0.65, amp: 0.34, pulse: 0 },
  eel:       { cols: 40, waves: 1.9, amp: 0.85, pulse: 0 },
  jelly:     { cols: 16, waves: 0.4, amp: 0.14, pulse: 0.3 },
  squid:     { cols: 22, waves: 0.7, amp: 0.3, pulse: 0.22 },
  angler:    { cols: 20, waves: 0.8, amp: 0.42, pulse: 0 },
  leviathan: { cols: 32, waves: 0.95, amp: 0.4, pulse: 0 },
  greatshark: { cols: 28, waves: 0.6, amp: 0.3, pulse: 0 },
  // a whale drives from the very back and barely bends: the wave is long and shallow
  whale:      { cols: 30, waves: 0.5, amp: 0.24, pulse: 0 },
  longsquid:  { cols: 26, waves: 0.6, amp: 0.26, pulse: 0.26 },
  broadsquid: { cols: 24, waves: 0.65, amp: 0.28, pulse: 0.32 },
  // an armoured trunk barely bends; the tail fan does the swimming
  mantis:     { cols: 26, waves: 0.55, amp: 0.2, pulse: 0 },
  // more columns than its length asks for: a veil shows every kink a coarse strip has
  wraith:    { cols: 34, waves: 1.15, amp: 0.55, pulse: 0 },
};

/**
 * What a body is doing beyond swimming, for this frame — read off the simulation's state by
 * `Creature.pose`. The view owns how each one looks; the simulation only says which.
 */
export interface Pose {
  /** How far into a strike's wind-up, 0 to 1: the body draws back and coils, jaw opening. */
  windup: number;
  /** How much of the strike is left, 1 as it is thrown down to 0: the lunge, stretched. */
  strike: number;
  /** The jaw open — a strike, a guardian's tell, or the player with prey at its mouth. */
  open: boolean;
  /** How much of a swim stroke is left, 1 as it is kicked down to 0: only the player's. */
  burst?: number;
}
export const REST: Pose = { windup: 0, strike: 0, open: false };

/**
 * Seconds a flip's squish and displaced texels take to settle. The body is round in the frame
 * the facing changes; this is all the motion the turn has, so it is short enough to read as
 * the snap's recoil rather than as an animation of its own. A turn animated through its
 * in-betweens — a roll about the spine, then a yaw folding nose to tail — read as slow to
 * steer at any length that still showed the fold (`docs/decisions.md`).
 */
const FLIP_TIME = 0.2;

/** Columns per rigged arm. An arm is thin, so it needs length resolution and nothing else. */
const ARM_COLS = 12;

/**
 * How much of a plan's sway survives turning the animal on its side. A fish swims by
 * flexing side to side, which from the side is mostly into and out of the screen: the full
 * lateral amplitude drawn as a vertical wave reads as a dolphin kick. An eel keeps more of
 * it, since `motionFor` adds its share on top.
 */
const SIDE_ON = 0.45;

/**
 * The flinch: how far a blow knocks the drawn body along it at its peak, in body sizes, and
 * how much of it the body is white before it turns red — about the first 80 ms, while the
 * hit's light is at its brightest.
 */
const KNOCK = 0.18;
const HURT_WHITE = 0.72;

/**
 * A thud against rock (`bump`): seconds it rings for, and how many half-swings it makes in
 * that — squashed against the rock, sprung long off it, and settling — so a big body reads as
 * heavy and elastic rather than stopped. `BUMP_SQUASH` is the squash at a full-weight thud,
 * `BUMP_REEL` the turn off a blow at the end of the body, in radians.
 */
const BUMP_TIME = 0.45;
const BUMP_SWINGS = 3;
const BUMP_SQUASH = 0.24;
const BUMP_REEL = 0.22;

/**
 * Tucking into a crack (`nestle`): seconds it plays for; how far the body sinks back into it
 * and comes up again, in sizes; how much narrower it squeezes; and the tail's wriggle, radians
 * and swings — a larva working itself into the rock rather than a sprite turned on end.
 */
const NESTLE_TIME = 0.55;
const NESTLE_DIP = 0.22;
const NESTLE_SQUEEZE = 0.16;
const NESTLE_WRIGGLE = 0.14;
const NESTLE_SWINGS = 5;

/**
 * A carcass glows red: a rim of it round the silhouette (the skin's `uRim`), a bloom and a
 * light. Dimmed grey and floating among the rock and the decoration, a kill left to be eaten
 * was lost in the room; red is the colour nothing alive in the water is drawn in but blood.
 * It comes up once the roll is done, and throbs slowly, the way a light that is not a lamp does.
 */
const EMBER = 0xff2a1e;
const EMBER_IN = 0.4;

export class FishView extends Container {
  /**
   * The additive bloom, deliberately NOT a child of this container. Every creature's
   * glow is parented into one additive layer of the world instead: a blend-mode change
   * between the meshes breaks the sprite batch, so keeping the three sprites here would
   * cost one state change per animal on screen. This view only keeps it in step.
   */
  readonly glow = new Container();
  /**
   * A cloud of darker water the animal drags with it. It cannot live in `glow`: that layer
   * is additive so it can batch, and additive can only ever brighten. Darkening needs a
   * normal-blended sprite, which means a layer of its own — `world.fog`, under the bodies.
   */
  readonly fog = new Container();
  private murk = new Sprite(glowTexture());
  /** A bruised red bloom that grows as the animal becomes something to run from. */
  private aura = new Sprite(glowTexture());
  private halo = new Sprite(glowTexture());
  /**
   * One small bloom per light organ the bake recorded — photophores, the lure, a guardian's
   * eye. The organ itself is a single hot pixel, and a lamp one texel across is only a lamp
   * if light comes off it. In `glow` with the rest, so every lamp on screen is one batch.
   */
  private lamps: { s: Sprite; e: Emitter; phase: number }[] = [];
  /** A tight, hot centre inside the halo — the halo alone reads as fog, not as a light. */
  private core = new Sprite(glowTexture());
  /** A carcass's red bloom (`EMBER`); hidden while the body lives. */
  private ember = new Sprite(glowTexture());
  private mesh: MeshSimple | null = null;
  /** The shader the strip is drawn with: sub-pixel sampling and displaced fins (`living.ts`). */
  private skin: LivingSkin | null = null;
  private verts = new Float32Array(0);
  private colX: number[] = [];
  private baked: Baked | null = null;
  private motion = MOTION.darter;
  /** Counts down from 1 through a bite, driving the squash-and-snap. */
  private chompT = 0;
  /** Rigged arms, one strip each, under the body. Empty for anything without `grasp`. */
  private arms: { mesh: MeshSimple; verts: Float32Array; feeding: boolean; torn?: boolean }[] = [];
  /** The arms' own clock: `beat` jumps on a boost, and a jump reads as a twitch in an arm. */
  private armT = Math.random() * 10;
  /** How far the feeding pair is out toward `grip`, 0 coiled to 1 fastened. */
  private strike = 0;
  /** What the feeding pair is holding, read for its live world position; null when nothing. */
  private grip: { x: number; y: number } | null = null;
  /** 1 heading toward +x, -1 toward -x. Set by `place`. */
  private face: 1 | -1 = 1;
  /** The facing the strip is drawn at, which catches up with `face` in `animate`. */
  private facing: 1 | -1 = 1;
  /** 1 on the frame the body flips round, down to 0 as its recoil settles. */
  private flipT = 0;
  private placed = false;
  /** The body's scale this frame, set by `animate` and applied in `place`. */
  private sx = 1;
  private sy = 1;
  /** Idle hover and the strike's draw-back, in world units, applied by `place`. */
  private bob = 0;
  private sway = 0;
  private recoil = 0;
  private clock = Math.random() * 10;
  /** A flinch, 1 as the wound lands down to 0: knocked along the blow, a flash, then red. */
  private hurtT = 0;
  /** Which way the last blow was going, as a unit vector: the flinch throws the drawn body along it. */
  private knockX = 0;
  private knockY = 0;
  /** A thud against rock, 1 as it lands down to 0; how hard, how nose-on, and which way it turns the body. */
  private bumpT = 0;
  private bumpK = 0;
  private bumpAlong = 0;
  private bumpTip = 0;
  /** The turn a thud gives the body this frame, radians, applied by `place`. */
  private reel = 0;
  /** Tucking into a crack, 1 as it starts down to 0 (`nestle`). */
  private nestT = 0;
  /** Which texture is on the mesh: the mouth shut, or open to strike. */
  private gaping = false;
  /** Set once the animal is dead and this view is playing its death. */
  private deathT = -1;
  private fall = { vx: 0, vy: 0, whole: false };
  /** The art density this view was baked at; a new tier means a re-bake. */
  private version = artVersion;

  /** A species drawn from a sprite (`content/sprites.ts`) rather than painted, or none. */
  private readonly art?: string;
  /** How much bigger than its genome the species is drawn (`Species.drawn`). */
  private readonly drawn: number;
  /** The genome as given, before the drawn size: what a re-bake starts from. */
  private source!: Genome;

  /**
   * `species`, for an animal of the roster: whether it has a sprite and how big it is drawn.
   * Only an animal that never changes has either, so a transformation never meets them.
   */
  constructor(private g: Genome, private plan: Plan = 'darter', species?: Species) {
    super();
    this.art = species && SPRITES[species.id] ? species.id : undefined;
    this.drawn = species?.drawn ?? 1;
    for (const s of [this.aura, this.halo, this.core, this.ember]) {
      s.anchor.set(0.5);
      s.blendMode = 'add';
    }
    this.ember.tint = EMBER;
    this.ember.visible = false;
    this.glow.addChild(this.aura, this.halo, this.core, this.ember);
    this.murk.anchor.set(0.5);
    this.fog.addChild(this.murk);
    this.rebuild(g);
  }

  /**
   * Body and bloom are in different layers, so they are moved together from here — and
   * this is the one place the body's final transform is put together: its facing, the
   * pitch, the hover and the strike's draw-back on top of where the simulation has it.
   */
  place(x: number, y: number, heading: number, face: 1 | -1 = 1, upright = 0) {
    this.face = face;
    // a view that first appears facing -x is already turned, not flipping
    if (!this.placed) { this.placed = true; this.facing = face; }
    // The mirror is in the strip, so the frame only pitches. The pitch is the same climb or
    // dive either way round, which as a rotation is its negative in the mirrored frame.
    const pitch = drawnAngle(heading, face, upright) * face;
    let r = pitch * this.facing + this.sway + this.reel;
    if (this.nestT > 0) {
      // worked into the crack: sunk back down its length and up again, the tail wriggling
      const e = 1 - this.nestT;
      const dip = Math.sin(e * Math.PI) * this.g.size * NESTLE_DIP;
      x -= Math.cos(r) * this.facing * dip;
      y -= Math.sin(r) * this.facing * dip;
      r += Math.sin(e * Math.PI * NESTLE_SWINGS) * NESTLE_WRIGGLE * this.nestT;
    }
    const unit = this.g.size / R * this.swell;
    this.scale.set(unit * this.sx, unit * this.sy);
    // drawn back along the heading on a wind-up — the coil before the spring
    x -= Math.cos(heading) * this.recoil;
    y -= Math.sin(heading) * this.recoil - this.bob;
    // knocked along the blow, and back: the view only, the body's own shove is the sim's
    const knock = this.hurtT * this.hurtT * this.g.size * KNOCK;
    x += this.knockX * knock;
    y += this.knockY * knock;
    this.x = x; this.y = y; this.rotation = r;
    this.glow.x = x; this.glow.y = y;
    // the glow layer is not rotated or mirrored with the body, so each lamp is carried
    // through the body's own transform by hand. The swim wave is left out: it moves the
    // tail far more than the flank, and a lamp a pixel off its organ is not visible
    if (this.lamps.length) {
      const c = Math.cos(r), s = Math.sin(r);
      const kx = this.scale.x, ky = this.scale.y;
      for (const { s: sp, e } of this.lamps) {
        const lx = e.x * this.facing * kx, ly = e.y * ky;
        sp.position.set(lx * c - ly * s, lx * s + ly * c);
      }
    }
    this.fog.x = x; this.fog.y = y;
  }

  /**
   * Culling, fog and the danger tint are decided per creature by `main`, and the bloom
   * has to take all three: it is the same animal, lit from inside.
   */
  show(visible: boolean, alpha: number, tint: number) {
    if (this.deathT >= 0) return;
    this.visible = this.glow.visible = visible;
    // a wound turns the body white for its first few frames (the skin's `uFlash`), lit by
    // the light the hit threw (`Impacts`), and then red, fading. It used to blink at once,
    // which hid the body in the very frames that were meant to show the hit land
    const h = this.hurtT;
    this.alpha = alpha;
    this.glow.alpha = alpha;
    this.tint = h > HURT_WHITE ? 0xffffff
      : h > 0 ? mul(tint, lerpColor(0xffffff, 0xff5a4e, (h / HURT_WHITE) * 0.85)) : tint;
    this.glow.tint = tint;
    // the fog takes culling and distance, but not the danger tint: it is absence of light,
    // so tinting it would only make it glow in whatever colour the tint happens to be
    this.fog.visible = visible;
    this.fog.alpha = alpha;
  }

  /**
   * The light this body throws on the room (`render/lighting.ts`): one light per lamp where
   * the lamp is, and one round the body for a real light organ or a pale body's own glow.
   * Reach is in world units — this is light falling on rock, not the bloom in the eye.
   */
  shine(out: Light[]) {
    if (!this.visible || this.glow.alpha <= 0.02) return;
    const a = this.glow.alpha;
    const R = this.g.size * 0.62;
    // a carcass's own lights are out; what is left is the ember
    if (this.ember.visible) {
      out.push({ x: this.glow.x, y: this.glow.y, r: R * 3, color: EMBER, a: this.ember.alpha * a });
      return;
    }
    const own = Math.max(this.g.glow, this.g.pale * 0.6);
    if (own > 0.05) out.push({ x: this.glow.x, y: this.glow.y, r: R * (3 + own * 5),
      color: this.halo.tint as number, a: Math.min(1, own) * a });
    for (const { s, e } of this.lamps) {
      out.push({ x: this.glow.x + s.x, y: this.glow.y + s.y, r: R * (1.4 + e.strength * 2.2),
        color: e.color, a: s.alpha * a });
    }
  }

  /** A bloom per light organ, sized in pixels of the frame rather than in body lengths. */
  private hangLamps(lights: Emitter[]) {
    for (const l of this.lamps) l.s.destroy();
    this.lamps = [];
    // a lamp's reach is a few pixels of the frame whatever the animal's size: sized off the
    // body, a leviathan's photophores would be searchlights and a lanternfish's invisible
    const px = 1 / artDensity();
    for (const e of lights) {
      const s = new Sprite(glowTexture());
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.tint = e.color;
      s.width = s.height = px * (5 + e.strength * 9);
      this.glow.addChild(s);
      this.lamps.push({ s, e, phase: Math.random() * 6.28 });
    }
  }

  /** The bloom is not a child, so it does not go down with the rest of the view. */
  destroy(options?: Parameters<Container['destroy']>[0]) {
    if (this.baked) { releaseFish(this.baked); this.baked = null; }
    // a mesh does not free its shader, and this one holds the skin's uniforms
    this.skin?.shader.destroy();
    this.skin = null;
    if (!this.glow.destroyed) this.glow.destroy({ children: true });
    if (!this.fog.destroyed) this.fog.destroy({ children: true });
    super.destroy(options);
  }

  /** A new silhouette for the same animal — the player's transformation. */
  setPlan(plan: Plan, g: Genome) {
    this.plan = plan;
    this.rebuild(g);
  }

  rebuild(g: Genome) {
    this.source = g;
    // everything the view draws reads the size off the genome it holds, so a species drawn
    // bigger holds a copy at the size it is drawn
    if (this.drawn !== 1) g = { ...g, size: g.size * this.drawn };
    this.g = g;
    this.version = artVersion;
    const m = this.motion = motionFor(g, this.plan);
    const men = menace(g);

    this.mesh?.destroy();
    for (const a of this.arms) a.mesh.destroy();
    this.arms = [];
    // take the new texture before letting go of the old one, so a rebuild onto the same
    // genome never leaves the entry at zero users for an eviction to catch
    const old = this.baked;
    this.baked = bakeFish(g, this.plan, this.art);
    this.hangLamps(this.baked.lights);
    if (old) releaseFish(old);
    const { front, back } = this.baked;

    const cols = m.cols;
    const verts = new Float32Array(cols * 4);
    const uvs = new Float32Array(cols * 4);
    const idx = new Uint32Array((cols - 1) * 6);
    this.colX = [];
    for (let j = 0; j < cols; j++) {
      const x = lerp(front, back, j / (cols - 1));
      this.colX.push(x);
      // u runs with the texture's x, which increases to the right, while the columns run
      // nose to tail, which decreases. Reading the column index into u mirrors the animal.
      const u = (x - back) / (front - back);
      uvs[j * 4] = u; uvs[j * 4 + 1] = 0;
      uvs[j * 4 + 2] = u; uvs[j * 4 + 3] = 1;
      // tail first, so the head is drawn over it wherever a hard bend laps the strip back
      // across itself
      if (j < cols - 1) {
        const a = j * 2;
        idx.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], (cols - 2 - j) * 6);
      }
    }
    this.verts = verts;
    // arms first, so they sit under the body: the crown is tucked beneath the head
    const rig = this.baked.arm;
    if (rig) {
      const A = PLAN_ART[this.plan];
      const auv = new Float32Array(ARM_COLS * 4);
      const aidx = new Uint32Array((ARM_COLS - 1) * 6);
      for (let j = 0; j < ARM_COLS; j++) {
        const u = j / (ARM_COLS - 1);
        auv.set([u, 0, u, 1], j * 4);
        if (j < ARM_COLS - 1) {
          const a = j * 2;
          aidx.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], j * 6);
        }
      }
      for (let i = 0; i < A.armCount; i++) {
        const averts = new Float32Array(ARM_COLS * 4);
        const mesh = new MeshSimple({ texture: rig.texture, vertices: averts, uvs: auv,
                                      indices: aidx });
        this.addChild(mesh);
        // the outermost pair are the feeding tentacles, as they were in the painted crown
        this.arms.push({ mesh, verts: averts,
                         feeding: i === 0 || i === A.armCount - 1 });
      }
    }
    this.skin?.shader.destroy();
    this.skin = livingSkin(this.baked.texture, this.baked.depth / this.baked.halfH);
    this.mesh = new MeshSimple({ texture: this.baked.texture, vertices: verts, uvs,
                                 indices: idx, shader: this.skin.shader });
    this.addChild(this.mesh);

    // emission and dread stay sprites: they are light, not body.
    // Every animal carries a floor of it, glowing organs or not — against water this dark
    // an unlit body is a hole in the frame, and the bloom is what gives it a silhouette
    // without stroking one.
    // heated by menace as the painted accent is (`palette.ts`), and no further than the plan
    // lets it: an angler's halo is the colour of its lure, not a warning
    const heat = men * 0.75 * PLAN_ART[this.plan].heat;
    const tint = hsl(lerp(g.accentHue, g.accentHue > 180 ? 22 : 8, heat), 0.6 + men * 0.3, 0.55);
    this.halo.visible = true;
    const gr = R * (4 + g.glow * 7);
    this.halo.width = this.halo.height = gr * 2;
    this.halo.tint = tint;
    // the floor is lower than it was before the pixel outline and rim: those carry the
    // silhouette in dark water now, and a disc of light round every animal reads as a
    // spotlight on each of them rather than as bioluminescence
    // a pale body is lit from within, so it carries a real halo whatever its organs
    this.halo.alpha = Math.min(0.95, 0.13 + g.glow * 0.65 + g.pale * 0.3);
    // the core sits inside the body's own width, so it lifts the animal's value rather
    // than spilling a second disc of light around it
    // and only a real light organ gets one: on an unlit animal it lands as a hot white
    // spot in the middle of the body, which reads as a bug rather than as bioluminescence
    this.core.visible = g.glow > 0.05;
    const cr = R * (1.5 + g.glow * 1.6);
    this.core.width = this.core.height = cr * 2;
    this.core.tint = hsl(lerp(g.accentHue, g.accentHue > 180 ? 22 : 8, heat),
                         0.45 + men * 0.35, 0.72);
    this.core.alpha = Math.min(0.8, g.glow * 0.75);
    this.aura.visible = men > 0.25;
    if (this.aura.visible) {
      const ar = R * (3 + men * 3.4);
      this.aura.width = this.aura.height = ar * 2;
      this.aura.tint = hsl(lerp(24, 2, men), 0.85, 0.4);
      this.aura.alpha = (men - 0.25) * 0.3;
    }

    // scaled off the body rather than fixed in world units like the bloom above, so a
    // 300 cm leviathan is not wearing the same cloud as a 119 cm shark
    const fogK = PLAN_ART[this.plan].fog;
    this.murk.visible = fogK > 0;
    if (fogK > 0) {
      const fr = g.size * (1.5 + fogK * 0.7);
      this.murk.width = this.murk.height = fr;
      this.murk.tint = 0x03070c;
      this.murk.alpha = Math.min(0.62, 0.3 + fogK * 0.16);
    }

    this.gaping = false;
    this.pose(0, 0, 0.5, 0);
    this.scale.set(g.size / R * this.sx, g.size / R * this.sy);
  }

  chomp() {
    this.chompT = 1;
  }

  /** A wound landed on this body, from a blow going (`dx`, `dy`) — any length; none is no knock. */
  /**
   * The body met rock (`World.meetRock`): `k` how hard, 0 to 1; `along` 1 for nose- or tail-on
   * and 0 for a flank laid on it, which is the axis it squashes on; `tip` which way and how far
   * from its middle the blow landed, which turns it off the rock.
   */
  bump(k: number, along: number, tip: number) {
    // a harder thud over a ringing one takes over; a lighter one is lost in it
    if (this.bumpT * this.bumpK > k) return;
    this.bumpT = 1;
    this.bumpK = k;
    this.bumpAlong = along;
    this.bumpTip = tip;
  }

  /** The body has tucked itself into a crack (`PlayerController.nook`): the settle. */
  nestle() {
    this.nestT = 1;
  }

  hurt(dx = 0, dy = 0) {
    this.hurtT = 1;
    const d = Math.hypot(dx, dy);
    this.knockX = d > 0 ? dx / d : 0;
    this.knockY = d > 0 ? dy / d : 0;
  }

  /**
   * The animal is dead: play its death from here instead of vanishing. Swallowed whole it
   * goes down the throat that took it; otherwise it rolls belly-up, sinks and fades, the way
   * a dead fish does. The view carries the drift it died with, since nothing simulates it.
   */
  die(vx: number, vy: number, whole: boolean) {
    this.deathT = 0;
    this.fall = { vx, vy, whole };
    this.hurtT = 0;
    // a carcass swallowed goes down the throat without its rim; its ember fades with the rest
    this.deadSkin(0);
  }

  /**
   * A carcass: rolled belly-up over the first third of a second, then lying dim wherever
   * the world has it (`World` sinks it onto the floor). Unlike `dying` it never fades — a
   * carcass stays in the room until it is swallowed or the room is left.
   */
  lie(dt: number, x: number, y: number) {
    this.deathT += dt;
    const unit = this.g.size / R;
    const roll = Math.min(1, this.deathT / 0.35);
    this.scale.y = unit * Math.max(0.12, Math.abs(Math.cos(roll * Math.PI))) * (roll < 0.5 ? 1 : -1);
    // floating, not lying: a slow rise and fall once the roll is done, each on its own phase
    const bob = Math.sin(this.deathT * 1.3 + this.clock) * this.g.size * 0.06 * roll;
    this.x = x; this.y = y + bob;
    this.rotation += (Math.round(this.rotation / Math.PI) * Math.PI - this.rotation) * Math.min(1, dt * 3);
    this.alpha = 1;
    this.tint = 0x8f96a4;
    if (roll >= 1 && this.mesh && this.baked) this.skinWith(this.baked.texture);
    // the body's own lights go out over the roll, and then the ember comes up in their place
    const lit = Math.min(1, Math.max(0, (this.deathT - 0.35) / EMBER_IN));
    if (lit > 0 && !this.ember.visible) {
      for (const s of [this.aura, this.halo, this.core]) s.visible = false;
      for (const { s } of this.lamps) s.visible = false;
      this.ember.visible = true;
    }
    const throb = 0.85 + 0.15 * Math.sin(this.deathT * 2.4 + this.clock);
    this.glow.alpha = this.ember.visible ? 1 : Math.max(0, 1 - this.deathT * 3);
    this.ember.alpha = lit * throb * 0.55;
    this.ember.width = this.g.size * 2.2;
    this.ember.height = this.g.size * 1.3;
    this.ember.y = bob;
    this.deadSkin(lit * throb);
    this.glow.x = this.fog.x = x;
    this.glow.y = this.fog.y = y;
    this.fog.alpha = 0;
  }

  /**
   * The skin of a dead body: its carcass rim, 0 to 1, and no hit flash. `animate` is what
   * clears the flash, and a dead body is no longer animated, so a kill by a blow stayed
   * white for as long as the carcass lay there.
   */
  private deadSkin(rim: number) {
    if (!this.skin) return;
    const u = this.skin.uniforms.uniforms;
    u.uRim = rim;
    u.uFlash = 0;
    this.skin.uniforms.update();
  }

  /**
   * One frame of the death; true once it has finished and the view can go. `mouth` is where
   * the swallower's mouth is now, for a body taken whole.
   */
  dying(dt: number, mouth: { x: number; y: number } | null): boolean {
    this.deathT += dt;
    const t = this.deathT;
    const unit = this.g.size / R;
    if (this.fall.whole) {
      // drawn in over a fifth of a second, shrinking as it goes down
      const k = Math.min(1, t / 0.2);
      if (mouth) {
        this.x += (mouth.x - this.x) * Math.min(1, dt * 18);
        this.y += (mouth.y - this.y) * Math.min(1, dt * 18);
      }
      this.scale.set(unit * (1 - k * 0.85), Math.sign(this.scale.y) * unit * (1 - k * 0.85));
      this.alpha = 1 - k * k;
    } else {
      // the roll: the body narrows edge-on and comes back upside down, over a third of a
      // second, as it drifts to a stop and starts to sink
      const roll = Math.min(1, t / 0.35);
      this.scale.y = unit * Math.max(0.12, Math.abs(Math.cos(roll * Math.PI)))
        * (roll < 0.5 ? 1 : -1);
      this.fall.vx *= Math.exp(-3 * dt);
      this.fall.vy = this.fall.vy * Math.exp(-3 * dt) + 24 * dt;
      this.x += this.fall.vx * dt;
      this.y += this.fall.vy * dt;
      this.rotation += (Math.round(this.rotation / Math.PI) * Math.PI - this.rotation) * Math.min(1, dt * 3);
      this.alpha = 1 - Math.max(0, (t - 0.6) / 0.7);
      this.tint = 0x8f96a4;
      if (this.mesh && this.baked) this.skinWith(this.baked.texture);
    }
    // the lights go out first
    this.glow.alpha = Math.max(0, 1 - t * 3);
    this.glow.x = this.fog.x = this.x;
    this.glow.y = this.fog.y = this.y;
    this.fog.alpha = this.alpha;
    return this.fall.whole ? t >= 0.2 : t >= 1.3;
  }

  /** Fasten the feeding tentacles on something in the world, followed live; null lets go. */
  /**
   * One of the feeding arms is gone: torn free by what it held. It stops being drawn, and a
   * rebuild — a new plan, a new genome — grows it back, which only the player's body does.
   */
  tear() {
    const arm = this.arms.find(a => a.feeding && !a.torn);
    if (!arm) return;
    arm.torn = true;
    arm.mesh.visible = false;
  }

  grab(target: { x: number; y: number } | null) {
    this.grip = target;
  }

  /**
   * Lay the strip along the spine for this instant. The sway rides a quintic envelope, whose
   * first and second derivatives vanish at the head — the wave has to arrive at the skull
   * with no slope and no curvature, or there is a crease there that reads as a joint.
   */
  private pose(beat: number, bank: number, thrust: number, dt: number) {
    if (!this.mesh || !this.baked) return;
    const m = this.motion;
    const h = this.baked.halfH;
    // the sway and the bend are measured off the body, not the strip: side-on the strip
    // also holds the dorsal fin, the lure and the barbels, and a wave sized to all of that
    // curls the animal like a banana
    const d = this.baked.depth;
    const n = this.colX.length;
    const amp = d * m.amp * SIDE_ON * (0.45 + thrust * 0.75);
    const spineY: number[] = [];
    // A turn bends the whole body into a C rather than rotating a rigid strip about its
    // middle: head and tail both fall to the inside of the turn, so the nose leads into it
    // and the tail sweeps round behind. It is a parabola about the body's midpoint — smooth
    // everywhere, so it adds no crease at the head the swim wave was built to avoid — and a
    // bell gets none, because a jelly does not steer by flexing.
    const x0 = this.colX[0], x1 = this.colX[n - 1];
    const mid = (x0 + x1) / 2, half = Math.abs(x0 - x1) / 2 || 1;
    // turned round, the strip is mirrored across x, so the same steer curls the other way
    // unless the bend turns with it
    const bend = m.pulse ? 0 : bank * d * 1.25 * this.facing;
    for (let j = 0; j < n; j++) {
      const s = j / (n - 1);
      const env = quintic(s);
      const u = (this.colX[j] - mid) / half;
      spineY.push(Math.sin(s * m.waves * Math.PI * 2 - beat) * amp * env + bend * u * u);
    }
    // the body's origin is at x 0 on the strip, so facing -x is the strip mirrored in place
    const c = this.facing;
    // a bell does not undulate, it contracts: the strip narrows and lengthens on the beat
    const pulse = m.pulse ? 1 + Math.sin(beat) * m.pulse : 1;
    for (let j = 0; j < n; j++) {
      const x = this.colX[j] * c;
      const y = spineY[j];
      const ja = Math.max(0, j - 1), jb = Math.min(n - 1, j + 1);
      // the normal comes from the neighbours, which keeps the width perpendicular to the
      // curve rather than to the axis — the difference between a fish and a bent sprite
      const dx = this.colX[jb] - this.colX[ja], dy = spineY[jb] - spineY[ja];
      const l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l * c, ny = dx / l;
      const hw = h * (m.pulse ? 2 - pulse : 1);
      this.verts[j * 4] = x * pulse + nx * hw;
      this.verts[j * 4 + 1] = y + ny * hw;
      this.verts[j * 4 + 2] = x * pulse - nx * hw;
      this.verts[j * 4 + 3] = y - ny * hw;
    }
    this.mesh.vertices = this.verts;
    if (this.baked.arm) this.poseArms(this.baked.arm, spineY[0], pulse, thrust, dt);
  }

  /**
   * Each arm is walked out from its root as a chain whose heading drifts by a travelling
   * wave, so it curls rather than swings — a rigid arm rotating about its root is a
   * windscreen wiper. The feeding pair is blended from that coil toward a straight line
   * onto `grip`, so a strike is the same arm uncurling rather than a second arm appearing.
   */
  private poseArms(rig: Rig, headY: number, pulse: number, thrust: number, dt: number) {
    const n = this.arms.length;
    const A = PLAN_ART[this.plan];
    this.armT += dt * (1.4 + thrust * 1.6);
    const want = this.grip ? 1 : 0;
    // out fast, back slow: the lash is the event, the recoil is just the arm coming home
    this.strike += (want - this.strike) * Math.min(1, dt * (want ? 16 : 4));
    const e = this.strike;
    let tx = 0, ty = 0;
    if (this.grip) {
      // into the view's own frame: the mesh lives in R units, rotated with the body
      const dx = this.grip.x - this.x, dy = this.grip.y - this.y;
      const c = Math.cos(-this.rotation), s = Math.sin(-this.rotation);
      tx = (dx * c - dy * s) / this.scale.x;
      ty = (dx * s + dy * c) / this.scale.y;
    }
    const pts: number[] = new Array(ARM_COLS * 2);
    for (let i = 0; i < n; i++) {
      const arm = this.arms[i];
      const v = (i / (n - 1)) * 2 - 1;
      const ry = headY + v * rig.spread;
      let rx = rig.rootX * pulse;
      // swimming bundles the crown into a point; holding something flares it open
      let heading = v * 0.5 * (1 - Math.min(1, thrust) * 0.4) * (1 + e * 0.7);
      const len = rig.len * (arm.feeding ? 0.5 : 0.78 / A.armPair) * (1 + e * 0.12);
      const step = len / (ARM_COLS - 1);
      let x = rx, y = ry;
      for (let j = 0; j < ARM_COLS; j++) {
        const s = j / (ARM_COLS - 1);
        pts[j * 2] = x; pts[j * 2 + 1] = y;
        // tips curl in toward the midline, and more so around a catch — the arms wrap it
        heading += Math.sin(this.armT + i * 1.9 - s * 4.5) * 0.2 * (0.3 + s)
                 - v * (0.05 + e * 0.1);
        x += Math.cos(heading) * step;
        y += Math.sin(heading) * step;
      }
      // the coil is walked out on the body before it is mirrored, then mirrored with it; the
      // lash is aimed afterwards, since what it is aimed at is where it is on screen
      for (let j = 0; j < ARM_COLS; j++) pts[j * 2] *= this.facing;
      rx = rig.rootX * this.facing * pulse;
      if (arm.feeding && e > 0.001) {
        const dx = tx - rx, dy = ty - ry;
        const d = Math.hypot(dx, dy) || 1;
        // an arm has a length: past it, it points at the prey rather than reaching it
        const k = Math.min(1, rig.len / d);
        const wig = Math.sin(this.armT * 3 + i) * d * 0.05;
        for (let j = 0; j < ARM_COLS; j++) {
          const s = j / (ARM_COLS - 1);
          const bow = Math.sin(s * Math.PI) * wig;
          const qx = rx + dx * s * k - (dy / d) * bow;
          const qy = ry + dy * s * k + (dx / d) * bow;
          pts[j * 2] = lerp(pts[j * 2], qx, e);
          pts[j * 2 + 1] = lerp(pts[j * 2 + 1], qy, e);
        }
      }
      const h = rig.halfH;
      for (let j = 0; j < ARM_COLS; j++) {
        const ja = Math.max(0, j - 1), jb = Math.min(ARM_COLS - 1, j + 1);
        const dx = pts[jb * 2] - pts[ja * 2], dy = pts[jb * 2 + 1] - pts[ja * 2 + 1];
        const l = Math.hypot(dx, dy) || 1;
        const nx = -dy / l, ny = dx / l;
        arm.verts[j * 4] = pts[j * 2] + nx * h;
        arm.verts[j * 4 + 1] = pts[j * 2 + 1] + ny * h;
        arm.verts[j * 4 + 2] = pts[j * 2] - nx * h;
        arm.verts[j * 4 + 3] = pts[j * 2 + 1] - ny * h;
      }
      arm.mesh.vertices = arm.verts;
    }
  }

  /**
   * How far the body is blown up past its own size — 1 always, except while the Inflation
   * organ holds it swollen. A scale on the whole skinned strip, set from outside each frame,
   * because the swell is a state of the animal and not a different animal to bake.
   */
  swell = 1;

  animate(dt: number, thrust: number, beat: number, bank: number, act: Pose = REST) {
    if (this.version !== artVersion) this.rebuild(this.source);
    this.clock += dt;
    this.flipT = Math.max(0, this.flipT - dt / FLIP_TIME);
    if (this.facing !== this.face) { this.facing = this.face; this.flipT = 1; }
    this.hurtT = Math.max(0, this.hurtT - dt * 3.5);
    // a light organ breathes rather than flickers: a slow drift in strength, each on its own
    for (const l of this.lamps) {
      l.phase += dt * 1.6;
      l.s.alpha = Math.min(0.95, 0.3 + l.e.strength * 0.4) * (0.78 + Math.sin(l.phase) * 0.22);
    }
    let sx = 1;
    let sy = 1 - Math.abs(bank) * 0.16;
    // a flip's recoil: bunched along the body the instant it snaps round, as if the old way
    // on were still arriving, and deeper across it — the squash has to keep its volume or it
    // reads as the art shrinking rather than the animal bunching round
    sx *= 1 - this.flipT * 0.2;
    sy *= 1 + this.flipT * 0.12;
    // Idle: a body with nothing to do hangs in the water and breathes — a slow rise and fall
    // and the nose nodding with it. It fades out as the body puts effort in, or every
    // cruising fish would bob like a cork.
    const rest = 1 - Math.min(1, thrust / 0.35);
    this.bob = Math.sin(this.clock * 1.6) * this.g.size * 0.05 * rest;
    this.sway = Math.sin(this.clock * 1.1 + 0.7) * 0.05 * rest;
    // the wind-up: drawn back and bunched along the body, and the tail curls harder
    const w = act.windup;
    this.recoil = this.g.size * 0.14 * w * w;
    sx *= 1 - w * 0.12;
    sy *= 1 + w * 0.08;
    // the strike: thrown long and narrow, easing back as it spends itself
    const k = act.strike;
    sx *= 1 + k * 0.16;
    sy *= 1 - k * 0.1;
    // a swim stroke: bunched for an instant as the tail snaps, then thrown long while the
    // kick carries it, and settled by the time the glide has bled it off
    const b = act.burst ?? 0;
    if (b > 0) {
      const q = 1 - b;
      const bunch = Math.max(0, 1 - q / 0.3), shoot = Math.sin(q * Math.PI);
      sx *= 1 - bunch * 0.12 + shoot * 0.16;
      sy *= 1 + bunch * 0.1 - shoot * 0.08;
    }
    if (this.chompT > 0) {
      this.chompT = Math.max(0, this.chompT - dt * 5.5);
      // one hump: squash along the body and flare across it, then release
      const s = Math.sin(this.chompT * Math.PI);
      sx *= 1 - s * 0.3;
      sy *= 1 + s * 0.26;
    }
    // a flinch: knocked short and bunched for an instant, keeping its volume
    sx *= 1 - this.hurtT * 0.2;
    sy *= 1 + this.hurtT * 0.12;
    // a thud: flattened against the rock along the axis that met it, sprung long off it and
    // settling, each swing smaller — keeping its volume, or it reads as the art shrinking
    // squeezed into a crack: narrower across and drawn out along, for the moment it takes
    this.nestT = Math.max(0, this.nestT - dt / NESTLE_TIME);
    if (this.nestT > 0) {
      const s = Math.sin((1 - this.nestT) * Math.PI);
      sx *= 1 + s * NESTLE_SQUEEZE * 0.5;
      sy *= 1 - s * NESTLE_SQUEEZE;
    }
    this.bumpT = Math.max(0, this.bumpT - dt / BUMP_TIME);
    this.reel = 0;
    if (this.bumpT > 0) {
      const e = 1 - this.bumpT;
      const ring = this.bumpT * this.bumpT * Math.cos(e * Math.PI * BUMP_SWINGS) * this.bumpK;
      const on = this.bumpAlong, flat = 1 - on;
      sx *= 1 - ring * BUMP_SQUASH * on + ring * BUMP_SQUASH * 0.5 * flat;
      sy *= 1 + ring * BUMP_SQUASH * 0.6 * on - ring * BUMP_SQUASH * flat;
      // turned off the rock and swinging back through it: a head that hit the wall reels
      this.reel = this.bumpTip * BUMP_REEL * this.bumpK * this.bumpT * Math.cos(e * Math.PI * (BUMP_SWINGS - 1));
    }
    this.sx = sx;
    this.sy = sy;
    // the jaw is a second texture on the same strip: open for the strike, and snapped shut
    // for the bite itself, which is what makes the chomp read as a bite
    const gape = act.open && this.chompT < 0.35;
    if (gape !== this.gaping && this.mesh && this.baked) {
      this.gaping = gape;
      this.skinWith(gape ? this.baked.open : this.baked.texture);
    }
    if (this.skin) {
      const u = this.skin.uniforms.uniforms;
      u.uBeat = beat;
      u.uClock = this.clock;
      u.uFlip = this.flipT;
      u.uFlash = this.hurtT > HURT_WHITE ? 0.9 * ((this.hurtT - HURT_WHITE) / (1 - HURT_WHITE)) ** 0.5 : 0;
      this.skin.uniforms.update();
    }
    // the stroke's tail sweeps wider than the cruise's: the snap is what the eye reads as a kick
    this.pose(beat, bank, thrust * (1 + w * 0.9) + b * 0.7, dt);
  }

  private skinWith(texture: Baked['texture']) {
    if (!this.mesh) return;
    this.mesh.texture = texture;
    this.skin?.use(texture);
  }

  get genome() { return this.g; }
}

/** Channel-wise product of two 0xRRGGBB colours — a tint applied on top of a tint. */
function mul(a: number, b: number) {
  const r = ((a >> 16) & 255) * ((b >> 16) & 255) / 255;
  const g = ((a >> 8) & 255) * ((b >> 8) & 255) / 255;
  const bl = (a & 255) * (b & 255) / 255;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

function lerpColor(a: number, b: number, t: number) {
  const ch = (s: number) => Math.round(lerp((a >> s) & 255, (b >> s) & 255, t));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
