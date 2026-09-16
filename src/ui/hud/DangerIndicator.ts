import { div } from '../dom/element';

export class DangerIndicator {
  readonly element = div('danger');

  update(danger: number) {
    this.element.style.opacity = String(danger);
  }
}
