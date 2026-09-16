import { Container, Graphics, Sprite } from 'pixi.js';
import { menace, type Genome } from './genome';
import { glowTexture } from './textures';
import { hsl, lerp, TAU } from './util';

/** Reference half-length the body is drawn at; the container is scaled to real size. */
const R = 10;

/** Silhouettes, seen from directly above. A species picks one. */
export type Plan =
  | 'microbe' | 'darter' | 'shark' | 'eel' | 'jelly' | 'squid' | 'angler' | 'leviathan';

interface Motion {
  /** Links in the tail chain; 0 for things that do not swim with a tail. */
  links: number;
  /** Peak sway of the last link, radians. */
  amp: number;
  /** Phase lag between links — this is what makes the sway read as a travelling wave. */
  lag: number;
  /** Bell/mantle contraction, for jellies and squid. */
  pulse: number;
  finFlap: number;
}

const MOTION: Record<Plan, Motion> = {
  microbe:   { links: 2, amp: 0.55, lag: 1.3,  pulse: 0.14, finFlap: 0.1 },
  darter:    { links: 2, amp: 0.42, lag: 0.95, pulse: 0,    finFlap: 0.4 },
  shark:     { links: 2, amp: 0.26, lag: 0.7,  pulse: 0,    finFlap: 0.16 },
  eel:       { links: 5, amp: 0.46, lag: 0.85, pulse: 0,    finFlap: 0.1 },
  jelly:     { links: 3, amp: 0.5,  lag: 1.5,  pulse: 0.3,  finFlap: 0 },
  squid:     { links: 3, amp: 0.4,  lag: 1.2,  pulse: 0.22, finFlap: 0.25 },
  angler:    { links: 2, amp: 0.34, lag: 0.9,  pulse: 0,    finFlap: 0.3 },
  leviathan: { links: 4, amp: 0.3,  lag: 0.75, pulse: 0,    finFlap: 0.2 },
};

/**
 * A creature seen from directly above. The body is drawn once per mutation and animated
 * purely by transform: a chain of tail links with a phase lag, flapping lobes, and a
 * bell pulse for the things that swim by contracting.
 */
export class FishView extends Container {
  private halo = new Sprite(glowTexture());
  /** A bruised red bloom that grows as the animal becomes something to run from. */
  private aura = new Sprite(glowTexture());
  private membrane = new Graphics();
  private chain: Graphics[] = [];
  private finL = new Graphics();
  private finR = new Graphics();
  private body = new Graphics();
  private motion = MOTION.darter;
  private menace = 0;
  /** The lit edge colour for this genome — what a light on the animal would catch. */
  private rim = 0xffffff;
  /** Counts down from 1 through a bite, driving the squash-and-snap. */
  private chompT = 0;

  constructor(private g: Genome, private plan: Plan = 'darter') {
    super();
    this.halo.anchor.set(0.5);
    this.halo.blendMode = 'add';
    this.aura.anchor.set(0.5);
    this.aura.blendMode = 'add';
    this.addChild(this.aura, this.halo, this.membrane, this.finL, this.finR, this.body);
    this.rebuild(g);
  }

  private resetChain(n: number) {
    for (const link of this.chain) link.destroy();
    this.chain = [];
    let parent: Container = this;
    for (let i = 0; i < n; i++) {
      const link = new Graphics();
      parent.addChild(link);
      this.chain.push(link);
      parent = link;
    }
    // the chain sits behind the head
    if (this.chain.length) this.setChildIndex(this.chain[0], 2);
  }

  rebuild(g: Genome) {
    this.g = g;
    const m = this.motion = MOTION[this.plan];
    const men = this.menace = menace(g);
    // the more dangerous it is, the darker the mass and the hotter the edge
    const skin = hsl(g.hue, 0.34 + men * 0.1, 0.42 - men * 0.17);
    const inner = hsl(g.hue + 14, 0.34, 0.56 - men * 0.16);
    const accent = hsl(lerp(g.accentHue, g.accentHue > 180 ? 22 : 8, men * 0.75),
                       0.55 + men * 0.3, 0.55);
    const dark = hsl(g.hue, 0.5, 0.1);
    this.rim = hsl(g.accentHue + 6, 0.72, 0.7 - men * 0.06);
    const alpha = 0.94 - Math.min(0.6, g.translucent * 0.62);

    this.resetChain(m.links);
    this.body.clear();
    this.membrane.clear();
    this.finL.clear();
    this.finR.clear();

    switch (this.plan) {
      case 'microbe': this.drawMicrobe(skin, accent, alpha); break;
      case 'jelly': this.drawJelly(skin, accent, alpha); break;
      case 'squid': this.drawSquid(skin, inner, accent, dark, alpha); break;
      case 'eel': this.drawEel(skin, inner, accent, dark, alpha); break;
      case 'shark': this.drawShark(skin, inner, accent, dark, alpha); break;
      case 'angler': this.drawAngler(skin, inner, accent, dark, alpha); break;
      case 'leviathan': this.drawLeviathan(skin, inner, accent, dark, alpha); break;
      default: this.drawDarter(skin, inner, accent, dark, alpha); break;
    }

    this.drawOrgans(g, accent, dark, alpha);
    this.drawMenace(dark, alpha, g.spikes);
    this.drawGlow(accent, g);
    this.scale.set(g.size / R);
  }

