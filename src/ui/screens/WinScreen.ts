import type { Component } from '../Component';
import { Button } from '../dom/Button';
import { div, h1, h2, p } from '../dom/element';

export class WinScreen implements Component {
  readonly element = div('overlay');

  constructor(stats: string[], onRestart: () => void) {
    this.element.append(
      h2('The Leviathan is dead'),
      h1('Apex'),
      p('Nothing in this ocean is larger than you now. The water goes very quiet.'),
      p(stats.join(' \u00a0·\u00a0 ')),
      new Button('Begin a new lineage', onRestart).element,
    );
  }

  mount(parent: HTMLElement) {
    parent.append(this.element);
  }

  destroy() {
    this.element.remove();
  }
}
