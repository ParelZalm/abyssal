import type { Component } from '../Component';
import { Button } from '../dom/Button';
import { div, h1, h2, p } from '../dom/element';

export class DeathScreen implements Component {
  readonly element = div('overlay');

  constructor(cause: string, stats: string[], onRestart: () => void) {
    this.element.append(
      h2(cause),
      h1('Eaten'),
      p(stats.join(' \u00a0·\u00a0 ')),
      new Button('Spawn again', onRestart).element,
    );
  }

  mount(parent: HTMLElement) {
    parent.append(this.element);
  }

  destroy() {
    this.element.remove();
  }
}