  // ---------------------------------------------------------------- helpers

  /** A tapering chain segment plus, on the last link, a caudal fin. */
  private buildChain(len: number, w0: number, w1: number, color: number, alpha: number,
                     fin: { len: number; spread: number; color: number } | null) {
    const n = this.chain.length;
    for (let i = 0; i < n; i++) {
      const link = this.chain[i];
      const a = w0 + (w1 - w0) * (i / n);
      const b = w0 + (w1 - w0) * ((i + 1) / n);
      // each link reaches back past its own joint so the seams never open up
      const over = len * 0.42;
      link.moveTo(over, -a * 0.86)
        .quadraticCurveTo(over * 0.4, -a, -len * 0.4, -(a + b) * 0.5)
        .lineTo(-len, -b)
        .lineTo(-len, b)
        .quadraticCurveTo(-len * 0.4, (a + b) * 0.5, over * 0.4, a)
        .lineTo(over, a * 0.86)
        .closePath().fill({ color, alpha });
      // Outline the two long edges only. Stroking the closed path instead draws the
      // joint caps as well, and those land as straight lines across the body — the
      // links are meant to read as one animal, not as a stack of plates.
      for (const dir of [-1, 1] as const) {
        link.moveTo(over, dir * a * 0.86)
          .quadraticCurveTo(over * 0.4, dir * a, -len * 0.4, dir * (a + b) * 0.5)
          .lineTo(-len, dir * b)
          .stroke({ color: 0x04080d, width: R * 0.075, alpha: alpha * 0.55 });
      }
      // a lit crescent down one flank of each link: the only cue a flat top-down
      // shape has for being round
      link.moveTo(over * 0.2, -a * 0.9)
        .quadraticCurveTo(-len * 0.35, -(a + b) * 0.52, -len * 0.9, -b * 0.88)
        .stroke({ color: this.rim, width: R * 0.05, alpha: alpha * 0.4 });
      if (i > 0) link.x = -len;
      if (i === n - 1 && fin) {
        link.moveTo(-len, -b)
          .quadraticCurveTo(-len - fin.len * 0.5, -fin.spread * 0.85, -len - fin.len, -fin.spread)
          .quadraticCurveTo(-len - fin.len * 0.42, 0, -len - fin.len, fin.spread)
          .quadraticCurveTo(-len - fin.len * 0.5, fin.spread * 0.85, -len, b)
          .closePath().fill({ color: fin.color, alpha: alpha * 0.66 })
          // the caudal fin is a membrane: thin, translucent, and lit along its edge
          .stroke({ color: this.rim, width: R * 0.045, alpha: alpha * 0.5 });
      }
    }
  }

  /**
   * The edge every body gets: a heavy near-black outline with a thin lit rim inside it,
   * as two strokes on the same path. The outline is what separates an animal from water
   * it is nearly the same colour as; the rim is what stops the silhouette reading as a
   * hole. Between them they do more for legibility than any amount of interior detail.
   */
  private shell(b: Graphics, accent: number, alpha: number, w = 1) {
    b.stroke({ color: 0x04080d, width: R * 0.13 * w, alpha: alpha * 0.8 })
      .stroke({ color: accent, width: R * 0.05 * w, alpha: 0.45 + this.menace * 0.35 });
  }

  /** Where a grown part meets the body: a dark seat with a lit ring around it. */
  private socket(b: Graphics, x: number, y: number, r: number, alpha: number) {
    b.circle(x, y, r).fill({ color: 0x05090e, alpha: alpha * 0.85 })
      .stroke({ color: this.rim, width: r * 0.4, alpha: alpha * 0.55 });
  }

  private paired(draw: (g: Graphics, dir: -1 | 1) => void, x: number, y: number) {
    for (const [fin, dir] of [[this.finL, -1], [this.finR, 1]] as const) {
      draw(fin, dir);
      fin.x = x;
      fin.y = dir * y;
    }
  }

  /**
   * Not eyes so much as sensory marks: a dark socket with a lit arc across it. Reads as a
   * gaze without drawing a face, and the arc runs hot as the animal gets more dangerous.
   */
  private eyes(b: Graphics, x: number, y: number, r: number, alpha: number, pale: boolean) {
    const gaze = hsl(lerp(pale ? 190 : 176, 12, this.menace), 0.85, 0.62);
    for (const dir of [-1, 1]) {
      b.circle(x, dir * y, r * 1.5).fill({ color: 0x03070c, alpha: alpha * 0.5 });
      b.moveTo(x - r, dir * y - r * 0.5)
        .quadraticCurveTo(x + r * 0.55, dir * y, x - r, dir * y + r * 0.5)
        .stroke({ color: gaze, width: r * 0.62, alpha: 0.55 + this.menace * 0.4 });
    }
  }

