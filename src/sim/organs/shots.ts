import { biteDamage } from '../../content/genome';
import { dist2, TAU } from '../../core/util';
import type { Creature } from '../creature';
import { surfaceGap } from '../hull';
import type { World } from '../world';
import { chill, CHILL_TIME, ignite } from './effects';
import { O, type Organ } from './types';

/**
 * Cavitation: the burst's reach in tiles, a stack wider, and what it lands as a share of the
 * shot. Under a whole shot, since the body the shot struck is inside it too and takes both —
 * at a whole one, a direct hit was two shots and the card was every other card at once.
 */
const BLAST_R = 1.2;
const BLAST_R_STACK = 0.4;
const BLAST_MULT = 0.6;
/** How hard the burst throws what it catches, as a share of the body's own top speed. */
const BLAST_SHOVE = 1.4;

/**
 * Vent Gland: a burn's damage a second as a share of the shot that lit it. Three seconds of
 * it is most of a second shot, which is what a fire card has to be worth to a spitter; the
 * room's next hostile catching it from the dead is the rest.
 */
const SCALD = 0.3;

/**
 * Surface Halo: the chance a landed shot calls the shaft down, one in four and then two in
 * five; what it lands on everything in the shaft; its half width in tiles; the stun.
 */
const HALO_CHANCE = 0.25;
const HALO_STACK = 0.15;
const SHAFT_MULT = 1.5;
const SHAFT_HALF = 0.55;
const SHAFT_STUN = 0.35;

/**
 * Galvanic Cells: how far an arc jumps, in tiles, centre to centre — far enough to find the
 * next hostile of a pack, not across the room — and what it lands, and its twitch.
 */
const ARC_REACH = 3.2;
const ARC_MULT = 0.5;
const ARC_STUN = 0.2;

/** Hunting Nares: how fast a shot bends, in radians a second, and a stack more. */
const SEEK_TURN = 2.6;
const SEEK_STACK = 1.6;

/**
 * Brood Pouch: the fry a landed shot breaks into, fanned either side of its line, each a
 * share of the shot, out for a few tiles — enough to find what stood behind the first body.
 */
const BROOD_FAN = [-0.45, 0, 0.45];
/** A second stack is another fry either side, the fan no wider. */
const BROOD_FAN_STACK = [-0.45, -0.22, 0, 0.22, 0.45];
const BROOD_MULT = 0.35;
const BROOD_RANGE = 3.5;

/**
 * Brine Gland: a stack holds the chill half again as long; a kill shatters into shards round
 * a whole turn, each a share of the shot, out for a little way.
 */
const FROST_STACK = 0.5;
const SHARDS = 4;
const SHARD_MULT = 0.4;
const SHARD_RANGE = 2.5;

/** The room's tile, in world units: every reach here is in tiles. */
const tileOf = (w: World) => w.terrain?.tile ?? 0;

