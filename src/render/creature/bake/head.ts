/**
 * The head, side-on: the snout, the eye, the mouth and gill slit, what a diet puts in the
 * throat, the ampullae, the lure and the barbels.
 */
import { eyeOf, type Genome } from '../../../content/genome';
import { edgeAt, halfWidth, lureArch, lureBulb, shoulderAt, spineAt, R, type Form, type PlanArt } from '../../../content/form';
import { hasSynergy } from '../../../sim/organs';
import { lerp } from '../../../core/util';
import { mass } from './body';
import { rgbOf, type Palette, type RGB } from './palette';
import { lamp } from './lights';
import { M, type Pt, type Sheet } from './sheet';

export const TOXIC: RGB = rgbOf(78, 0.8, 0.52);

/**
 * A squared-off snout: the sperm whale's box, the single most recognisable profile in the
 * ocean and not something a beta curve will ever produce. Laid over the front of the taper
 * as part of the body, so it takes the same light and outline.
 */
export function bluntSnout(s: Sheet, f: Form, A: PlanArt) {
  const x0 = spineAt(0.3, f), x1 = spineAt(0, f) + R * 0.06;
  const top = edgeAt(0.22, f, -1) * (0.9 + A.blunt * 0.12);
  const bot = edgeAt(0.22, f, 1) * (0.55 + A.blunt * 0.3);
  const r = (bot - top) * 0.18;
  mass(s, [[x0, top], [x1 - r, top], [x1, top + r], [x1, bot - r * 1.6], [x1 - r * 2, bot], [x0, bot]]);
}

/** A drawn eye (`SpriteArt.parts`), in R units: its middle, and its radius ring and all. */
export interface DrawnEye { x: number; y: number; r: number }

/**
 * Mouth, teeth, eye and gill slit. `attack` is how far the jaw is dropped for a strike, 0 to
 * 1: the second texture every body is baked with, which the view swaps in mid-attack.
 */
