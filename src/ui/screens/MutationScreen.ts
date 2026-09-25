import type { Trait } from '../../game/traits';
import type { Component } from '../Component';
import { div, h1, h2, h3, p, span } from '../dom/element';
import { createIcon } from '../icons';

export class MutationScreen implements Component {
  readonly element = div('overlay');

  constructor(heading: string, traits: Trait[], pick: (t: Trait) => void,
              isNew: (t: Trait) => boolean) {
    const cards = div('cards');
    for (const t of traits) {
      const card = document.createElement('button');
      card.className = `card ${t.rarity}`;

      const top = div('top');
      const mark = span();
      mark.className = 'mark';
      mark.append(createIcon(t.icon, 26));
      const rarity = span(t.rarity);
      rarity.className = 'r';
      // never taken in any run: the codex has a gap this card fills
      if (isNew(t)) {
        const tag = document.createElement('b');
        tag.textContent = 'new';
        rarity.prepend(tag);
      }
      top.append(mark, rarity);

      card.append(top, h3(t.name), p(t.desc));
      card.addEventListener('click', () => pick(t));
      cards.append(card);
    }

    this.element.append(h2(heading), h1('Mutate'), cards);
  }

  mount(parent: HTMLElement) {
    parent.append(this.element);
  }

  destroy() {
    this.element.remove();
  }
}
