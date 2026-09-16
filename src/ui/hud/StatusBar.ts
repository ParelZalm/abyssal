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

  update(ratio: number, hpText?: string) {
    this.fill.style.width = `${ratio * 100}%`;
    if (this.text && hpText !== undefined) this.text.textContent = hpText;
  }
}
