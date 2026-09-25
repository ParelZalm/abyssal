/**
 * A creature seen from directly above: one continuous surface that swims.
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
import { PLAN_ART, quintic, R, type Plan } from './form';
import { menace, type Genome } from './genome';
import { glowTexture } from './textures';
import { hsl, lerp } from './util';

export type { Plan } from './form';

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
  // more columns than its length asks for: a veil shows every kink a coarse strip has
  wraith:    { cols: 34, waves: 1.15, amp: 0.55, pulse: 0 },
};

/** Columns per rigged arm. An arm is thin, so it needs length resolution and nothing else. */
const ARM_COLS = 12;

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
  /** A tight, hot centre inside the halo — the halo alone reads as fog, not as a light. */
  private core = new Sprite(glowTexture());
  private mesh: MeshSimple | null = null;
  private verts = new Float32Array(0);
  private colX: number[] = [];
  private baked: Baked | null = null;
  private motion = MOTION.darter;
  /** Counts down from 1 through a bite, driving the squash-and-snap. */
  private chompT = 0;
  /** Rigged arms, one strip each, under the body. Empty for anything without `grasp`. */
  private arms: { mesh: MeshSimple; verts: Float32Array; feeding: boolean }[] = [];
  /** The arms' own clock: `beat` jumps on a boost, and a jump reads as a twitch in an arm. */
  private armT = Math.random() * 10;
  /** How far the feeding pair is out toward `grip`, 0 coiled to 1 fastened. */
  private strike = 0;
  /** What the feeding pair is holding, read for its live world position; null when nothing. */
  private grip: { x: number; y: number } | null = null;

  constructor(private g: Genome, private plan: Plan = 'darter') {
    super();
    for (const s of [this.aura, this.halo, this.core]) {
      s.anchor.set(0.5);
      s.blendMode = 'add';
    }
    this.glow.addChild(this.aura, this.halo, this.core);
    this.murk.anchor.set(0.5);
    this.fog.addChild(this.murk);
    this.rebuild(g);
  }

  /** Body and bloom are in different layers, so they are moved together from here. */
  place(x: number, y: number, rotation: number) {
    this.x = x; this.y = y; this.rotation = rotation;
    this.glow.x = x; this.glow.y = y;
    this.fog.x = x; this.fog.y = y;
  }

  /**
   * Culling, fog and the danger tint are decided per creature by `main`, and the bloom
   * has to take all three: it is the same animal, lit from inside.
   */
  show(visible: boolean, alpha: number, tint: number) {
    this.visible = this.glow.visible = visible;
    this.alpha = this.glow.alpha = alpha;
    this.tint = this.glow.tint = tint;
    // the fog takes culling and distance, but not the danger tint: it is absence of light,
    // so tinting it would only make it glow in whatever colour the tint happens to be
    this.fog.visible = visible;
    this.fog.alpha = alpha;
  }

  /** The bloom is not a child, so it does not go down with the rest of the view. */
  destroy(options?: Parameters<Container['destroy']>[0]) {
    if (this.baked) { releaseFish(this.baked); this.baked = null; }
    if (!this.glow.destroyed) this.glow.destroy({ children: true });
    if (!this.fog.destroyed) this.fog.destroy({ children: true });
    super.destroy(options);
  }

  rebuild(g: Genome) {
    this.g = g;
    const m = this.motion = motionFor(g, this.plan);
    const men = menace(g);

    this.mesh?.destroy();
    for (const a of this.arms) a.mesh.destroy();
    this.arms = [];
    // take the new texture before letting go of the old one, so a rebuild onto the same
    // genome never leaves the entry at zero users for an eviction to catch
    const old = this.baked;
    this.baked = bakeFish(g, this.plan);
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
      if (j < cols - 1) {
        const a = j * 2;
        idx.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], j * 6);
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
    this.mesh = new MeshSimple({ texture: this.baked.texture, vertices: verts, uvs,
                                 indices: idx });
    this.addChild(this.mesh);

    // emission and dread stay sprites: they are light, not body.
    // Every animal carries a floor of it, glowing organs or not — against water this dark
    // an unlit body is a hole in the frame, and the bloom is what gives it a silhouette
    // without stroking one.
    const tint = hsl(lerp(g.accentHue, g.accentHue > 180 ? 22 : 8, men * 0.75),
                     0.6 + men * 0.3, 0.55);
    this.halo.visible = true;
    const gr = R * (4 + g.glow * 7);
    this.halo.width = this.halo.height = gr * 2;
    this.halo.tint = tint;
    this.halo.alpha = Math.min(0.95, 0.26 + g.glow * 0.65);
    // the core sits inside the body's own width, so it lifts the animal's value rather
    // than spilling a second disc of light around it
    // and only a real light organ gets one: on an unlit animal it lands as a hot white
    // spot in the middle of the body, which reads as a bug rather than as bioluminescence
    this.core.visible = g.glow > 0.05;
    const cr = R * (1.5 + g.glow * 1.6);
    this.core.width = this.core.height = cr * 2;
    this.core.tint = hsl(lerp(g.accentHue, g.accentHue > 180 ? 22 : 8, men * 0.75),
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

    this.pose(0, 0, 0.5, 0);
    this.scale.set(g.size / R);
  }

  chomp() {
    this.chompT = 1;
  }

  /** Fasten the feeding tentacles on something in the world, followed live; null lets go. */
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
    const n = this.colX.length;
    const amp = h * m.amp * (0.45 + thrust * 0.75);
    const spineY: number[] = [];
    // A turn bends the whole body into a C rather than rotating a rigid strip about its
    // middle: head and tail both fall to the inside of the turn, so the nose leads into it
    // and the tail sweeps round behind. It is a parabola about the body's midpoint — smooth
    // everywhere, so it adds no crease at the head the swim wave was built to avoid — and a
    // bell gets none, because a jelly does not steer by flexing.
    const x0 = this.colX[0], x1 = this.colX[n - 1];
    const mid = (x0 + x1) / 2, half = Math.abs(x0 - x1) / 2 || 1;
    const bend = m.pulse ? 0 : bank * h * 1.25;
    for (let j = 0; j < n; j++) {
      const s = j / (n - 1);
      const env = quintic(s);
      const u = (this.colX[j] - mid) / half;
      spineY.push(Math.sin(s * m.waves * Math.PI * 2 - beat) * amp * env + bend * u * u);
    }
    // a bell does not undulate, it contracts: the strip narrows and lengthens on the beat
    const pulse = m.pulse ? 1 + Math.sin(beat) * m.pulse : 1;
    for (let j = 0; j < n; j++) {
      const x = this.colX[j];
      const y = spineY[j];
      const ja = Math.max(0, j - 1), jb = Math.min(n - 1, j + 1);
      // the normal comes from the neighbours, which keeps the width perpendicular to the
      // curve rather than to the axis — the difference between a fish and a bent sprite
      const dx = this.colX[jb] - this.colX[ja], dy = spineY[jb] - spineY[ja];
      const l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l, ny = dx / l;
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
      const rx = rig.rootX * pulse, ry = headY + v * rig.spread;
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

  animate(dt: number, thrust: number, beat: number, bank: number) {
    const unit = this.g.size / R;
    let sx = 1;
    let sy = 1 - Math.abs(bank) * 0.16;
    if (this.chompT > 0) {
      this.chompT = Math.max(0, this.chompT - dt * 5.5);
      // one hump: squash along the body and flare across it, then release
      const s = Math.sin(this.chompT * Math.PI);
      sx *= 1 - s * 0.3;
      sy *= 1 + s * 0.26;
    }
    this.scale.x = unit * sx;
    this.scale.y = unit * sy;
    this.pose(beat, bank, thrust, dt);
  }

  get genome() { return this.g; }
}
