import { div, span } from '../dom/element';

/**
 * The entry requirement, written on the barrier itself. It rides the thermocline's
 * screen position and fades out as the seal leaves the frame.
 */
export class GateLabel {
  readonly element = div('gate');
  private readonly label = span();

  constructor() {
    this.element.append(this.label);
  }

  update(text: string | null, screenY: number, screenH: number) {
    const visible = text !== null && screenY > 40 && screenY < screenH - 40;
    this.element.classList.toggle('on', visible);
    if (!visible) return;
    if (this.label.textContent !== text) this.label.textContent = text;
    this.element.style.top = `${screenY}px`;
    // fade as it approaches either edge, so it never clips against the HUD
    const margin = Math.min(screenY - 40, screenH - 40 - screenY);
    this.element.style.opacity = String(Math.min(1, margin / 120));
  }

  hide() {
    this.element.classList.remove('on');
  }
}
