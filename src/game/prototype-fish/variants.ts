/**
 * PROTOTYPE — throwaway. Four takes on the player fish, all darker and more sinister
 * than the shipping darter, drawn top-down at the same reference half-length R as
 * `fishview.ts` so anything that reads here can be lifted straight into `drawDarter`.
 *
 * Deliberately duplicated from FishView rather than subclassed: the point is to mutate
 * the drawing freely, not to keep the production class factored.
 */
import { AlphaFilter, Container, Graphics, Sprite } from 'pixi.js';
import { menace, type Genome } from '../genome';
import { glowTexture } from '../textures';
import { hsl, lerp } from '../util';

const R = 10;

/** The one contour colour. Everything on the chimaera is outlined in exactly this. */
const INK = 0x0b0a12;

export type VariantId = 'current' | 'abyssal' | 'carapace' | 'wraith' | 'husk' | 'chimaera';

export const VARIANTS: { id: VariantId; name: string; note: string }[] = [
  { id: 'current', name: 'A — Current', note: 'shipping darter, for comparison' },
  { id: 'abyssal', name: 'B — Abyssal', note: 'near-black mass, bone jaw, ember rim' },
  { id: 'carapace', name: 'C — Carapace', note: 'plated and spined, cold seams' },
  { id: 'wraith', name: 'D — Wraith', note: 'smoke body, dark viscera showing through' },
  { id: 'husk', name: 'E — Husk', note: 'scarred, asymmetric, half-dead' },
  { id: 'chimaera', name: 'F — Chimaera', note: 'one contour, flat mass, olive blades, one eye' },
];

/**
 * Swim shape per variant. The wraith wants more links at a lower amplitude: a translucent
 * body shows every joint, so the wave has to be gentle enough that no two links ever sit
 * at a hard angle to each other.
 */
const CFG: Record<VariantId, { links: number; amp: number; lag: number; flat: number }> = {
  current:  { links: 2, amp: 0.42, lag: 0.95, flat: 0 },
  abyssal:  { links: 2, amp: 0.38, lag: 0.9,  flat: 0 },
  carapace: { links: 2, amp: 0.3,  lag: 0.8,  flat: 0 },
  // flat: render the whole animal to a texture and fade THAT, so overlapping parts stop
  // compounding into seams. Without it a see-through fish is a diagram of its own joints.
  wraith:   { links: 5, amp: 0.17, lag: 0.5,  flat: 0.5 },
  husk:     { links: 2, amp: 0.42, lag: 0.95, flat: 0 },
  // one mass: the tail is two long links buried deep inside the body outline, so the
  // animal bends without ever showing where it is jointed
  chimaera: { links: 2, amp: 0.2,  lag: 0.5,  flat: 0 },
};

export class ProtoFish extends Container {
  private aura = new Sprite(glowTexture());
  private halo = new Sprite(glowTexture());
  private membrane = new Graphics();
  private finL = new Graphics();
  private finR = new Graphics();
  private body = new Graphics();
  private chain: Graphics[] = [];
  private men = 0;
  private rim = 0xffffff;
  private cfg = CFG.current;
  private fade = new AlphaFilter();

  constructor(private g: Genome, variant: VariantId) {
    super();
    for (const s of [this.aura, this.halo]) { s.anchor.set(0.5); s.blendMode = 'add'; }
    this.addChild(this.aura, this.halo, this.membrane, this.finL, this.finR, this.body);
    this.rebuild(g, variant);
  }

  rebuild(g: Genome, variant: VariantId) {
    this.g = g;
    this.men = menace(g);
    for (const link of this.chain) link.destroy();
    this.chain = [];
    for (const gr of [this.body, this.membrane, this.finL, this.finR]) gr.clear();

    const cfg = this.cfg = CFG[variant];
    this.filters = cfg.flat ? [this.fade] : [];
    this.fade.alpha = cfg.flat || 1;
    let parent: Container = this;
    for (let i = 0; i < cfg.links; i++) {
      const link = new Graphics();
      parent.addChild(link);
      this.chain.push(link);
      parent = link;
    }
    this.setChildIndex(this.chain[0], 3);

    switch (variant) {
      case 'abyssal': this.abyssal(); break;
      case 'carapace': this.carapace(); break;
      case 'wraith': this.wraith(); break;
      case 'husk': this.husk(); break;
      case 'chimaera': this.chimaera(); break;
      default: this.current(); break;
    }
    this.scale.set(g.size / R);
  }

  // ------------------------------------------------------------------ shared

