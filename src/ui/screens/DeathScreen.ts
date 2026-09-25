import type { Component } from '../Component';
import { actions, button, div, h1, h2, p } from '../dom/element';

export class DeathScreen implements Component {
  readonly element = div('overlay');

  constructor(cause: string, stats: string[], onRestart: () => void, onCodex: () => void) {
    this.element.append(
      h2(cause),
      h1('Eaten'),
      p(stats.join(' \u00a0·\u00a0 ')),
      actions(button('Spawn again', onRestart), button('Codex', onCodex, 'btn ghost')),
    );
  }

  mount(parent: HTMLElement) {
    parent.append(this.element);
  }

  destroy() {
    this.element.remove();
  }
}