  /** A dark aperture with an ember rim, and blades rather than round little teeth. */
  private mouth(b: Graphics, nose: number, w: number, color: number, alpha: number, teeth: number) {
    b.moveTo(nose, 0)
      .quadraticCurveTo(nose - w * 0.5, -w * 0.68, nose - w, 0)
      .quadraticCurveTo(nose - w * 0.5, w * 0.68, nose, 0)
      .fill({ color, alpha })
      .stroke({ color: hsl(lerp(30, 8, this.menace), 0.8, 0.5), width: w * 0.1,
                alpha: 0.25 + this.menace * 0.45 });
    for (let i = 0; i < teeth; i++) {
      const t = teeth === 1 ? 0.5 : i / (teeth - 1);
      const a = (-1 + t * 2) * 1.0;
      const bx = nose - w * 0.5 + Math.cos(a) * w * 0.34;
      const by = Math.sin(a) * w * 0.52;
      b.moveTo(bx - w * 0.1, by * 0.72).lineTo(bx + w * 0.34, by)
        .lineTo(bx - w * 0.04, by * 1.05)
        .closePath().fill({ color: 0xf6f8ef, alpha: alpha * 0.8 });
    }
  }

  /** Roughly where each plan's nose sits, as a fraction of R. */
  private static readonly NOSE: Record<Plan, number> = {
    microbe: 0.85, darter: 1.15, shark: 1.32, eel: 1.0,
    jelly: 0.95, squid: 0.95, angler: 0.95, leviathan: 1.35,
  };

  /** Roughly where each plan's flank sits, as a fraction of R. */
  private static readonly FLANK: Record<Plan, number> = {
    microbe: 0.66, darter: 0.78, shark: 0.6, eel: 0.42,
    jelly: 0.9, squid: 0.62, angler: 0.86, leviathan: 0.84,
  };

  /**
   * The single flank-blade pass. Menace and the spines trait feed the same row, so
   * stacking both thickens one ridge instead of drawing two overlapping sawblades.
   */
  private drawMenace(dark: number, alpha: number, spikes: number) {
    const men = this.menace;
    this.aura.visible = men > 0.25;
    if (this.aura.visible) {
      const ar = R * (3 + men * 3.4);
      this.aura.width = this.aura.height = ar * 2;
      this.aura.tint = hsl(lerp(24, 2, men), 0.85, 0.4);
      this.aura.alpha = (men - 0.25) * 0.3;
    }
    const bladed: Plan[] = ['darter', 'shark', 'eel', 'angler', 'leviathan', 'squid'];
    if (!bladed.includes(this.plan)) return;
    const n = Math.min(7, Math.round(men * 4 + spikes * 1.4));
    if (n < 1) return;
    const hw = R * FishView.FLANK[this.plan];
    const b = this.body;
    for (let i = 0; i < n; i++) {
      const x = R * 0.45 - i * R * 0.3;
      const len = R * (0.12 + men * 0.26) * (1 - i * 0.07);
      for (const dir of [-1, 1]) {
        const y = dir * hw;
        b.moveTo(x - R * 0.1, y).lineTo(x - len * 0.25, y + dir * len)
          .lineTo(x + R * 0.1, y)
          .closePath().fill({ color: dark, alpha })
          .stroke({ color: this.rim, width: R * 0.035, alpha: alpha * 0.45 });
      }
    }
  }

  /**
   * Organs grown by mutation. These are the parts that make a build legible at a glance:
   * a lure out front, claws on the shoulders, a jet at the tail, coral on the back.
   */
  private drawOrgans(g: Genome, accent: number, dark: number, alpha: number) {
    const b = this.body;
    const hw = R * FishView.FLANK[this.plan];
    const nose = R * FishView.NOSE[this.plan];
    const toxic = hsl(78, 0.8, 0.5);
    const reef = hsl(348, 0.38, 0.5);

    // --- coral encrustation: irregular plates crusting the back ---
    for (let i = 0; i < g.coral; i++) {
      for (let k = 0; k < 5; k++) {
        const x = R * (0.42 - k * 0.26) - i * R * 0.08;
        const y = ((k % 2) ? 1 : -1) * hw * (0.24 + (k % 3) * 0.14);
        const r = R * (0.1 + ((k * 7 + i * 3) % 4) * 0.028);
        b.circle(x, y, r).fill({ color: reef, alpha: alpha * 0.6 })
          .stroke({ color: 0x04080d, width: R * 0.035, alpha: alpha * 0.5 });
        b.circle(x - r * 0.25, y - r * 0.25, r * 0.38)
          .fill({ color: 0xffffff, alpha: alpha * 0.18 });
      }
    }

    // --- anemone frill: a fringe of stinging tentacles around the rear ---
    if (g.frill > 0) {
      // a fringe along the rear margin only, not a skirt around the whole animal
      const n = Math.round(7 + g.frill * 3);
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const a = Math.PI * (0.62 + t * 0.76);
        const fx = Math.cos(a) * R * 0.72, fy = Math.sin(a) * hw * 0.92;
        const len = R * (0.16 + g.frill * 0.07);
        b.moveTo(fx, fy)
          .quadraticCurveTo(fx - len * 0.7, fy + len * 0.3, fx - len * 1.1, fy + len * 0.15)
          .stroke({ color: accent, width: R * 0.05, alpha: alpha * 0.7 });
        b.circle(fx - len * 1.1, fy + len * 0.15, R * 0.035)
          .fill({ color: toxic, alpha: alpha * 0.85 });
      }
    }

