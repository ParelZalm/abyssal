import { BANDS } from '../../game/zones';
import { DEPTH_MAX } from '../../game/world';
import { div } from '../dom/element';

export class DepthBar {
  readonly element = div('depth');
  private readonly marker = document.createElement('i');
  private readonly seals: HTMLElement[] = [];

  constructor() {
    this.element.append(this.marker);
    for (let i = 0; i < BANDS.length; i++) {
      const t = BANDS[i];
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

  private lastTop = '';
  private lastOpen = -1;

  update(depth: number, size: number) {
    const open = BANDS.filter(b => size >= b.gate).length;
    if (open !== this.lastOpen) {
      this.lastOpen = open;
      for (const seal of this.seals) {
        const t = BANDS[Number(seal.dataset.gate)];
        seal.classList.toggle('open', size >= t.gate);
      }
    }
    const top = `${((depth / DEPTH_MAX) * 100).toFixed(1)}%`;
    if (top !== this.lastTop) { this.lastTop = top; this.marker.style.top = top; }
  }

  setVisible(on: boolean) {
    this.element.style.display = on ? '' : 'none';
  }
}
