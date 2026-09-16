import { TIERS } from '../../game/tiers';
import { div, span } from '../dom/element';
import type { HudState } from '../types';
import { StatusBar } from './StatusBar';

export class StatusPanel {
  readonly element = div('hud');
  private readonly stage = document.createElement('b');
  private readonly zone = span();
  private readonly gate = span();
  private readonly size = document.createElement('b');
  private readonly depth = document.createElement('b');
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

    const row2 = div('stat-row');
    this.gate.dataset.gate = '';
    row2.append(this.gate);

    const row3 = div('stat-row');
    const sizeWrap = span();
    sizeWrap.append('Length ', this.size);
    const depthWrap = span();
    depthWrap.append('Depth ', this.depth);
    row3.append(sizeWrap, depthWrap);

    this.element.append(
      row1, row2,
      this.hp.element, this.food.element, this.xp.element,
      row3,
    );
  }

  update(s: HudState) {
    this.hp.update(s.hp / s.hpMax, `${Math.ceil(s.hp)} / ${s.hpMax}`);
    this.food.update(s.food / s.foodMax);
    this.xp.update(s.xp / s.xpNeed);
    this.stage.textContent = String(s.stage);
    this.size.textContent = `${s.size.toFixed(0)} cm`;
    this.depth.textContent = `${Math.round(s.depth)} m`;

    let zone = TIERS[0].name;
    for (const t of TIERS) if (s.depth >= t.top) zone = t.name;
    this.zone.textContent = zone;

    const next = TIERS.find((t, i) => i > 0 && s.size < t.gate);
    if (next) {
      const bold = document.createElement('b');
      bold.textContent = `${next.gate} cm`;
      this.gate.replaceChildren(
        'Thermocline sealed — grow to ', bold, ` for ${next.name}`,
      );
    } else {
      const bold = document.createElement('b');
      bold.textContent = 'Every thermocline is open.';
      this.gate.replaceChildren(bold);
    }
  }

  setVisible(on: boolean) {
    this.element.style.display = on ? '' : 'none';
  }
}