export function head(s: Sheet, f: Form, pal: Palette, g: Genome, A: PlanArt, men: number,
                     attack = 0, drawn = false, eye: DrawnEye | null = null) {
  const peak = shoulderAt(f);
  const gape = Math.min(1.5, g.gape);
  const sieve = Math.min(2, g.filter);
  const net = hasSynergy(g, 'whaleshark') ? 0.7 : 0;
  // the mouth opens down and back from the snout. A gape walks the hinge back down the
  // body, which is what makes a gulper read as mostly mouth rather than as a big grin
  const tm = 0.02;
  const hinge = Math.min(0.42, 0.1 * (1 + gape * 1.8 + sieve * 0.4 + attack * 0.5) * (0.6 + A.mouth * 0.4));
  // a strike opens the jaw by the head's own depth, and a big jaw opens further: an attack
  // has to read as a mouth coming at you, even on a fish whose resting mouth is a seam
  const open = halfWidth(hinge * 0.5, f) *
    (0.12 + Math.min(1.2, g.jaw) * 0.22 + gape * 0.55 + sieve * 0.25 + net
     + attack * (0.5 + Math.min(1.2, g.jaw) * 0.35 + gape * 0.3)) * Math.min(1, A.mouth + 0.3 + attack * 0.4);
  let nose: Pt = [spineAt(tm, f), edgeAt(tm, f, 0.15)];
  let back: Pt = [spineAt(hinge, f), edgeAt(hinge, f, 0.25)];
  let upper: Pt = [nose[0] + s.texel * 0.5, nose[1] - open * 0.35];
  // the lower jaw drops and juts on the strike; the upper barely moves, as a real one does
  let lower: Pt = [nose[0] - s.texel * 0.5 + open * (0.2 + attack * 0.15), nose[1] + open * (0.75 + attack * 0.2)];
  if (A.maw) {
    ({ nose, back, upper, lower } = maw(s, f, pal, g, attack));
  } else if (drawn) {
    // a drawn body has its own mouth, shut and open (`BODIES`)
  } else if (open * s.res < 1.2) {
    // a mouth too small to open is a seam: one dark line from the snout to the hinge
    s.line([nose, back], M.MOUTH);
  } else {
    s.poly([upper, back, lower], M.MOUTH);
  }

  // teeth, once the jaw is worth showing: a few long fangs, or a serrated mouth's many
  // small ones — a saw has many, and that is what separates it from a bigger jaw
  const fangs = A.maw ? 0 : g.serrate > 0 ? 5 + Math.round(Math.min(2, g.serrate) * 3)
    : g.jaw > 0.55 ? Math.min(7, Math.round(2 + g.jaw * 4))
    // any mouth opened to strike shows some teeth: a gape with nothing in it is a hole. A
    // drawn mouth is drawn open without them
    : attack > 0 && !drawn ? 2 + Math.round(g.jaw * 3) : 0;
  if (fangs > 0 && open * s.res >= 2) {
    const long = g.serrate > 0 ? 0.18 : 0.42;
    for (let i = 0; i < fangs; i++) {
      const k = (i + 0.5) / fangs;
      for (const [a, dir] of [[upper, 1], [lower, -1]] as const) {
        const x = lerp(a[0], back[0], k), y = lerp(a[1], back[1], k);
        const len = Math.max(s.texel, open * long * (i % 2 ? 0.55 : 1) * (1 - k * 0.5));
        s.line([[x, y], [x, y + dir * len]], M.TOOTH);
      }
    }
  }

  if (sieve > 0) rakers(s, f, sieve, upper, back, lower, peak);
  if (g.crush > 0) pharynx(s, f, back);
  if (hasSynergy(g, 'morayjaws')) throatJaw(s, nose, back, open);
  if (g.electro > 0) ampullae(s, f, pal, g);

  // the eye. A light-gathering eye is pale because of the tapetum behind it; past the point
  // of no light at all there is nothing to gather, and a blind socket is a dimple
  const te = A.eyeAt;
  let ex = spineAt(te, f);
  let ey = edgeAt(te, f, -0.35);
  if (A.stalks) {
    // carried up on a stalk off the top of the head, leaning forward
    const base = edgeAt(te, f, -0.9), stalk = halfWidth(0.2, f) * 0.9;
    ey = base - stalk;
    s.line([[ex - s.texel, base], [ex, ey + s.texel]], M.FIN);
  }
  // capped against the head: `eyeOf` grows with sense, and a hunter's big eye is still an
  // eye in a head, not a disc covering half of it
  let r = Math.max(s.texel * 0.5, halfWidth(te, f) * Math.min(0.3, 0.15 * eyeOf(g) * A.eye));
  const pale = A.paleEyes || g.eyeAdapt > 0.45;
  if (eye) {
    // the drawn eye is in the picture (`SpriteArt.parts`); what is painted round it — the
    // Four-Eyed Fish's second eye — is placed on it. Its pupil is about the painted eye's size
    ({ x: ex, y: ey } = eye);
    r = eye.r * 0.6;
  } else if (g.eyeAdapt < -0.4) {
    s.blot(ex, ey, r * 0.8, pal.ramp[1], 0.8);
  } else if (A.eyeGlow > 0) {
    // a guardian looks back at you: a red eye with a hot centre and light round it
    s.blot(ex, ey, r * 1.6, rgbOf(0, 0.9, 0.24), 0.5);
    s.blot(ex, ey, r, rgbOf(0, 0.95, 0.2), 1);
    s.light(ex, ey, rgbOf(4, 0.95, 0.5), 0.5 * A.eyeGlow);
  } else if (A.eyeLamp && r * s.res < 1.5) {
    // too small for a socket: one lit pixel, still the lights' colour
    s.dot(ex, ey, lamp(pal.accent), 1);
  } else if (A.eyeLamp) {
    // a dark socket round a lit disc: the ring is what keeps a glowing eye an eye, and
    // not one more of the lights on the animal
    s.blot(ex, ey, r * 1.3, pal.ramp[0], 1);
    s.blot(ex, ey, r * 0.8, pal.accent, 1);
    if (r * s.res >= 2.5) s.blot(ex, ey, r * 0.42, lamp(pal.accent), 1);
    s.dot(ex + r * 0.3, ey - r * 0.3, [240, 252, 255], 1);
    s.light(ex, ey, pal.accent, 0.35);
  } else {
    s.blot(ex, ey, r, [8, 10, 18], 1);
    const iris = pale ? rgbOf(lerp(46, 14, men), 0.9, 0.6) : rgbOf(g.hue + 180, 0.2, 0.25);
    if (r * s.res >= 1.5) s.blot(ex, ey, r * 0.55, iris, 1);
    // one hard highlight, up and forward: the pixel that makes it wet
    if (r * s.res >= 1.2) s.dot(ex + r * 0.35, ey - r * 0.35, [236, 246, 250], 0.95);
    else if (pale) s.dot(ex, ey, iris, 1);
  }
  // Four-Eyed Fish: Anableps's eyes stand up out of the head, each split at the waterline into
  // one that looks above and one below. Side-on that is a second eye over the first, a band of
  // the skin between them — four eyes, where the multishot says four shots
  if (g.foureye > 0) {
    const uy = ey - r * 2.1, ux = ex - r * 0.2;
    s.ellipse(ux, uy + r * 0.4, r * 1.2, r * 1.1, M.BODY);
    s.blot(ux, uy, r, [8, 10, 18], 1);
    if (r * s.res >= 1.5) s.blot(ux, uy, r * 0.55, rgbOf(g.hue + 180, 0.2, 0.25), 1);
    s.dot(ux + r * 0.35, uy - r * 0.35, [236, 246, 250], 0.95);
  }

  // the gill slit: a dark crescent behind the head
  if (A.gills && !drawn) {
    const tg = Math.min(0.4, peak * 0.9);
    const n = Math.max(2, Math.round(halfWidth(tg, f) * 1.2 * s.res));
    for (let i = 0; i <= n; i++) {
      const k = -0.6 + (i / n) * 1.2;
      const bow = (1 - k * k) * halfWidth(tg, f) * 0.18;
      s.dot(spineAt(tg, f) - bow, edgeAt(tg, f, k), pal.ramp[1], 0.75);
    }
  }
}

