import type { Trait } from '../../game/traits';
import type { Component } from '../Component';
import { div, h1, h2, h3, p, span } from '../dom/element';
import { createIcon } from '../icons';

export class MutationScreen implements Component {
  readonly element = div('overlay');

  constructor(heading: string, traits: Trait[], pick: (t: Trait) => void) {
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
