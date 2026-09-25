import type { Component } from '../Component';
import { button, div, h1, h2, p } from '../dom/element';

export class WinScreen implements Component {
  readonly element = div('overlay');

  constructor(stats: string[], onRestart: () => void) {
    this.element.append(
      h2('The Leviathan is dead'),
      h1('Apex'),
      p('Nothing in this ocean is larger than you now. The water goes very quiet.'),
      p(stats.join(' \u00a0·\u00a0 ')),
      button('Begin a new lineage', onRestart),
    );
  }

  mount(parent: HTMLElement) {
    parent.append(this.element);
  }

  destroy() {
    this.element.remove();
  }
}
