import { baseGenome, mendPerRoom, type Genome } from '../content/genome';
import type { IconName } from '../content/icon';
import { TRAITS, type Trait } from '../content/traits';
import { HATCHED } from '../run/starts';
import { statsOf, type Stats } from './PlayerController';

/**
 * What a mutation would do to this body, stat by stat: the card's numbers. Taken on a copy of
 * the genome and read back through the same `statsOf` the stat column shows, so a card cannot
 * say a number the body will not have — and it is the body's own, not the card's: a multishot
 * on a body that bites is no shots at all, and its card says so by having no row.
 *
 * Isaac writes "Damage up" on the pedestal and lets the HUD's numbers move. Here the card is
 * read before the mutation is taken, so the numbers come first, as before and after, and the
 * card's tagline is the word.
 */
export interface StatRow {
  icon: IconName;
  label: string;
  /** Before and after, written as the stat column writes them; a share for the minor rows. */
  before: string;
  after: string;
  /** Whether the change is for the better. */
  better: boolean;
  /** One of the stat column's: the attack and the swim. The rest are the body's other numbers. */
  main: boolean;
}

/** A shot's kind in the cards' words, one and many. */
const SHOT_WORD: Record<string, [string, string]> = {
  spit: ['jet', 'jets'], spine: ['spine', 'spines'], fry: ['fry', 'fry'], bolt: ['bolt', 'bolts'],
};
const shotWords = (s: Stats) => {
  if (!s.shot) return 'bite';
  const [one, many] = SHOT_WORD[s.shot] ?? [s.shot, `${s.shot}s`];
  return `${s.shots} ${s.shots === 1 ? one : many}`;
};

/** Under this share a number has not moved: float noise, and turns too small to be felt. */
const MOVED = 0.005;

type Main = { key: Exclude<keyof Stats, 'shot'>; icon: IconName; label: string; fmt: (v: number) => string };
const MAIN: Main[] = [
  { key: 'damage', icon: 'teeth', label: 'Damage', fmt: v => v.toFixed(1) },
  { key: 'rate', icon: 'pulse', label: 'Tears', fmt: v => v.toFixed(2) },
  { key: 'range', icon: 'ring', label: 'Range', fmt: v => v.toFixed(1) },
  { key: 'shotSpeed', icon: 'bolt', label: 'Shot speed', fmt: v => v.toFixed(1) },
  { key: 'speed', icon: 'tail', label: 'Speed', fmt: v => v.toFixed(1) },
  { key: 'armour', icon: 'shield', label: 'Armour', fmt: v => `${Math.round(v * 100)}%` },
];

/**
 * The body's other numbers a card moves, as a share of what the body has: the ones with no
 * column of their own. `lower` is a number that is better small — the belly's need.
 */
const MINOR: { icon: IconName; label: string; of: (g: Genome) => number; lower?: boolean }[] = [
  { icon: 'mass', label: 'Size', of: g => g.size },
  { icon: 'fin', label: 'Aim', of: g => g.turn },
  { icon: 'eye', label: 'Sight', of: g => g.sense },
  { icon: 'gullet', label: 'Gulp', of: g => g.gulp },
  { icon: 'gill', label: 'Belly to fill', of: g => g.metabolism, lower: true },
];

const pct = (r: number) => `${r >= 1 ? '+' : '−'}${Math.round(Math.abs(r - 1) * 100)}%`;

/** Every number taking `t` would move on the body with genome `g`, the attack's first. */
export function traitDiff(g: Genome, t: Trait, tile: number): StatRow[] {
  const after = { ...g };
  t.apply(after);
  const a = statsOf(g, tile), b = statsOf(after, tile);
  const rows: StatRow[] = [];
  for (const m of MAIN) {
    const x = a[m.key], y = b[m.key];
    if (x === null || y === null) continue;
    if (Math.abs(y - x) <= Math.max(Math.abs(x), 0.01) * MOVED) continue;
    rows.push({ icon: m.icon, label: m.label, before: m.fmt(x), after: m.fmt(y), better: y > x, main: true });
  }
  // the shots: how many a strike throws and of what — a primary changed, or a multishot
  if (a.shots !== b.shots || a.shot !== b.shot) {
    rows.splice(1, 0, { icon: 'shots', label: 'Shots', before: shotWords(a), after: shotWords(b),
      better: b.shots >= a.shots, main: true });
  }
  if (mendPerRoom(after) !== mendPerRoom(g)) {
    rows.push({ icon: 'pulse', label: 'Mends a room', before: `${mendPerRoom(g) / 2}♥`,
      after: `${mendPerRoom(after) / 2}♥`, better: mendPerRoom(after) > mendPerRoom(g), main: false });
  }
  for (const m of MINOR) {
    const x = m.of(g), y = m.of(after);
    if (!x || Math.abs(y / x - 1) <= MOVED) continue;
    rows.push({ icon: m.icon, label: m.label, before: '', after: pct(y / x), better: m.lower ? y < x : y > x, main: false });
  }
  return rows;
}

/** A card's rows against a body as it hatches, spitting, for anywhere that has none to read: the board. */
export function traitDiffFromHatch(t: Trait, tile: number) {
  const g = baseGenome();
  for (const id of HATCHED) TRAITS.find(x => x.id === id)!.apply(g);
  return traitDiff(g, t, tile);
}
