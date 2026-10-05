import { FAMILY_NAMES } from '../../content/forms';
import type { StatRow } from '../../input/statdiff';
import { itemCanvas } from '../../render/itemart';
import { ITEMS, type ItemId } from '../../content/items';
import { spriteCanvas } from '../../render/pickups';
import type { PickupKind } from '../../sim/world';
import { TANK_NAMES } from '../../content/tanks';
import type { Trait } from '../../content/traits';
import { div, h3, p, span } from '../dom/element';
import { createIcon } from '../icons';

/**
 * A mutation as a card: its drawing and rarity, its name and Isaac's word for it, what taking
 * it does to every number it moves (`traitDiff`), what it does that no number says, the price
 * of a curse in its own red line, the families it is a step toward and the tank it belongs
 * to, and — when taking it would finish something — what, in a second light. Once the
 * draft's; now the pedestal's, read before the mutation is taken.
 */
export function mutationCard(t: Trait, opts: { note: string | null; isNew: boolean; rows?: readonly StatRow[] }) {
  const card = div(`card ${t.rarity}${opts.note ? ' completes' : ''}${t.curse ? ' cursed' : ''}`);

  const top = div('top');
  const mark = span();
  mark.className = 'mark art';
  const art = itemCanvas(t.id);
  mark.append(art ? scaled(art, 2) : createIcon(t.icon, 26));
  const rarity = span(t.rarity);
  rarity.className = 'r';
  if (opts.isNew) {
    const tag = document.createElement('b');
    tag.textContent = 'new';
    rarity.prepend(tag);
  }
  if (t.curse) {
    const tag = document.createElement('i');
    tag.textContent = 'cursed';
    rarity.prepend(tag);
  }
  top.append(mark, rarity);

  const tag = span(t.tagline);
  tag.className = 'tagline';
  card.append(top, h3(t.name), tag);
  if (opts.rows?.length) card.append(statRows(opts.rows));
  card.append(p(t.desc));
  // the price in its own line and colour: a curse read as part of the gift is a trap
  if (t.curse) {
    const c = p(t.curse);
    c.className = 'curse';
    card.append(c);
  }
  // the family is what a mutation is a step toward; without it a transformation is luck.
  // The tank is where it lives
  if (t.families?.length || t.tank) {
    const fam = span(t.families?.map(f => FAMILY_NAMES[f]).join(' · ') ?? '');
    fam.className = 'fam';
    if (t.tank) {
      const home = document.createElement('em');
      home.textContent = TANK_NAMES[t.tank];
      fam.prepend(home, t.families?.length ? ' · ' : '');
    }
    card.append(fam);
  }
  if (opts.note) {
    const n = span(opts.note);
    n.className = 'note';
    card.append(n);
  }
  return card;
}

/** A pixel canvas copied up `k` times, nearest-neighbour, so a card can hold it at its grain. */
function scaled(src: HTMLCanvasElement, k: number) {
  const c = document.createElement('canvas');
  c.width = src.width * k; c.height = src.height * k;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  x.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/**
 * The card's numbers: each of the attack's and the swim's that moves, as before → after with
 * its mark and an arrow lit for better or worse, and under them the body's other numbers as
 * shares on one line. A down arrow is not always worse — a belly that needs less is a gain —
 * so the colour is the verdict and the arrow the direction.
 */
function statRows(rows: readonly StatRow[]) {
  const box = div('stats');
  const minor: StatRow[] = [];
  for (const r of rows) {
    if (!r.main) { minor.push(r); continue; }
    const row = div(`row ${r.better ? 'up' : 'down'}`);
    const label = span(r.label);
    label.className = 'k';
    const v = span();
    v.className = 'v';
    const before = span(r.before);
    before.className = 'was';
    v.append(before, ' → ', r.after);
    const arrow = span(r.better ? '▲' : '▼');
    arrow.className = 'arrow';
    row.append(createIcon(r.icon, 12), label, v, arrow);
    box.append(row);
  }
  if (minor.length) {
    const line = div('minor');
    minor.forEach((r, i) => {
      const bit = span(`${r.label} ${r.before ? `${r.before} → ` : ''}${r.after}`);
      bit.className = r.better ? 'up' : 'down';
      line.append(...(i ? [' · ', bit] : [bit]));
    });
    box.append(line);
  }
  return box;
}

/** What the things a shop sells beside its items are, in the cards' words. */
const PICKUP_TEXT: Record<Exclude<PickupKind, ItemId>, { name: string; desc: string }> = {
  heart: { name: 'Half Heart', desc: 'Mends half a heart.' },
  shell: { name: 'Shell', desc: 'What a shop takes.' },
  key: { name: 'Key', desc: 'Opens a locked door, or a chest.' },
  chest: { name: 'Chest', desc: 'Takes a key; spills what is inside.' },
};

/**
 * Anything else a pedestal offers, as a card of the same frame: the sprite it lies as, its
 * name and what it does — an item says it is used on E.
 */
export function pickupCard(kind: PickupKind) {
  const card = div('card common');
  const top = div('top');
  const mark = span();
  mark.className = 'mark';
  mark.append(spriteCanvas(kind, 2));
  const item = kind in ITEMS ? ITEMS[kind as ItemId] : null;
  const r = span(item ? 'item' : 'pickup');
  r.className = 'r';
  top.append(mark, r);
  const text = item ?? PICKUP_TEXT[kind as Exclude<PickupKind, ItemId>];
  card.append(top, h3(text.name), p(text.desc));
  return card;
}
