import { div } from '../dom/element';

export class StatusBar {
  readonly element: HTMLDivElement;
  private readonly fill: HTMLElement;
  private readonly text: HTMLSpanElement | null;

  constructor(kind: 'hp' | 'food' | 'xp', label?: string) {
    this.element = div(`bar ${kind}`);
    this.fill = document.createElement('i');
    this.element.append(this.fill);

    const caption = document.createElement('span');
    if (kind === 'hp') {
      this.text = caption;
    } else {
      caption.textContent = label ?? '';
      this.text = null;
    }
    this.element.append(caption);
  }

  private lastPct = -1;
  private lastText = '';

  // Called every frame; only a changed value reaches the DOM, or each bar is a style
  // write and a layout invalidation per frame for nothing
  update(ratio: number, hpText?: string) {
    const pct = Math.round(clamp01(ratio) * 1000) / 10;
    if (pct !== this.lastPct) {
      this.lastPct = pct;
      this.fill.style.width = `${pct}%`;
    }
    if (this.text && hpText !== undefined && hpText !== this.lastText) {
      this.lastText = hpText;
      this.text.textContent = hpText;
    }
  }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
