import { div } from '../dom/element';

export class DangerIndicator {
  readonly element = div('danger');

  private last = '';

  update(danger: number) {
    const v = danger.toFixed(2);
    if (v !== this.last) { this.last = v; this.element.style.opacity = v; }
  }
}