  /** The darter silhouette, scaled about its own centre line. */
  private outline(gr: Graphics, s: number, L: number, W: number, nose: number, tail: number) {
    gr.moveTo(nose * s, 0)
      .bezierCurveTo(nose * 0.78 * s, -W * 0.8 * s, L * 0.08 * s, -W * s, -L * 0.14 * s, -W * 0.72 * s)
      .bezierCurveTo(-L * 0.28 * s, -W * 0.5 * s, tail * s, -W * 0.3 * s, tail * s, 0)
      .bezierCurveTo(tail * s, W * 0.3 * s, -L * 0.28 * s, W * 0.5 * s, -L * 0.14 * s, W * 0.72 * s)
      .bezierCurveTo(L * 0.08 * s, W * s, nose * 0.78 * s, W * 0.8 * s, nose * s, 0);
  }

  private dims() {
    const L = R * 2.3;
    const W = R * (0.86 - Math.min(0.2, this.g.segments * 0.04));
    return { L, W, nose: L * 0.5, tail: -L * 0.4 };
  }

  private shell(b: Graphics, accent: number, alpha: number, w = 1) {
    b.stroke({ color: 0x04080d, width: R * 0.13 * w, alpha: alpha * 0.8 })
      .stroke({ color: accent, width: R * 0.05 * w, alpha: 0.45 + this.men * 0.35 });
  }

  private eyes(b: Graphics, x: number, y: number, r: number, alpha: number, gazeHue: number,
               lit = 0.55) {
    const gaze = hsl(gazeHue, 0.85, 0.62);
    for (const dir of [-1, 1]) {
      b.circle(x, dir * y, r * 1.5).fill({ color: 0x03070c, alpha: alpha * 0.5 });
      b.moveTo(x - r, dir * y - r * 0.5)
        .quadraticCurveTo(x + r * 0.55, dir * y, x - r, dir * y + r * 0.5)
        .stroke({ color: gaze, width: r * 0.62, alpha: lit + this.men * 0.4 });
    }
  }

  private mouth(b: Graphics, nose: number, w: number, color: number, alpha: number,
                teeth: number, toothColor = 0xf6f8ef, reach = 1) {
    b.moveTo(nose, 0)
      .quadraticCurveTo(nose - w * 0.5, -w * 0.68, nose - w, 0)
      .quadraticCurveTo(nose - w * 0.5, w * 0.68, nose, 0)
      .fill({ color, alpha })
      .stroke({ color: hsl(lerp(30, 8, this.men), 0.8, 0.5), width: w * 0.1,
                alpha: 0.25 + this.men * 0.45 });
    for (let i = 0; i < teeth; i++) {
      const t = teeth === 1 ? 0.5 : i / (teeth - 1);
      const a = (-1 + t * 2) * 1.0;
      const bx = nose - w * 0.5 + Math.cos(a) * w * 0.34;
      const by = Math.sin(a) * w * 0.52;
      b.moveTo(bx - w * 0.1, by * 0.72).lineTo(bx + w * 0.34 * reach, by)
        .lineTo(bx - w * 0.04, by * 1.05)
        .closePath().fill({ color: toothColor, alpha: alpha * 0.85 });
    }
  }

  private pectorals(draw: (g: Graphics, dir: -1 | 1) => void, x: number, y: number) {
    for (const [fin, dir] of [[this.finL, -1], [this.finR, 1]] as const) {
      draw(fin, dir);
      fin.x = x;
      fin.y = dir * y;
    }
  }

