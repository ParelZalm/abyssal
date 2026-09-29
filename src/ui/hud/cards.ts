import { FAMILY_NAMES } from '../../content/forms';
import { ITEMS, type ItemId } from '../../content/items';
import { spriteCanvas } from '../../render/pickups';
import type { PickupKind } from '../../sim/world';
import { TANK_NAMES } from '../../content/tanks';
import type { Trait } from '../../content/traits';
import { div, h3, p, span } from '../dom/element';
import { createIcon } from '../icons';

/**
 * A mutation as a card: its mark and rarity, its name and what it does, the price of a
 * curse in its own red line, the families it is a step toward and the tank it belongs to,
 * and — when taking it would finish something — what, in a second light. Once the draft's;
 * now the pedestal's, read before the mutation is taken.
 */
export function mutationCard(t: Trait, opts: { note: string | null; isNew: boolean }) {
  const card = div(`card ${t.rarity}${opts.note ? ' completes' : ''}${t.curse ? ' cursed' : ''}`);

  const top = div('top');
  const mark = span();
  mark.className = 'mark';
  mark.append(createIcon(t.icon, 26));
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

  card.append(top, h3(t.name), p(t.desc));
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
