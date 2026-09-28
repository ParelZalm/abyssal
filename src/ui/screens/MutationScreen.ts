import { FAMILY_NAMES } from '../../content/forms';
import type { Trait } from '../../content/traits';
import { BANDS } from '../../content/zones';
import type { Component } from '../Component';
import { actions, button, div, h1, h2, h3, p, span } from '../dom/element';
import { createIcon } from '../icons';

export interface DraftOptions {
  /** Never taken in any run: the codex has a gap this card fills. */
  isNew: (t: Trait) => boolean;
  /** What taking this card would complete, in words, or null. */
  note: (t: Trait) => string | null;
  /** A fresh hand for a price; `can` is false when the price cannot be paid. */
  reroll: { cost: number; can: boolean; pay: () => void };
}

export class MutationScreen implements Component {
  readonly element = div('overlay');

  constructor(heading: string, traits: Trait[], pick: (t: Trait) => void, opts: DraftOptions) {
    const cards = div('cards');
    for (const t of traits) {
      const note = opts.note(t);
      const card = document.createElement('button');
      card.className = `card ${t.rarity}${note ? ' completes' : ''}${t.curse ? ' cursed' : ''}`;

      const top = div('top');
      const mark = span();
      mark.className = 'mark';
      mark.append(createIcon(t.icon, 26));
      const rarity = span(t.rarity);
      rarity.className = 'r';
      if (opts.isNew(t)) {
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
      // the family is what a card is a step toward; without it a transformation is luck.
      // The band is where it lives, which is where to be when you level for it
      if (t.families?.length || t.band) {
        const fam = span(t.families?.map(f => FAMILY_NAMES[f]).join(' · ') ?? '');
        fam.className = 'fam';
        if (t.band) {
          const home = document.createElement('em');
          home.textContent = BANDS.find(b => b.id === t.band)!.name;
          fam.prepend(home, t.families?.length ? ' · ' : '');
        }
        card.append(fam);
      }
      if (note) {
        const n = span(note);
        n.className = 'note';
        card.append(n);
      }
      card.addEventListener('click', () => pick(t));
      cards.append(card);
    }

    const { cost, can, pay } = opts.reroll;
    const reroll = button(`Reroll — ${cost} fullness`, pay, 'btn ghost');
    reroll.disabled = !can;
    if (!can) reroll.title = 'Not enough fullness to spare';

    this.element.append(h2(heading), h1('Mutate'), cards, actions(reroll));
  }

  mount(parent: HTMLElement) {
    parent.append(this.element);
  }

  destroy() {
    this.element.remove();
  }
}
