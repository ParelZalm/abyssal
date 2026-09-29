import { div, span } from '../dom/element';
import type { HudState } from '../types';
import { StatusBar } from './StatusBar';

export class StatusPanel {
  readonly element = div('hud');
  private readonly stage = document.createElement('b');
  private readonly zone = span();
  private readonly size = document.createElement('b');
  private readonly hp = new StatusBar('hp');
  private readonly food = new StatusBar('food', 'Fullness');
  private readonly xp = new StatusBar('xp', 'Biomass');

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

    this.element.append(
      row1,
      this.hp.element, this.food.element, this.xp.element,
      row3,
    );
  }

  private last: Record<string, string> = {};
  /** Text writes are cached per field: the panel is updated every frame but changes rarely. */
  private set(key: string, el: HTMLElement, text: string) {
    if (this.last[key] === text) return;
    this.last[key] = text;
    el.textContent = text;
  }

  update(s: HudState) {
    this.hp.update(s.hp / s.hpMax, `${Math.ceil(s.hp)} / ${s.hpMax}`);
    this.food.update(s.food / s.foodMax);
    this.food.setLow(s.food < s.foodMax * 0.25);
    this.xp.update(s.xp / s.xpNeed);
    this.set('stage', this.stage, String(s.stage));
    this.set('size', this.size, `${s.size.toFixed(0)} cm`);
    this.set('zone', this.zone, s.place);
  }

  setVisible(on: boolean) {
    this.element.style.display = on ? '' : 'none';
  }
}