/**
 * The angler's jaw (`PlanArt.maw`), held ajar whatever it is doing: the throat a dark gap
 * across the front of the head, the lower jaw a bowl of its own jutting past the upper,
 * both lipped and lined with long fangs that lean in over the gap. A strike drops the bowl
 * and pushes it further out. Returns the mouth's corners for what else sits in it.
 */
function maw(s: Sheet, f: Form, pal: Palette, g: Genome, attack: number) {
  const jaw = Math.min(1.5, g.jaw), gape = Math.min(1.5, g.gape);
  const th = 0.24 + gape * 0.03;
  const depth = halfWidth(th * 0.6, f) * 2;
  const open = depth * (0.26 + gape * 0.08 + jaw * 0.05 + attack * 0.3);
  const top = edgeAt(0.03, f, -0.1);
  const back: Pt = [spineAt(th, f), edgeAt(th, f, 0.4)];
  const upper: Pt = [spineAt(0, f) + s.texel, top];
  // the underbite: the chin sits ahead of the snout, further on the strike
  const chin: Pt = [upper[0] + open * (0.35 + attack * 0.2), top + open];
  const lip = (a: Pt, b: Pt, sag: number, n = 10): Pt[] => {
    const out: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      out.push([lerp(a[0], b[0], k), lerp(a[1], b[1], k) + Math.sin(k * Math.PI) * sag]);
    }
    return out;
  };
  // the upper lip bows up toward the eye, the lower one sags into the bowl under it
  const upperLip = lip(upper, back, -open * 0.12);
  const lowerLip = lip(chin, back, open * 0.14);
  const bowl = open * 0.32;
  mass(s, [...lowerLip, ...lowerLip.map(([x, y], i): Pt =>
    [x - bowl * 0.2, y + bowl * Math.sin((1 - i / (lowerLip.length - 1)) * Math.PI * 0.5 + 0.35)]).reverse()]);
  s.poly([...upperLip, ...lowerLip.slice().reverse()], M.MOUTH);
  if (open * s.res >= 2) {
    for (const [x, y] of [...upperLip, ...lowerLip]) s.dot(x, y, pal.lip, 0.9);
  }

  // long needles, alternately long and short, shortening into the corner; the lower row
  // leans forward out of the bowl, as an angler's do
  const n = open * s.res < 3 ? 2 : Math.min(9, Math.round(3 + jaw * 4));
  for (let i = 0; i < n; i++) {
    const k = (i + 0.4) / n;
    const len = open * (i % 2 ? 0.34 : 0.62) * (1 - k * 0.55);
    const w = Math.max(s.texel * 0.6, open * 0.03);
    for (const [row, dir, lean] of [[upperLip, 1, -0.1], [lowerLip, -1, 0.25]] as const) {
      const [x, y] = row[Math.round(k * (row.length - 1))];
      s.poly([[x - w, y], [x + w, y], [x + len * lean, y + dir * len]], M.TOOTH);
    }
  }
  return { nose: upper, back, upper, lower: chin };
}