    // --- venom barbs: recurved spines with a wet tip ---
    for (let i = 0; i < Math.min(3, Math.ceil(g.venom)); i++) {
      const x = R * (0.26 - i * 0.26);
      const len = R * (0.16 + g.venom * 0.045);
      for (const dir of [-1, 1]) {
        const y = dir * hw * 0.95;
        b.moveTo(x - R * 0.09, y)
          .quadraticCurveTo(x + len * 0.3, y + dir * len * 0.6, x + len * 0.15, y + dir * len)
          .lineTo(x + R * 0.09, y)
          .closePath().fill({ color: dark, alpha });
        this.socket(b, x, y, R * 0.085, alpha);
        b.circle(x + len * 0.15, y + dir * len, R * 0.05)
          .fill({ color: toxic, alpha: 0.95 });
      }
    }

    // --- pincer claws on short arms, held forward ---
    for (let i = 0; i < Math.min(2, g.claws); i++) {
      const scale = 0.72 + i * 0.18 + (g.claws - 1) * 0.1;
      for (const dir of [-1, 1]) {
        const ax = nose * 0.3, ay = dir * hw * 0.8;
        const cx = nose * (0.7 + i * 0.1), cy = dir * hw * (0.95 + i * 0.16);
        b.moveTo(ax, ay).lineTo(cx, cy)
          .stroke({ color: dark, width: R * 0.16 * scale, alpha })
          // a highlight along the top of the arm, the way a lit tube reads
          .stroke({ color: this.rim, width: R * 0.05 * scale, alpha: alpha * 0.45 });
        this.socket(b, ax, ay, R * 0.13 * scale, alpha);
        const cl = R * 0.36 * scale;
        // two opposed fingers
        b.moveTo(cx, cy)
          .quadraticCurveTo(cx + cl * 0.9, cy - dir * cl * 0.15, cx + cl * 1.5, cy + dir * cl * 0.2)
          .quadraticCurveTo(cx + cl * 0.8, cy + dir * cl * 0.25, cx, cy + dir * cl * 0.35)
          .closePath().fill({ color: dark, alpha });
        b.moveTo(cx, cy + dir * cl * 0.45)
          .quadraticCurveTo(cx + cl * 0.8, cy + dir * cl * 0.85, cx + cl * 1.4, cy + dir * cl * 0.5)
          .quadraticCurveTo(cx + cl * 0.7, cy + dir * cl * 0.45, cx, cy + dir * cl * 0.2)
          .closePath().fill({ color: dark, alpha: alpha * 0.9 });
        b.circle(cx, cy, R * 0.12 * scale).fill({ color: accent, alpha: alpha * 0.6 });
        // the business end catches the most light — it is the part that matters
        b.circle(cx + cl * 1.45, cy + dir * cl * 0.22, R * 0.055 * scale)
          .fill({ color: this.rim, alpha: alpha * 0.9 });
      }
    }

    // --- siphon jet at the tail root ---
    for (let i = 0; i < Math.min(2, g.jet); i++) {
      const y = i === 0 ? 0 : 0;
      const x = -R * (0.75 + i * 0.18);
      const w = hw * (0.42 - i * 0.1);
      b.moveTo(x + R * 0.2, -w).lineTo(x - R * 0.28, -w * 0.62)
        .lineTo(x - R * 0.28, w * 0.62).lineTo(x + R * 0.2, w)
        .closePath().fill({ color: dark, alpha });
      b.moveTo(x + R * 0.2, -w).lineTo(x - R * 0.28, -w * 0.62)
        .stroke({ color: this.rim, width: R * 0.045, alpha: alpha * 0.5 });
      b.moveTo(x - R * 0.28, -w * 0.62).lineTo(x - R * 0.28, w * 0.62)
        .stroke({ color: accent, width: R * 0.1, alpha: alpha * 0.9 });
      void y;
    }

