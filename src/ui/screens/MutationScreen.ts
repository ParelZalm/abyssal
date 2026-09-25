import { FAMILY_NAMES } from '../../game/forms';
import type { Trait } from '../../game/traits';
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
      card.className = `card ${t.rarity}${note ? ' completes' : ''}`;

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
      top.append(mark, rarity);

      card.append(top, h3(t.name), p(t.desc));
      // the family is what a card is a step toward; without it a transformation is luck
      if (t.families?.length) {
        const fam = span(t.families.map(f => FAMILY_NAMES[f]).join(' · '));
        fam.className = 'fam';
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
