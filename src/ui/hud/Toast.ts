import { div } from '../dom/element';

export class Toast {
  readonly element = div('toast');
  private timer = 0;

  show(text: string) {
    this.element.textContent = text;
    this.element.classList.add('on');
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.element.classList.remove('on'), 1700);
  }
}
