import type { Component } from '../Component';
import { actions, button, div, h1, h2, p } from '../dom/element';
import { lineageRow, type LineageFrame } from './lineage';

export class DeathScreen implements Component {
  readonly element = div('overlay');

  constructor(cause: string, stats: string[], onRestart: () => void, onCodex: () => void,
              onTitle: () => void,
              lineage: LineageFrame[] = []) {
    this.element.append(
      h2(cause),
      h1('Eaten'),
      ...(lineage.length > 1 ? [lineageRow(lineage)] : []),
      p(stats.join(' \u00a0·\u00a0 ')),
      actions(button('Spawn again', onRestart), button('Choose a body', onTitle, 'btn ghost'),
              button('Codex', onCodex, 'btn ghost')),
    );
  }

  mount(parent: HTMLElement) {
    parent.append(this.element);
  }

  destroy() {
    this.element.remove();
  }
}