/**
 * Gill Rakers: a comb standing in the open mouth, and a row of gill slits behind it — the
 * whale shark's, because a filter feeder is a body built around pushing water through
 * itself.
 */
function rakers(s: Sheet, f: Form, sieve: number, upper: Pt, back: Pt, lower: Pt, peak: number) {
  const n = 3 + Math.round(sieve * 2);
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n;
    const x = lerp(upper[0], back[0], k);
    s.line([[x, lerp(upper[1], back[1], k) + s.texel], [x, lerp(lower[1], back[1], k) - s.texel]], M.TOOTH);
  }
  const slits = 3 + Math.round(sieve);
  for (let i = 0; i < slits; i++) {
    const t = Math.min(0.45, peak * 0.7 + i * 0.035);
    s.line([[spineAt(t, f), edgeAt(t, f, -0.5)], [spineAt(t, f) - s.texel, edgeAt(t, f, 0.45)]], M.MOUTH);
  }
}

/**
 * Crushing Pharynx: a jaw built for pressure. The adductor bulges under the cheek — the
 * one organ that swells the head's own outline, so a crusher reads as jowled — and the lips
 * carry blunt plates rather than teeth, since a molar that points is a molar that snaps.
 */
function pharynx(s: Sheet, f: Form, back: Pt) {
  const t = 0.14;
  const w = halfWidth(t, f);
  mass(s, [[spineAt(0.05, f), edgeAt(0.05, f, 0.8)], [spineAt(t, f), edgeAt(t, f, 1) + w * 0.35],
           [spineAt(0.26, f), edgeAt(0.26, f, 0.9)], [spineAt(0.2, f), edgeAt(0.2, f, 0.3)]]);
  for (let i = 0; i < 3; i++) {
    const x = lerp(spineAt(0.03, f), back[0], (i + 0.5) / 3);
    s.ellipse(x, back[1], s.texel * 1.2, s.texel * 0.8, M.TOOTH);
  }
}

/**
 * Moray Jaws: the second jaw, set back in the throat — a row of hooked teeth just inside
 * the hinge, raked backward the way pharyngeal teeth are, so the gape shows a mouth behind
 * the mouth. Shut, it is a pale ridge at the corner of the jaw, which is all a moray shows.
 */
function throatJaw(s: Sheet, nose: Pt, back: Pt, open: number) {
  const n = open * s.res >= 3 ? 4 : 2;
  for (let i = 0; i < n; i++) {
    const k = 0.1 + i * 0.09;
    const x = lerp(back[0], nose[0], k), y = back[1] - open * (0.1 + k * 0.2);
    const len = Math.max(s.texel, open * 0.28);
    s.line([[x, y - len * 0.5], [x - len * 0.5, y + len * 0.5]], M.TOOTH);
  }
}

/**
 * Ampullae of Lorenzini: the pores of the electric sense peppered over the snout — dark
 * pits, each with a pale rim, densest at the nose and thinning back toward the eye.
 */
function ampullae(s: Sheet, f: Form, pal: Palette, g: Genome) {
  const n = 5 + Math.round(Math.min(2, g.electro) * 4);
  for (let i = 0; i < n; i++) {
    const t = 0.02 + ((i * 0.618) % 1) * 0.16;
    const k = -0.6 + ((i * 0.382) % 1) * 1.1;
    const x = spineAt(t, f), y = edgeAt(t, f, k);
    s.dot(x, y, pal.dark, 1);
    s.dot(x + s.texel, y, pal.ramp[4], 0.6);
  }
}

