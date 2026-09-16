import { TIERS } from '../../game/tiers';
import { DEPTH_MAX } from '../../game/world';
import { div } from '../dom/element';

export class DepthBar {
  readonly element = div('depth');
  private readonly marker = document.createElement('i');
  private readonly seals: HTMLElement[] = [];

  constructor() {
    this.element.append(this.marker);
    for (let i = 0; i < TIERS.length; i++) {
      const t = TIERS[i];
      const label = document.createElement('u');
      label.textContent = t.name;
      label.style.top = `${(t.top / DEPTH_MAX) * 100}%`;
      this.element.append(label);
      if (i > 0) {
        const seal = document.createElement('s');
        seal.dataset.gate = String(i);
        seal.style.top = `${(t.top / DEPTH_MAX) * 100}%`;
        this.element.append(seal);
        this.seals.push(seal);
      }
    }
  }

  update(depth: number, size: number) {
    for (const seal of this.seals) {
      const t = TIERS[Number(seal.dataset.gate)];
      seal.classList.toggle('open', size >= t.gate);
    }
    this.marker.style.top = `${(depth / DEPTH_MAX) * 100}%`;
  }

  setVisible(on: boolean) {
    this.element.style.display = on ? '' : 'none';
  }
}