/** The hostile nearest `from` within `reach`, that `skip` does not already hold. */
function nearest(w: World, from: Creature, reach: number, skip: readonly Creature[]) {
  let best: Creature | null = null, bd = reach * reach;
  for (const c of w.creatures) {
    if (!w.canHit(c) || skip.includes(c)) continue;
    const d = dist2(from.x, from.y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

/**
 * Where a shaft of light comes down through the room at `x`: from the rock above (`top`) to
 * the rock below, walked in half tiles from `y`, out to the room's edges.
 */
function shaftAt(w: World, x: number, y: number) {
  const t = w.terrain!;
  const step = t.tile * 0.5, lo = t.y0, hi = t.y0 + t.rows * t.tile;
  let top = y, bot = y;
  while (top - step > lo && !t.solidAt(x, top - step)) top -= step;
  while (bot + step < hi && !t.solidAt(x, bot + step)) bot += step;
  return { top, bot };
}

/**
 * The shot organs: what the shots carry, on whatever primary fires them. Every other primary
 * organ is one slot; these stack on it and on each other, as Isaac's tear effects do, so a
 * spit that bursts and burns and arcs is a build and not a lucky card. Each answers when a
 * shot lands (`onShotHit`) or is spent (`onShotSpent`), and marks the shot so it is seen to.
 */
export const SHOT_ORGANS: Organ[] = [
  O({ id: 'pierce', when: g => g.pierce > 0,
    shot: (_g, m) => { m.pierce = true; m.marks.push('pierce'); } }),

  O({ id: 'seek', when: g => g.seek > 0,
    shot: (g, m) => { m.seek = SEEK_TURN + SEEK_STACK * (g.seek - 1); m.marks.push('seek'); } }),

  O({ id: 'scald', when: g => g.scald > 0,
    shot: (_g, m) => { m.marks.push('scald'); },
    onShotHit: (att, def, _w, s) => {
      if (!def.alive) return;
      ignite(def, att, biteDamage(att.genome) * s.mult * SCALD * att.genome.scald);
    } }),

  O({ id: 'frost', when: g => g.frost > 0,
    shot: (_g, m) => { m.marks.push('frost'); },
    onShotHit: (att, def, w, s) => {
      if (def.alive) { chill(def, CHILL_TIME * (1 + FROST_STACK * (att.genome.frost - 1))); return; }
      // a kill freezes through and shatters, and the shards fly on round it
      if (s.spawned) return;
      const a0 = Math.atan2(s.vy, s.vx) + Math.PI / SHARDS;
      for (let i = 0; i < SHARDS; i++) {
        w.split(s, def.x, def.y, a0 + (i / SHARDS) * TAU, s.mult * SHARD_MULT, SHARD_RANGE, s.hit ?? [def]);
      }
      w.pulses.push({ x: def.x, y: def.y, r: def.radius, kind: 'shatter' });
    } }),

  O({ id: 'arc', when: g => g.arc > 0,
    shot: (_g, m) => { m.marks.push('arc'); },
    onShotHit: (att, def, w, s) => {
      const zapped: Creature[] = [def];
      let from = def;
      for (let j = 0; j < 1 + att.genome.arc; j++) {
        const to = nearest(w, from, ARC_REACH * tileOf(w), zapped);
        if (!to) break;
        w.pulses.push({ x: from.x, y: from.y, r: s.r, kind: 'arc', vx: to.x - from.x, vy: to.y - from.y });
        w.hit(att, to, s.mult * ARC_MULT, true);
        to.stun = Math.max(to.stun, ARC_STUN);
        zapped.push(to);
        from = to;
      }
    } }),

  O({ id: 'halo', when: g => g.halo > 0,
    shot: (_g, m) => { m.marks.push('halo'); },
    onShotHit: (att, def, w, s) => {
      if (w.rng.next() >= HALO_CHANCE + HALO_STACK * (att.genome.halo - 1)) return;
      // light from water the larva has never seen, straight down through the room onto it:
      // everything standing in the column is struck, the body the shot found among them
      const x = def.x;
      const { top, bot } = shaftAt(w, x, def.y);
      const half = SHAFT_HALF * tileOf(w);
      for (const c of w.creatures) {
        if (!w.canHit(c) || c.y < top - c.radius || c.y > bot + c.radius) continue;
        if (Math.abs(c.x - x) > half + c.radius * 0.5) continue;
        w.hit(att, c, s.mult * SHAFT_MULT, true);
        c.stun = Math.max(c.stun, SHAFT_STUN);
      }
      w.pulses.push({ x, y: top, r: half, len: bot - top, kind: 'shaft' });
    } }),

  O({ id: 'brood', when: g => g.brood > 0,
    shot: (_g, m) => { m.marks.push('brood'); },
    onShotHit: (att, def, w, s) => {
      if (s.spawned) return;
      const a = Math.atan2(s.vy, s.vx);
      const fan = att.genome.brood >= 2 ? BROOD_FAN_STACK : BROOD_FAN;
      for (const off of fan) w.split(s, def.x, def.y, a + off, s.mult * BROOD_MULT, BROOD_RANGE, s.hit ?? [def]);
    } }),

  O({ id: 'blast', when: g => g.blast > 0,
    shot: (_g, m) => { m.marks.push('blast'); },
    onShotSpent: (att, w, s) => {
      const r = (BLAST_R + BLAST_R_STACK * (att.genome.blast - 1)) * tileOf(w) * (s.spawned ? 0.6 : 1);
      if (r <= 0) return;
      for (const c of w.creatures) {
        if (!w.canHit(c) || surfaceGap(c, s.x, s.y) > r) continue;
        const d = Math.sqrt(dist2(s.x, s.y, c.x, c.y));
        const a = d > 1 ? Math.atan2(c.y - s.y, c.x - s.x) : Math.atan2(s.vy, s.vx);
        const k = 1 - Math.min(1, d / (r + c.radius));
        const shove = Math.max(1, c.genome.speed) * BLAST_SHOVE * k;
        w.hit(att, c, s.mult * BLAST_MULT, true);
        c.vx += Math.cos(a) * shove;
        c.vy += Math.sin(a) * shove;
      }
      w.smashAt(s.x, s.y, r);
      w.pulses.push({ x: s.x, y: s.y, r, kind: 'cavitate' });
    } }),
];

/**
 * A body that died burning sets light to what was close: everything the player's shots can
 * land on within `KINDLE_R` tiles of it catches at the dead body's own burn, unless it is
 * already alight. Already alight is what keeps one kill from relighting a room forever.
 */
const KINDLE_R = 1.6;
export function kindle(w: World, from: Creature) {
  if (from.burnT <= 0 || !from.burnByPlayer) return;
  const r = KINDLE_R * tileOf(w);
  let caught = false;
  for (const c of w.creatures) {
    if (c === from || c.burnT > 0 || !w.canHit(c) || surfaceGap(c, from.x, from.y) > r) continue;
    ignite(c, w.player, from.burn);
    w.pulses.push({ x: c.x, y: c.y, r: c.radius, kind: 'flame' });
    caught = true;
  }
  if (caught) w.pulses.push({ x: from.x, y: from.y, r, kind: 'flame' });
}