/**
 * Where the lure's bulb hangs, how big it is, and how many bulb radii its light reaches —
 * shared with the bounds, which have to hold the halo and not just the bulb.
 */
export function lureAt(g: Genome, f: Form) {
  const ghost = hasSynergy(g, 'ghostlight');
  const r = R * (0.1 + g.lure * 0.04) * (ghost ? 1.3 : 1);
  return { ...lureBulb(g, f), r, ghost, top: lureArch(g, f),
           halo: ghost ? 3.4 : hasSynergy(g, 'toxiclure') ? 2.2 : 1 };
}

/**
 * The illicium: a spine off the forehead, arching up and forward over the jaw, with a lit
 * bulb on the end. With venom on the same body it is a Toxic Lure, and the bulb has to say
 * so from across the screen: it goes the venom sacs' green, with a ring of barbs round it
 * and the venom running up the stalk, so the two organs read as one system.
 */
export function lure(s: Sheet, f: Form, pal: Palette, g: Genome) {
  const toxicLure = hasSynergy(g, 'toxiclure');
  const { x: x1, y: y1, r, ghost, top } = lureAt(g, f);
  const x0 = spineAt(0.16, f), y0 = edgeAt(0.16, f, -1);
  const pts: Pt[] = [];
  // up off the brow, over, and down to the bulb: a rod that holds its arch and lets the
  // light hang off its end, a cubic through the arch's top
  const c1: Pt = [x0 + (x1 - x0) * 0.1, top], c2: Pt = [x1 + r * 0.5, top];
  for (let i = 0; i <= 24; i++) {
    const k = i / 24, u = 1 - k;
    pts.push([u * u * u * x0 + 3 * u * u * k * c1[0] + 3 * u * k * k * c2[0] + k * k * k * x1,
              u * u * u * y0 + 3 * u * u * k * c1[1] + 3 * u * k * k * c2[1] + k * k * k * (y1 - r)]);
  }
  s.line(pts);
  if (toxicLure) for (let i = 3; i < pts.length - 1; i += 2) s.dot(pts[i][0], pts[i][1], TOXIC, 0.9);
  const c = toxicLure ? TOXIC : pal.accent;
  if (toxicLure) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      s.line([[x1 + Math.cos(a) * r, y1 + Math.sin(a) * r], [x1 + Math.cos(a) * r * 1.9, y1 + Math.sin(a) * r * 1.9]], M.TOOTH);
    }
  }
  s.blot(x1, y1, r, c, 1);
  // a hot core when the bulb is big enough to have a middle: a flat disc of one colour
  // reads as a bead, not as a light
  if (r * s.res >= 2.5) s.blot(x1, y1, r * 0.5, lamp(c), 1);
  s.light(x1, y1, c, ghost ? 1.6 : 1.1, r * s.res >= 1.5);
}

/** Feelers off the chin — how an animal finds food in water with nothing to see by. */
export function barbels(s: Sheet, f: Form, pal: Palette, g: Genome) {
  const count = Math.round(1 + Math.min(1.5, g.barbels) * 1.5);
  const reach = R * (0.55 + Math.min(1.5, g.barbels) * 0.9);
  const x0 = spineAt(0.07, f), y0 = edgeAt(0.07, f, 1);
  for (let i = 0; i < count; i++) {
    const v = count === 1 ? 0 : i / (count - 1);
    const pts: Pt[] = [];
    for (let j = 0; j <= 12; j++) {
      const k = j / 12;
      // hangs from the chin and trails back under the body, the way a dragonfish's does
      pts.push([x0 - reach * k * (0.6 + v * 0.5), y0 + Math.sin(k * Math.PI * 0.9) * reach * 0.35 + k * reach * 0.2]);
    }
    s.line(pts);
    if (i === 0 && (g.glow > 0.3 || g.photophores > 0.3)) {
      const [ex, ey] = pts[pts.length - 1];
      s.light(ex, ey, pal.accent, 0.8);
    }
  }
}