  private buildChain(len: number, w0: number, w1: number, color: number, alpha: number,
                     fin: { len: number; spread: number; color: number } | null,
                     edge = 0x04080d) {
    const n = this.chain.length;
    for (let i = 0; i < n; i++) {
      const link = this.chain[i];
      const a = w0 + (w1 - w0) * (i / n);
      const b = w0 + (w1 - w0) * ((i + 1) / n);
      const over = len * 0.42;
      link.moveTo(over, -a * 0.86)
        .quadraticCurveTo(over * 0.4, -a, -len * 0.4, -(a + b) * 0.5)
        .lineTo(-len, -b).lineTo(-len, b)
        .quadraticCurveTo(-len * 0.4, (a + b) * 0.5, over * 0.4, a)
        .lineTo(over, a * 0.86).closePath().fill({ color, alpha });
      for (const dir of [-1, 1] as const) {
        link.moveTo(over, dir * a * 0.86)
          .quadraticCurveTo(over * 0.4, dir * a, -len * 0.4, dir * (a + b) * 0.5)
          .lineTo(-len, dir * b)
          .stroke({ color: edge, width: R * 0.075, alpha: alpha * 0.55 });
      }
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
          .stroke({ color: this.rim, width: R * 0.045, alpha: alpha * 0.5 });
      }
    }
    if (this.chain.length) this.chain[0].x = this.dims().tail;
  }

  private glow(accent: number, tint: number, auraScale: number, halo = 1) {
    const g = this.g;
    this.halo.tint = accent;
    this.halo.alpha = (0.1 + g.glow * 0.5) * halo;
    this.halo.scale.set((R * 0.4 + g.glow * R * 0.5) / 32);
    this.aura.tint = tint;
    this.aura.alpha = this.men * 0.5;
    this.aura.scale.set((R * auraScale * (0.6 + this.men)) / 32);
  }

  // ---------------------------------------------------------------- variants

  /** A — what ships today. */
  private current() {
    const g = this.g;
    const { L, W, nose, tail } = this.dims();
    const skin = hsl(g.hue, 0.34 + this.men * 0.1, 0.42 - this.men * 0.17);
    const inner = hsl(g.hue + 14, 0.34, 0.56 - this.men * 0.16);
    const accent = hsl(lerp(g.accentHue, g.accentHue > 180 ? 22 : 8, this.men * 0.75),
                       0.55 + this.men * 0.3, 0.55);
    const dark = hsl(g.hue, 0.5, 0.1);
    this.rim = hsl(g.accentHue + 6, 0.72, 0.7 - this.men * 0.06);
    const alpha = 0.94 - Math.min(0.6, g.translucent * 0.62);

    const m = this.membrane;
    this.outline(m, 1.3, L, W, nose, tail);
    m.fill({ color: accent, alpha: 0.1 + g.translucent * 0.1 });
    this.outline(m, 1.3, L, W, nose, tail);
    m.stroke({ color: 0xffffff, width: R * 0.05, alpha: 0.16 });

    const b = this.body;
    this.outline(b, 1, L, W, nose, tail);
    b.fill({ color: skin, alpha });
    this.outline(b, 1, L, W, nose, tail);
    this.shell(b, accent, alpha);
    this.outline(b, 0.68, L, W, nose, tail);
    b.fill({ color: inner, alpha: alpha * 0.45 });

    this.mouth(b, nose, R * (0.3 + Math.min(g.jaw, 1.1) * 0.5), dark, alpha, g.jaw > 0.55 ? 5 : 0);
    this.eyes(b, nose - R * 0.34, W * 0.42, R * 0.1 * g.eyeSize, alpha, lerp(176, 12, this.men));

    this.pectorals((f, dir) => {
      const w = R * (0.5 + g.finSize * 0.38);
      f.moveTo(0, 0)
        .quadraticCurveTo(-w * 0.15, dir * w * 0.75, -w * 0.85, dir * w * 0.95)
        .quadraticCurveTo(-w * 0.6, dir * w * 0.25, 0, 0)
        .fill({ color: accent, alpha: alpha * 0.5 })
        .stroke({ color: this.rim, width: R * 0.042, alpha: alpha * 0.55 });
    }, L * 0.08, W * 0.6);

    this.buildChain(R * 0.52, W * 0.62, R * 0.12, skin, alpha,
      { len: L * (0.3 + g.finSize * 0.1), spread: W * (0.6 + g.tailSplit * 0.9), color: accent });
    this.glow(accent, 0xff3a2a, 1.6);
  }

  /**
   * B — Abyssal. The mass goes almost black and almost grey: colour lives only on the
   * edge, in the jaw and in the eye. Menace is spent on heat (ember rim) rather than on
   * more shapes, so a big fish reads as one dark slab with a lit outline.
   */
  private abyssal() {
    const g = this.g;
    const { L, W, nose, tail } = this.dims();
    const skin = hsl(g.hue + 190, 0.22, 0.14 - this.men * 0.06);
    const inner = hsl(g.hue + 200, 0.18, 0.2 - this.men * 0.07);
    const ember = hsl(lerp(24, 6, this.men), 0.85, 0.46 + this.men * 0.12);
    const bone = 0xd8d2c0;
    this.rim = hsl(lerp(200, 14, this.men), 0.6, 0.55);
    const alpha = 0.97 - Math.min(0.5, g.translucent * 0.5);

    const b = this.body;
    this.outline(b, 1, L, W, nose, tail);
    b.fill({ color: skin, alpha });
    this.outline(b, 1, L, W, nose, tail);
    b.stroke({ color: 0x02040a, width: R * 0.17, alpha })
      .stroke({ color: ember, width: R * 0.045, alpha: 0.3 + this.men * 0.5 });
    // a dorsal spine as a single hot hairline — the one bright thing on the back
    b.moveTo(nose * 0.82, 0).lineTo(tail * 0.9, 0)
      .stroke({ color: ember, width: R * 0.05, alpha: 0.18 + this.men * 0.4 });
    this.outline(b, 0.6, L, W, nose, tail);
    b.fill({ color: inner, alpha: alpha * 0.35 });

    // bone plate over the skull, which is where the jaw hardware hangs
    b.moveTo(nose * 0.92, 0)
      .quadraticCurveTo(nose * 0.4, -W * 0.62, -L * 0.06, -W * 0.34)
      .lineTo(-L * 0.06, W * 0.34)
      .quadraticCurveTo(nose * 0.4, W * 0.62, nose * 0.92, 0)
      .fill({ color: bone, alpha: alpha * (0.1 + this.men * 0.16) });

    this.mouth(b, nose, R * (0.34 + Math.min(g.jaw, 1.2) * 0.62), 0x05070b, alpha,
               g.jaw > 0.4 ? 7 : 3, bone, 1.35);
    this.eyes(b, nose - R * 0.38, W * 0.44, R * 0.11 * g.eyeSize, alpha,
              lerp(46, 6, this.men), 0.7);

    this.pectorals((f, dir) => {
      const w = R * (0.55 + g.finSize * 0.4);
      // swept back to a point: a blade, not a paddle
      f.moveTo(0, 0)
        .quadraticCurveTo(-w * 0.1, dir * w * 0.5, -w * 1.15, dir * w * 0.8)
        .quadraticCurveTo(-w * 0.55, dir * w * 0.18, 0, 0)
        .fill({ color: 0x080d14, alpha: alpha * 0.8 })
        .stroke({ color: ember, width: R * 0.04, alpha: 0.35 + this.men * 0.3 });
    }, L * 0.06, W * 0.58);

    this.buildChain(R * 0.52, W * 0.6, R * 0.1, skin, alpha,
      { len: L * (0.34 + g.finSize * 0.12), spread: W * (0.55 + g.tailSplit * 1.0),
        color: 0x090e16 }, 0x02040a);
    this.glow(ember, 0xff2a12, 1.8);
  }

  /**
   * C — Carapace. Armoured: overlapping plates across the body, a spined ridge, and cold
   * bioluminescent seams between the plates. Menace shows as more and longer spines.
   */
  private carapace() {
    const g = this.g;
    const { L, W, nose, tail } = this.dims();
    const skin = hsl(g.hue + 160, 0.2, 0.19 - this.men * 0.05);
    const plate = hsl(g.hue + 165, 0.16, 0.26);
    const seam = hsl(lerp(186, 150, this.men), 0.9, 0.55);
    this.rim = hsl(190, 0.5, 0.62);
    const alpha = 0.98 - Math.min(0.45, g.translucent * 0.45);

    const b = this.body;
    this.outline(b, 1, L, W, nose, tail);
    b.fill({ color: skin, alpha });

    // plates run front to back and overlap like a lobster tail; each seam glows
    const plates = 5;
    for (let i = 0; i < plates; i++) {
      const t = i / plates;
      const x = nose * 0.72 - t * (nose * 0.72 - tail * 0.85);
      const hw = W * (0.95 - t * 0.45);
      b.moveTo(x, -hw)
        .quadraticCurveTo(x - R * 0.34, 0, x, hw)
        .quadraticCurveTo(x - R * 0.1, 0, x, -hw)
        .fill({ color: plate, alpha: alpha * 0.5 })
        .stroke({ color: seam, width: R * 0.045, alpha: 0.25 + this.men * 0.35 });
    }

    this.outline(b, 1, L, W, nose, tail);
    b.stroke({ color: 0x03060b, width: R * 0.16, alpha })
      .stroke({ color: seam, width: R * 0.04, alpha: 0.3 + this.men * 0.3 });

    // spined ridge down both flanks; count and length ride menace
    const spines = 4 + Math.round(this.men * 4);
    for (let i = 0; i < spines; i++) {
      const t = i / (spines - 1);
      const x = nose * 0.55 - t * (nose * 0.55 - tail * 0.9);
      const hw = W * (0.9 - t * 0.4);
      const len = R * (0.2 + this.men * 0.4) * (1 - t * 0.4);
      for (const dir of [-1, 1]) {
        b.moveTo(x + R * 0.12, dir * hw)
          .lineTo(x - R * 0.12, dir * hw)
          .lineTo(x - R * 0.02, dir * (hw + len))
          .closePath().fill({ color: 0x0b1118, alpha })
          .stroke({ color: seam, width: R * 0.03, alpha: 0.3 + this.men * 0.4 });
      }
    }

    this.mouth(b, nose, R * (0.3 + Math.min(g.jaw, 1.1) * 0.5), 0x04080e, alpha,
               g.jaw > 0.4 ? 4 : 2, 0xcfd8d0);
    this.eyes(b, nose - R * 0.36, W * 0.46, R * 0.095 * g.eyeSize, alpha, 186, 0.6);

    this.pectorals((f, dir) => {
      const w = R * (0.5 + g.finSize * 0.36);
      // a rigid, ribbed paddle rather than a soft membrane
      f.moveTo(0, 0).lineTo(-w * 0.95, dir * w * 0.55).lineTo(-w * 0.7, dir * w * 1.0)
        .closePath().fill({ color: 0x0c131b, alpha: alpha * 0.85 })
        .stroke({ color: seam, width: R * 0.035, alpha: 0.4 });
      for (let i = 1; i < 3; i++) {
        f.moveTo(0, 0).lineTo(-w * (0.9 - i * 0.08), dir * w * (0.6 + i * 0.2))
          .stroke({ color: seam, width: R * 0.025, alpha: 0.25 });
      }
    }, L * 0.08, W * 0.6);

    this.buildChain(R * 0.52, W * 0.6, R * 0.12, plate, alpha,
      { len: L * (0.28 + g.finSize * 0.1), spread: W * (0.5 + g.tailSplit * 0.8),
        color: 0x0c131b }, 0x03060b);
    this.glow(seam, 0x2af0d0, 1.5);
  }

  /**
   * D — Wraith. The body is smoke: a hard dark spine, ribs and a gut read through it, with
   * trailing filaments. Drawn fully opaque and faded as a whole by the AlphaFilter — the
   * first pass drew every part translucent, and every overlap then doubled up into a
   * bright seam, which is what made the joints and the tail read as separate objects.
   */
  private wraith() {
    const g = this.g;
    const { L, W, nose, tail } = this.dims();
    const flesh = hsl(g.hue + 210, 0.26, 0.3);
    const organ = hsl(lerp(280, 340, this.men), 0.55, 0.28 - this.men * 0.08);
    const lit = hsl(lerp(160, 96, this.men), 0.8, 0.6);
    this.rim = hsl(200, 0.4, 0.75);

    const m = this.membrane;
    this.outline(m, 1.22, L, W, nose, tail);
    m.fill({ color: flesh, alpha: 0.3 });

    const b = this.body;
    this.outline(b, 1, L, W, nose, tail);
    b.fill({ color: flesh, alpha: 1 });

    b.moveTo(nose * 0.86, 0).lineTo(tail * 0.95, 0)
      .stroke({ color: 0x060a10, width: R * 0.09, alpha: 0.75 });
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const x = nose * 0.6 - t * (nose * 0.6 - tail * 0.9);
      const hw = W * (0.85 - t * 0.5);
      for (const dir of [-1, 1]) {
        b.moveTo(x, 0).quadraticCurveTo(x - R * 0.1, dir * hw * 0.6, x - R * 0.26, dir * hw)
          .stroke({ color: 0x070c12, width: R * 0.055, alpha: 0.6 });
      }
    }
    b.ellipse(-L * 0.04, 0, R * 0.42, R * 0.3).fill({ color: organ, alpha: 0.95 });
    b.ellipse(-L * 0.04, 0, R * 0.2, R * 0.13).fill({ color: lit, alpha: 0.5 + g.glow * 0.4 });

    this.outline(b, 1, L, W, nose, tail);
    b.stroke({ color: 0x050a10, width: R * 0.085, alpha: 0.8 })
      .stroke({ color: this.rim, width: R * 0.03, alpha: 0.45 });

    this.mouth(b, nose, R * (0.32 + Math.min(g.jaw, 1.2) * 0.58), 0x04070c, 1,
               g.jaw > 0.4 ? 6 : 3, 0xe6f0e2, 1.2);
    this.eyes(b, nose - R * 0.34, W * 0.42, R * 0.105 * g.eyeSize, 1,
              lerp(150, 90, this.men), 0.75);

    this.pectorals((f, dir) => {
      const w = R * (0.55 + g.finSize * 0.45);
      f.moveTo(0, 0)
        .quadraticCurveTo(-w * 0.2, dir * w * 0.8, -w * 1.1, dir * w * 1.05)
        .quadraticCurveTo(-w * 0.5, dir * w * 0.3, 0, 0)
        .fill({ color: flesh, alpha: 0.55 })
        .stroke({ color: this.rim, width: R * 0.03, alpha: 0.5 });
      for (let i = 0; i < 3; i++) {
        const s = 0.6 + i * 0.2;
        f.moveTo(-w * 0.5, dir * w * 0.5)
          .quadraticCurveTo(-w * 1.2 * s, dir * w * 0.9, -w * 1.8 * s, dir * w * 0.7)
          .stroke({ color: lit, width: R * 0.022, alpha: 0.35 });
      }
    }, L * 0.08, W * 0.6);

    this.ghostChain(flesh, lit, W * 0.6, L * (0.3 + g.finSize * 0.08),
                    W * (0.6 + g.tailSplit * 0.7));
  }

  /**
   * A tail that has no joints to see. Each link is a single curved lobe whose leading edge
   * is wider than the previous link\'s trailing edge, so a bend can never open a notch in
   * the outline, and only the last one carries a fin — a long, low-contrast veil rather
   * than the hard delta the other plans use.
   */
  private ghostChain(color: number, lit: number, w0: number, finLen: number, spread: number) {
    const n = this.chain.length;
    const len = R * 0.3;
    for (let i = 0; i < n; i++) {
      const link = this.chain[i];
      // taper on a curve, not linearly: the width has to fall off slowly at the root and
      // fast at the tip or the tail reads as a stiff wedge
      const wAt = (k: number) => w0 * (1 - (k / n) ** 1.25) + R * 0.035;
      const a = wAt(i);
      const b = wAt(i + 1);
      // the lobe starts back inside its parent, so the seam is always covered
      const over = len * 0.9;
      link.moveTo(over, 0)
        .bezierCurveTo(over, -a * 0.95, -len * 0.3, -a, -len, -b)
        .lineTo(-len, b)
        .bezierCurveTo(-len * 0.3, a, over, a * 0.95, over, 0)
        .fill({ color, alpha: 1 });
      // one soft highlight along the flank; no dark outline, which is what was reading as
      // a line across the body at every joint
      link.moveTo(over * 0.4, -a * 0.8)
        .quadraticCurveTo(-len * 0.4, -a * 0.75, -len * 0.95, -b * 0.85)
        .stroke({ color: this.rim, width: R * 0.03, alpha: 0.18 });
      if (i > 0) link.x = -len;
      if (i === n - 1) {
        const tipW = b;
        link.moveTo(-len, -tipW)
          .bezierCurveTo(-len - finLen * 0.45, -spread * 0.5, -len - finLen * 0.9, -spread * 0.9,
                         -len - finLen, -spread)
          .quadraticCurveTo(-len - finLen * 0.55, 0, -len - finLen, spread)
          .bezierCurveTo(-len - finLen * 0.9, spread * 0.9, -len - finLen * 0.45, spread * 0.5,
                         -len, tipW)
          .closePath().fill({ color, alpha: 0.5 })
          .stroke({ color: this.rim, width: R * 0.028, alpha: 0.35 });
        // ribs through the veil, which is what makes it read as membrane and not as a flag
        for (const dir of [-1, 1]) {
          for (let k = 1; k <= 2; k++) {
            const t = k / 3;
            link.moveTo(-len, dir * tipW * 0.4)
              .quadraticCurveTo(-len - finLen * 0.5, dir * spread * t * 0.7,
                                -len - finLen * (0.9 + t * 0.1), dir * spread * t)
              .stroke({ color: lit, width: R * 0.02, alpha: 0.22 });
          }
        }
      }
    }
    if (this.chain.length) this.chain[0].x = this.dims().tail;
  }

  /**
   * E — Husk. Symmetry is the thing that makes a fish look healthy, so this one breaks
   * it: a bitten-out flank, mismatched fins, scar seams and a milky blind eye. Menace
   * deepens the damage instead of adding weapons.
   */
  private husk() {
    const g = this.g;
    const { L, W, nose, tail } = this.dims();
    const skin = hsl(g.hue + 175, 0.14, 0.24 - this.men * 0.08);
    const scar = hsl(lerp(20, 350, this.men), 0.4, 0.34);
    const pale = 0xc9c4b2;
    this.rim = hsl(40, 0.25, 0.6);
    const alpha = 0.96;

    const b = this.body;
    this.outline(b, 1, L, W, nose, tail);
    b.fill({ color: skin, alpha });
    this.outline(b, 1, L, W, nose, tail);
    b.stroke({ color: 0x03060b, width: R * 0.15, alpha })
      .stroke({ color: this.rim, width: R * 0.035, alpha: 0.3 });

    // the bite taken out of the left flank — water-coloured, so it reads as absence
    const cut = R * (0.3 + this.men * 0.3);
    b.moveTo(-L * 0.02, -W * 0.95)
      .quadraticCurveTo(-L * 0.1, -W * 0.95 + cut, -L * 0.2, -W * 0.9)
      .quadraticCurveTo(-L * 0.12, -W * 0.6, -L * 0.02, -W * 0.95)
      .fill({ color: 0x02050a, alpha: 0.9 })
      .stroke({ color: scar, width: R * 0.05, alpha: 0.6 });

    // scar seams, stitched across the body at a slant
    for (let i = 0; i < 3; i++) {
      const x = L * 0.1 - i * R * 0.42;
      const y0 = -W * 0.5 + i * W * 0.3;
      b.moveTo(x, y0).lineTo(x - R * 0.3, y0 + W * 0.55)
        .stroke({ color: scar, width: R * 0.05, alpha: 0.45 });
      for (let k = 0; k < 3; k++) {
        const t = (k + 0.5) / 3;
        const sx = x - R * 0.3 * t, sy = y0 + W * 0.55 * t;
        b.moveTo(sx - R * 0.08, sy - R * 0.06).lineTo(sx + R * 0.08, sy + R * 0.06)
          .stroke({ color: pale, width: R * 0.028, alpha: 0.4 });
      }
    }

    this.mouth(b, nose, R * (0.33 + Math.min(g.jaw, 1.2) * 0.55), 0x05080d, alpha,
               g.jaw > 0.4 ? 5 : 2, pale, 1.1);
    // one live eye, one blind: drawn separately, which is the whole point
    const ex = nose - R * 0.34, ey = W * 0.44, er = R * 0.1 * g.eyeSize;
    b.circle(ex, -ey, er * 1.5).fill({ color: 0x03070c, alpha: alpha * 0.5 });
    b.moveTo(ex - er, -ey - er * 0.5)
      .quadraticCurveTo(ex + er * 0.55, -ey, ex - er, -ey + er * 0.5)
      .stroke({ color: hsl(lerp(40, 8, this.men), 0.8, 0.6), width: er * 0.62, alpha: 0.8 });
    b.circle(ex, ey, er * 1.35).fill({ color: pale, alpha: 0.55 });
    b.circle(ex, ey, er * 1.35).stroke({ color: 0x03070c, width: er * 0.4, alpha: 0.7 });

    // asymmetric pectorals: one whole, one a stump
    this.pectorals((f, dir) => {
      const w = R * (0.5 + g.finSize * 0.38) * (dir < 0 ? 1 : 0.45);
      f.moveTo(0, 0)
        .quadraticCurveTo(-w * 0.15, dir * w * 0.75, -w * 0.85, dir * w * 0.95)
        .quadraticCurveTo(-w * 0.6, dir * w * 0.25, 0, 0)
        .fill({ color: skin, alpha: alpha * 0.7 })
        .stroke({ color: dir < 0 ? this.rim : scar, width: R * 0.04, alpha: 0.6 });
    }, L * 0.08, W * 0.6);

    this.buildChain(R * 0.52, W * 0.62, R * 0.12, skin, alpha,
      { len: L * (0.3 + g.finSize * 0.1), spread: W * (0.55 + g.tailSplit * 0.85),
        color: 0x131a1c }, 0x03060b);
    this.glow(scar, 0x8a1e12, 1.5);
  }


  // ------------------------------------------------------ F — Chimaera helpers

  /** Fill a path, then re-issue it as the heavy contour. The contour is the whole style. */
  private slab(gr: Graphics, path: (g: Graphics) => void, color: number, w = 0.2) {
    path(gr);
    gr.fill({ color, alpha: 1 });
    path(gr);
    gr.stroke({ color: INK, width: R * w, alpha: 1, join: 'round', cap: 'round' });
  }

  /**
   * A swept scythe blade, placed and mirrored about the body axis. Built as explicit
   * points rather than a rotated Graphics so the whole cluster can live on one object and
   * share one contour pass — separate children would each carry their own outline and the
   * animal would go back to reading as a pile of parts.
   */
  private blade(gr: Graphics, ox: number, oy: number, ang: number, len: number, w: number,
                dir: -1 | 1, color: number) {
    const a = ang * dir;
    const cos = Math.cos(a), sin = Math.sin(a);
    const P = (x: number, y: number): [number, number] => {
      const yy = y * dir;
      return [ox + x * cos - yy * sin, oy * dir + x * sin + yy * cos];
    };
    this.slab(gr, (g) => {
      g.moveTo(...P(0, -w))
        .quadraticCurveTo(...P(len * 0.55, -w * 1.5), ...P(len, -len * 0.26))
        .quadraticCurveTo(...P(len * 0.5, w * 0.3), ...P(0, w))
        .closePath();
    }, color, 0.16);
  }

  /**
   * F — Chimaera. Everything the other four spend on interior detail goes into one thing:
   * a single heavy contour around a flat, nearly black-purple mass, with olive blades
   * radiating off it and one hot eye. Nothing is shaded — the silhouette carries the whole
   * read, which is the only thing that still works at the 0.34 zoom the deep tiers run at.
   */
  private chimaera() {
    const g = this.g;
    const { L, W, nose, tail } = this.dims();
    const mass = hsl(285 + g.hue * 0.05, 0.38 - this.men * 0.08, 0.24 - this.men * 0.07);
    const bone = hsl(72, 0.2, 0.52 - this.men * 0.06);
    const eye = hsl(lerp(46, 34, this.men), 1, 0.52);
    this.rim = bone;

    const b = this.body;

    // under-limbs first: pure black, and they read as shadow beneath the mass rather than
    // as another set of blades competing with the olive ones
    for (const dir of [-1, 1] as const) {
      for (let i = 0; i < 2; i++) {
        this.blade(b, -L * (0.02 + i * 0.16), W * 0.5, 0.5 + i * 0.5,
                   R * (0.75 + g.finSize * 0.18), R * 0.19, dir, 0x14121c);
      }
    }

    // the body: one wedge, angular, drawn over the limb roots so they emerge from it
    this.slab(b, (gr) => {
      gr.moveTo(nose, 0)
        .quadraticCurveTo(nose * 0.9, -W * 0.72, L * 0.1, -W * 1.02)
        .lineTo(-L * 0.16, -W * 0.78)
        .quadraticCurveTo(tail * 0.9, -W * 0.34, tail, 0)
        .quadraticCurveTo(tail * 0.9, W * 0.34, -L * 0.16, W * 0.78)
        .lineTo(L * 0.1, W * 1.02)
        .quadraticCurveTo(nose * 0.9, W * 0.72, nose, 0)
        .closePath();
    }, mass, 0.22);

    // blade clusters: count rides menace, so evolving grows the weapon rather than the fish
    const claws = 2 + Math.round(this.men * 2);
    for (const dir of [-1, 1] as const) {
      for (let i = 0; i < claws; i++) {
        const t = i / Math.max(1, claws - 1);
        this.blade(b, L * (0.26 - t * 0.5), W * (0.85 - t * 0.12), 0.75 + t * 0.5,
                   R * (1.1 + g.finSize * 0.3) * (1 - t * 0.18), R * 0.22, dir, bone);
      }
    }

    // gill slashes: three strokes of the same ink, the only interior marks allowed
    for (let i = 0; i < 3; i++) {
      const x = L * 0.12 - i * R * 0.3;
      for (const dir of [-1, 1]) {
        b.moveTo(x, dir * W * 0.3).lineTo(x - R * 0.22, dir * W * 0.62)
          .stroke({ color: INK, width: R * 0.09, alpha: 0.9, cap: 'round' });
      }
    }

    // one eye, off the axis, with the specular dot that makes it read as wet
    const ex = nose - R * 0.62, ey = -W * 0.3, er = R * (0.26 + g.eyeSize * 0.1);
    b.ellipse(ex, ey, er * 0.82, er).fill({ color: eye, alpha: 1 });
    b.ellipse(ex, ey, er * 0.82, er)
      .stroke({ color: INK, width: R * 0.1, alpha: 1 });
    b.ellipse(ex - er * 0.2, ey - er * 0.35, er * 0.3, er * 0.34)
      .fill({ color: 0xffffff, alpha: 0.95 });

    // pectorals as one more blade pair, on the flapping objects
    this.pectorals((f, dir) => {
      this.blade(f, 0, 0, 0.9, R * (0.9 + g.finSize * 0.3), R * 0.2, dir, bone);
    }, L * 0.06, W * 0.66);

    this.bladeTail(mass, bone, W * 0.68, L * (0.32 + g.tailSplit * 0.22));
    // no bloom on the body — the contour is doing the work, and a halo behind flat art
    // just fogs the edge that makes it legible
    this.glow(bone, 0x5a1040, 1.3, 0.12);
  }

  /**
   * The tail as a continuation of the mass, not an appendage: each link starts well inside
   * its parent and carries the same contour, so the joint is always buried under the link
   * in front of it. Only the last one changes colour, into the olive sting.
   */
  private bladeTail(mass: number, bone: number, w0: number, finLen: number) {
    const n = this.chain.length;
    const len = R * 0.66;
    for (let i = 0; i < n; i++) {
      const link = this.chain[i];
      const a = w0 * (1 - i / n * 0.48);
      const b = w0 * (1 - (i + 1) / n * 0.48);
      const over = len * 1.1;
      this.slab(link, (gr) => {
        gr.moveTo(over, -a)
          .quadraticCurveTo(-len * 0.3, -(a + b) * 0.5, -len, -b)
          .lineTo(-len, b)
          .quadraticCurveTo(-len * 0.3, (a + b) * 0.5, over, a)
          .closePath();
      }, mass, 0.2);
      if (i > 0) link.x = -len;
      if (i === n - 1) {
        this.slab(link, (gr) => {
          gr.moveTo(-len, -b)
            .quadraticCurveTo(-len - finLen * 0.55, -b * 1.2, -len - finLen, -b * 0.25)
            .quadraticCurveTo(-len - finLen * 0.5, 0, -len, b)
            .closePath();
        }, bone, 0.16);
      }
    }
    if (this.chain.length) this.chain[0].x = this.dims().tail * 0.8;
  }

  animate(dt: number, beat: number, bank: number) {
    void dt;
    const { amp, lag } = this.cfg;
    const n = this.chain.length;
    for (let i = 0; i < n; i++) {
      const w = (i + 1) / n;
      // links are nested, so their rotations add up; past two links the per-link share has
      // to fall or the tip whips out to an angle the body never reaches
      const share = n > 2 ? 2 / n : 0.5 + w;
      this.chain[i].rotation = Math.sin(beat - i * lag) * amp * share + bank * 0.22 * w / n;
    }
    const f = Math.sin(beat) * 0.4;
    this.finL.rotation = -f - bank * 0.3;
    this.finR.rotation = -f - bank * 0.3;
    this.body.rotation = Math.sin(beat) * 0.03 + bank * 0.12;
  }
}
