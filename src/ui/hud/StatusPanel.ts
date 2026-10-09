import { div, span } from '../dom/element';
import type { HudState } from '../types';
import { Counter, Hearts } from './Hearts';
import { StatusBar } from './StatusBar';

/**
 * Top left, Isaac's corner: where you are, the hearts, the belly, and what you carry.
 */
export class StatusPanel {
  readonly element = div('hud');
  private readonly stage = document.createElement('b');
  private readonly zone = span();
  private readonly size = document.createElement('b');
  private readonly hearts = new Hearts();
  private readonly belly = new StatusBar('food', 'Belly');
  private readonly shells = new Counter('shell');
  private readonly bombs = new Counter('bomb');
  private readonly keys = new Counter('key');

  constructor() {
    this.stage.textContent = '1';

    const row1 = div('stat-row');
    const stageWrap = span();
    stageWrap.append('Stage ', this.stage);
    this.zone.dataset.zone = '';
    row1.append(stageWrap, this.zone);

    const row3 = div('stat-row');
    const sizeWrap = span();
    sizeWrap.append('Length ', this.size);
    row3.append(sizeWrap);

    // shells, bomb fish and keys side by side under the belly, Isaac's pickups column in his order
    const pockets = div('stat-row counters');
    pockets.append(this.shells.element, this.bombs.element, this.keys.element);
    this.element.append(row1, this.hearts.element, this.belly.element, pockets, row3);
  }

  private last: Record<string, string> = {};
  /** Text writes are cached per field: the panel is updated every frame but changes rarely. */
  private set(key: string, el: HTMLElement, text: string) {
    if (this.last[key] === text) return;
    this.last[key] = text;
    el.textContent = text;
  }

  update(s: HudState) {
    this.hearts.update(s.hp, s.hpMax);
    this.belly.update(s.belly);
    this.shells.update(s.shells);
    this.bombs.update(s.bombs);
    this.keys.update(s.keys);
    this.set('stage', this.stage, String(s.stage));
    this.set('size', this.size, `${s.size.toFixed(0)} cm`);
    this.set('zone', this.zone, s.place);
  }

  setVisible(on: boolean) {
    this.element.style.display = on ? '' : 'none';
  }
}
