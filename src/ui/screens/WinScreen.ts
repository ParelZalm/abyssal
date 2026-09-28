import type { Component } from '../Component';
import { actions, button, div, h1, h2, p } from '../dom/element';
import { lineageRow, type LineageFrame } from './lineage';

export class WinScreen implements Component {
  readonly element = div('overlay');

  constructor(stats: string[], onRestart: () => void, onCodex: () => void, onTitle: () => void,
              lineage: LineageFrame[] = []) {
    this.element.append(
      h2('The Leviathan is dead'),
      h1('Apex'),
      ...(lineage.length > 1 ? [lineageRow(lineage)] : []),
      p('Nothing in this ocean is larger than you now. The water goes very quiet.'),
      p(stats.join(' \u00a0·\u00a0 ')),
      actions(button('Begin a new lineage', onRestart), button('Choose a body', onTitle, 'btn ghost'),
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
