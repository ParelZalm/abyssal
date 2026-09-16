import { TIERS } from '../../game/tiers';
import type { Component } from '../Component';
import { Button } from '../dom/Button';
import { div, h1, h2, p } from '../dom/element';

export class TierScreen implements Component {
  readonly element = div('overlay');

  constructor(index: number, onContinue: () => void) {
    const t = TIERS[index];
    const range = p(`${t.top} m — ${t.bottom} m \u00a0·\u00a0 entry size ${t.gate} cm`);
    range.className = 'keys';

    this.element.append(
      h2(`Tier ${index + 1} — thermocline breached`),
      h1(t.name),
      p(t.tagline),
      range,
      new Button('Descend', onContinue).element,
    );
  }

  mount(parent: HTMLElement) {
    parent.append(this.element);
  }

  destroy() {
    this.element.remove();
  }
}