    // --- illicium: a stalk out front with a lit bait on the end ---
    if (g.lure > 0) {
      const reach = nose * (1.3 + g.lure * 0.35);
      const lift = -hw * (0.85 + g.lure * 0.12);
      b.moveTo(-R * 0.1, -hw * 0.3)
        .quadraticCurveTo(nose * 0.7, lift * 1.5, reach, lift)
        .stroke({ color: dark, width: R * 0.09, alpha });
      this.socket(b, -R * 0.1, -hw * 0.3, R * 0.1, alpha);
      const br = R * (0.17 + g.lure * 0.06);
      b.circle(reach, lift, br * 2.4).fill({ color: accent, alpha: 0.18 });
      b.circle(reach, lift, br * 1.5).fill({ color: accent, alpha: 0.3 });
      b.circle(reach, lift, br).fill({ color: accent, alpha: 0.95 });
      b.circle(reach - br * 0.3, lift - br * 0.3, br * 0.4)
        .fill({ color: 0xffffff, alpha: 0.9 });
    }
  }

  private drawGlow(accent: number, g: Genome) {
    this.halo.visible = g.glow > 0.01;
    if (g.glow <= 0.01) return;
    const gr = R * (5 + g.glow * 6);
    this.halo.width = this.halo.height = gr * 2;
    this.halo.tint = accent;
    this.halo.alpha = Math.min(0.85, 0.28 + g.glow * 0.55);
  }

  // ------------------------------------------------------------ body plans

  /** Drifting cell: a lopsided blob ringed with cilia. */
  private drawMicrobe(skin: number, accent: number, alpha: number) {
    const m = this.membrane;
    m.ellipse(0, 0, R * 1.15, R * 0.95).fill({ color: accent, alpha: 0.2 });
    const cilia = 14;
    for (let i = 0; i < cilia; i++) {
      const a = (i / cilia) * TAU;
      const x = Math.cos(a) * R * 1.1, y = Math.sin(a) * R * 0.92;
      m.moveTo(x, y).lineTo(x * 1.16, y * 1.16)
        .stroke({ color: 0xffffff, width: R * 0.05, alpha: 0.18 });
    }
    const b = this.body;
    b.ellipse(0, 0, R * 0.85, R * 0.68).fill({ color: skin, alpha })
      ;
    this.shell(b, accent, alpha);
    b.ellipse(-R * 0.12, R * 0.08, R * 0.3, R * 0.24).fill({ color: accent, alpha: alpha * 0.9 });
    this.buildChain(R * 0.34, R * 0.16, R * 0.05, skin, alpha * 0.8, null);
    if (this.chain.length) this.chain[0].x = -R * 0.8;
  }

  /** Radial bell with trailing tentacles — no forward face at all. */
  private drawJelly(skin: number, accent: number, alpha: number) {
    const m = this.membrane;
    m.circle(0, 0, R * 1.25).fill({ color: accent, alpha: 0.16 });
    m.circle(0, 0, R * 1.25).stroke({ color: 0xffffff, width: R * 0.07, alpha: 0.26 });
    const b = this.body;
    b.circle(0, 0, R * 0.95).fill({ color: skin, alpha: alpha * 0.55 })
      ;
    this.shell(b, accent, alpha, 0.55);
    b.circle(0, 0, R * 0.62).fill({ color: accent, alpha: alpha * 0.4 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      b.moveTo(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2)
        .quadraticCurveTo(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5,
                          Math.cos(a) * R * 0.82, Math.sin(a) * R * 0.82)
        .stroke({ color: 0xffffff, width: R * 0.1, alpha: alpha * 0.45 });
    }
    // tentacles stream behind the bell
    this.buildChain(R * 0.55, R * 0.5, R * 0.08, accent, alpha * 0.35, null);
    for (const link of this.chain) {
      link.stroke({ color: 0xffffff, width: R * 0.04, alpha: 0.18 });
    }
    if (this.chain.length) this.chain[0].x = -R * 0.5;
  }

  /** Pointed mantle, rear fins, a splay of arms at the front. */
  private drawSquid(skin: number, inner: number, accent: number, dark: number, alpha: number) {
    const b = this.body;
    const L = R * 1.5;
    b.moveTo(-L, 0)
      .quadraticCurveTo(-L * 0.3, -R * 0.72, R * 0.5, -R * 0.42)
      .quadraticCurveTo(R * 0.95, 0, R * 0.5, R * 0.42)
      .quadraticCurveTo(-L * 0.3, R * 0.72, -L, 0)
      .fill({ color: skin, alpha })
      ;
    this.shell(b, accent, alpha);
    b.ellipse(-R * 0.2, 0, R * 0.55, R * 0.3).fill({ color: inner, alpha: alpha * 0.5 });
    // mantle fins
    for (const dir of [-1, 1]) {
      b.moveTo(-L * 0.62, dir * R * 0.5)
        .quadraticCurveTo(-L * 0.95, dir * R * 1.15, -L * 1.12, dir * R * 0.3)
        .quadraticCurveTo(-L * 0.9, dir * R * 0.25, -L * 0.62, dir * R * 0.5)
        .fill({ color: accent, alpha: alpha * 0.55 })
        .stroke({ color: this.rim, width: R * 0.045, alpha: alpha * 0.5 });
    }
    this.eyes(b, R * 0.3, R * 0.4, R * 0.13, alpha, false);
    // arms
    this.paired((f, dir) => {
      for (let i = 0; i < 4; i++) {
        const spread = (i / 3) * dir * R * 0.5;
        f.moveTo(0, 0).quadraticCurveTo(R * 0.5, spread * 0.5, R * 0.95, spread)
          .stroke({ color: accent, width: R * 0.11, alpha: alpha * 0.75 });
        f.circle(R * 0.95, spread, R * 0.06)
          .fill({ color: this.rim, alpha: alpha * 0.8 });
      }
    }, R * 0.55, R * 0.12);
    this.buildChain(R * 0.3, R * 0.12, R * 0.05, dark, alpha * 0.3, null);
    if (this.chain.length) this.chain[0].x = -L;
  }

  /** Long ribbon that swims with its whole body. */
  private drawEel(skin: number, inner: number, accent: number, dark: number, alpha: number) {
    const b = this.body;
    const hw = R * 0.42;
    b.moveTo(R * 1.0, 0)
      .quadraticCurveTo(R * 0.6, -hw * 1.35, -R * 0.1, -hw)
      .lineTo(-R * 0.1, hw)
      .quadraticCurveTo(R * 0.6, hw * 1.35, R * 1.0, 0)
      .fill({ color: skin, alpha })
      ;
    this.shell(b, accent, alpha);
    b.ellipse(R * 0.25, 0, R * 0.3, hw * 0.55).fill({ color: inner, alpha: alpha * 0.5 });
    this.mouth(b, R * 1.0, R * (0.45 + Math.min(this.g.jaw, 1.1) * 0.5), dark, alpha, 5);
    this.eyes(b, R * 0.55, hw * 0.62, R * 0.11, alpha, false);
    this.buildChain(R * 0.62, hw, R * 0.07, skin, alpha,
      { len: R * 0.5, spread: R * 0.22, color: accent });
    for (const link of this.chain) {
      link.stroke({ color: dark, width: R * 0.05, alpha: alpha * 0.35 });
    }
    if (this.chain.length) this.chain[0].x = -R * 0.1;
  }

  /** Stiff torpedo, swept pectorals, crescent tail. Reads as a threat. */
  private drawShark(skin: number, inner: number, accent: number, dark: number, alpha: number) {
    const b = this.body;
    const nose = R * 1.32, W = R * 0.62;
    b.moveTo(nose, 0)
      .bezierCurveTo(nose * 0.7, -W * 0.85, R * 0.1, -W, -R * 0.55, -W * 0.52)
      .lineTo(-R * 0.55, W * 0.52)
      .bezierCurveTo(R * 0.1, W, nose * 0.7, W * 0.85, nose, 0)
      .fill({ color: skin, alpha })
      ;
    this.shell(b, accent, alpha);
    b.moveTo(nose * 0.95, W * 0.12)
      .bezierCurveTo(R * 0.5, W * 0.8, -R * 0.1, W * 0.85, -R * 0.52, W * 0.45)
      .lineTo(-R * 0.52, W * 0.1)
      .bezierCurveTo(R * 0.1, W * 0.4, R * 0.7, W * 0.42, nose * 0.95, W * 0.12)
      .fill({ color: inner, alpha: alpha * 0.4 });
    this.mouth(b, nose - R * 0.1, R * (0.5 + Math.min(this.g.jaw, 1.1) * 0.45), dark, alpha, 6);
    this.eyes(b, nose - R * 0.52, W * 0.72, R * 0.1, alpha, false);
    this.paired((f, dir) => {
      f.moveTo(0, 0)
        .quadraticCurveTo(-R * 0.1, dir * R * 0.95, -R * 1.05, dir * R * 1.0)
        .quadraticCurveTo(-R * 0.55, dir * R * 0.2, 0, 0)
        .fill({ color: accent, alpha: alpha * 0.62 })
        .stroke({ color: this.rim, width: R * 0.045, alpha: alpha * 0.55 });
    }, R * 0.3, W * 0.85);
    this.buildChain(R * 0.55, W * 0.52, R * 0.12, skin, alpha,
      { len: R * 0.62, spread: R * 0.72, color: accent });
    if (this.chain.length) this.chain[0].x = -R * 0.55;
  }

  /** Enormous gape, a lure held out in front of it. */
  private drawAngler(skin: number, inner: number, accent: number, dark: number, alpha: number) {
    const b = this.body;
    const nose = R * 0.95, W = R * 0.92;
    b.moveTo(nose, 0)
      .bezierCurveTo(nose * 0.85, -W * 1.05, -R * 0.1, -W * 1.0, -R * 0.6, -W * 0.4)
      .lineTo(-R * 0.6, W * 0.4)
      .bezierCurveTo(-R * 0.1, W * 1.0, nose * 0.85, W * 1.05, nose, 0)
      .fill({ color: skin, alpha })
      ;
    this.shell(b, accent, alpha);
    b.ellipse(-R * 0.1, 0, R * 0.45, W * 0.45).fill({ color: inner, alpha: alpha * 0.4 });
    // gape: a wide arc of teeth across the whole front
    b.moveTo(nose, 0)
      .quadraticCurveTo(nose * 0.2, -W * 0.95, -R * 0.15, -W * 0.5)
      .lineTo(-R * 0.15, W * 0.5)
      .quadraticCurveTo(nose * 0.2, W * 0.95, nose, 0)
      .fill({ color: dark, alpha });
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const a = (-1 + t * 2) * 1.15;
      b.moveTo(nose * 0.35 + Math.cos(a) * R * 0.5, Math.sin(a) * W * 0.78)
        .lineTo(nose * 0.15 + Math.cos(a) * R * 0.28, Math.sin(a) * W * 0.4)
        .lineTo(nose * 0.45 + Math.cos(a) * R * 0.52, Math.sin(a) * W * 0.68)
        .closePath().fill({ color: 0xfdfdf5, alpha: alpha * 0.85 });
    }
    this.eyes(b, -R * 0.12, W * 0.6, R * 0.11, alpha, true);
    // illicium: stalk and glowing bait
    b.moveTo(-R * 0.1, -W * 0.3)
      .quadraticCurveTo(R * 0.9, -W * 1.5, R * 1.55, -W * 0.85)
      .stroke({ color: dark, width: R * 0.09, alpha });
    b.circle(R * 1.55, -W * 0.85, R * 0.2).fill({ color: accent, alpha: 0.95 });
    b.circle(R * 1.55, -W * 0.85, R * 0.36).fill({ color: accent, alpha: 0.28 });
    this.paired((f, dir) => {
      f.moveTo(0, 0).quadraticCurveTo(-R * 0.4, dir * R * 0.6, -R * 0.75, dir * R * 0.35)
        .quadraticCurveTo(-R * 0.4, dir * R * 0.1, 0, 0)
        .fill({ color: accent, alpha: alpha * 0.5 })
        .stroke({ color: this.rim, width: R * 0.04, alpha: alpha * 0.5 });
    }, -R * 0.2, W * 0.75);
    this.buildChain(R * 0.42, W * 0.4, R * 0.1, skin, alpha,
      { len: R * 0.42, spread: R * 0.45, color: accent });
    if (this.chain.length) this.chain[0].x = -R * 0.6;
  }

  /** Everything, larger, with more of it. */
  private drawLeviathan(skin: number, inner: number, accent: number, dark: number, alpha: number) {
    const b = this.body;
    const nose = R * 1.35, W = R * 0.88;
    b.moveTo(nose, 0)
      .bezierCurveTo(nose * 0.72, -W * 1.0, R * 0.1, -W * 1.05, -R * 0.62, -W * 0.6)
      .lineTo(-R * 0.62, W * 0.6)
      .bezierCurveTo(R * 0.1, W * 1.05, nose * 0.72, W * 1.0, nose, 0)
      .fill({ color: skin, alpha })
      ;
    this.shell(b, accent, alpha);
    b.ellipse(-R * 0.1, 0, R * 0.5, W * 0.5).fill({ color: inner, alpha: alpha * 0.35 });
    for (let i = 0; i < 5; i++) {
      const x = R * 0.5 - i * R * 0.3;
      b.moveTo(x, -W * 0.85).quadraticCurveTo(x - R * 0.2, 0, x, W * 0.85)
        .stroke({ color: dark, width: R * 0.07, alpha: alpha * 0.4 });
      for (const dir of [-1, 1]) {
        b.moveTo(x - R * 0.1, dir * W * 0.9).lineTo(x, dir * W * 1.35)
          .lineTo(x + R * 0.1, dir * W * 0.9).closePath().fill({ color: dark, alpha });
      }
    }
    this.mouth(b, nose, R * 1.1, dark, alpha, 8);
    this.eyes(b, nose - R * 0.6, W * 0.66, R * 0.12, alpha, true);
    this.paired((f, dir) => {
      f.moveTo(0, 0).quadraticCurveTo(-R * 0.2, dir * R * 1.2, -R * 1.3, dir * R * 1.15)
        .quadraticCurveTo(-R * 0.7, dir * R * 0.25, 0, 0)
        .fill({ color: accent, alpha: alpha * 0.6 })
        .stroke({ color: this.rim, width: R * 0.05, alpha: alpha * 0.55 });
    }, R * 0.25, W * 0.9);
    this.buildChain(R * 0.5, W * 0.6, R * 0.14, skin, alpha,
      { len: R * 0.8, spread: R * 0.95, color: accent });
    if (this.chain.length) this.chain[0].x = -R * 0.62;
  }

  /** The default fish, and the shape the player starts from. */
  private drawDarter(skin: number, inner: number, accent: number, dark: number, alpha: number) {
    const g = this.g;
    const L = R * 2.3;
    const W = R * (0.86 - Math.min(0.2, g.segments * 0.04));
    const nose = L * 0.5;
    const tailBase = -L * 0.4;

    const outline = (gr: Graphics, s: number) => {
      gr.moveTo(nose * s, 0)
        .bezierCurveTo(nose * 0.78 * s, -W * 0.8 * s, L * 0.08 * s, -W * s, -L * 0.14 * s, -W * 0.72 * s)
        .bezierCurveTo(-L * 0.28 * s, -W * 0.5 * s, tailBase * s, -W * 0.3 * s, tailBase * s, 0)
        .bezierCurveTo(tailBase * s, W * 0.3 * s, -L * 0.28 * s, W * 0.5 * s, -L * 0.14 * s, W * 0.72 * s)
        .bezierCurveTo(L * 0.08 * s, W * s, nose * 0.78 * s, W * 0.8 * s, nose * s, 0);
    };

    const m = this.membrane;
    outline(m, 1.3);
    m.fill({ color: accent, alpha: 0.1 + g.translucent * 0.1 });
    outline(m, 1.3);
    m.stroke({ color: 0xffffff, width: R * 0.05, alpha: 0.16 });

    const b = this.body;
    outline(b, 1);
    b.fill({ color: skin, alpha });
    outline(b, 1);
    this.shell(b, accent, alpha);
    outline(b, 0.68);
    b.fill({ color: inner, alpha: alpha * 0.45 });

    for (let i = 0; i < g.segments; i++) {
      const x = L * 0.16 - i * R * 0.38;
      b.moveTo(x, -W * 0.7).quadraticCurveTo(x - R * 0.2, 0, x, W * 0.7)
        .stroke({ color: dark, width: R * 0.07, alpha: alpha * 0.4 });
    }
    const nr = R * (0.26 + g.eyeSize * 0.08);
    b.ellipse(-L * 0.04, 0, nr * 1.3, nr).fill({ color: dark, alpha: alpha * 0.18 });
    b.ellipse(-L * 0.04, 0, nr * 0.5, nr * 0.4).fill({ color: accent, alpha: alpha * 0.4 });

    this.mouth(b, nose, R * (0.3 + Math.min(g.jaw, 1.1) * 0.5), dark, alpha, g.jaw > 0.55 ? 5 : 0);
    this.eyes(b, nose - R * 0.34, W * 0.42, R * 0.1 * g.eyeSize, alpha, false);

    if (g.glow > 0.01) {
      for (let i = 0; i < 4; i++) {
        const x = L * 0.18 - i * R * 0.4;
        for (const dir of [-1, 1]) {
          b.circle(x, dir * W * 0.6, R * 0.1)
            .fill({ color: accent, alpha: 0.45 + g.glow * 0.4 });
        }
      }
    }

    this.paired((f, dir) => {
      const w = R * (0.5 + g.finSize * 0.38);
      f.moveTo(0, 0)
        .quadraticCurveTo(-w * 0.15, dir * w * 0.75, -w * 0.85, dir * w * 0.95)
        .quadraticCurveTo(-w * 0.6, dir * w * 0.25, 0, 0)
        .fill({ color: accent, alpha: alpha * 0.5 })
        .stroke({ color: this.rim, width: R * 0.042, alpha: alpha * 0.55 });
    }, L * 0.08, W * 0.6);

    this.buildChain(R * 0.52, W * 0.62, R * 0.12, skin, alpha,
      { len: L * (0.3 + g.finSize * 0.1), spread: W * (0.6 + g.tailSplit * 0.9), color: accent });
    if (this.chain.length) this.chain[0].x = tailBase;
  }

  // ------------------------------------------------------------- animation

  /**
   * `beat` is the creature's own swim phase, so the visible stroke and the thrust
   * impulse in the simulation stay locked together. `bank` is -1..1 turn lean.
   */
  /** Kick off a bite: the body compresses and flares, then snaps back. */
  chomp() {
    this.chompT = 1;
  }

  animate(dt: number, thrust: number, beat: number, bank: number) {
    const m = this.motion;
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

    const amp = m.amp * (0.45 + thrust * 0.75);
    for (let i = 0; i < this.chain.length; i++) {
      const w = (i + 1) / this.chain.length;
      this.chain[i].rotation = Math.sin(beat - i * m.lag) * amp * (0.5 + w) + bank * 0.22 * w;
    }
    if (m.finFlap) {
      const f = Math.sin(beat) * m.finFlap;
      const flare = this.chompT > 0 ? Math.sin(this.chompT * Math.PI) * 0.55 : 0;
      this.finL.rotation = -f - bank * 0.3 + flare;
      this.finR.rotation = -f - bank * 0.3 - flare;
    }
    if (m.pulse) {
      const p = 1 + Math.sin(beat) * m.pulse;
      this.body.scale.set(p, 2 - p);
      this.membrane.scale.set(p * 1.02, (2 - p) * 1.02);
    }
    this.body.rotation = Math.sin(beat) * m.amp * 0.07 + bank * 0.12;
  }

  get genome() { return this.g; }
}
