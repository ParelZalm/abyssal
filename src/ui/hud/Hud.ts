import type { HudState } from '../types';
import { DangerIndicator } from './DangerIndicator';
import { DepthBar } from './DepthBar';
import { GateLabel } from './GateLabel';
import { StatusPanel } from './StatusPanel';
import { Toast } from './Toast';
import { TraitBar } from './TraitBar';

/** Composition root for in-play HUD chrome — not overlays. */
export class Hud {
  readonly element = document.createElement('div');

  private readonly status = new StatusPanel();
  private readonly traits = new TraitBar();
  private readonly depth = new DepthBar();
  private readonly gate = new GateLabel();
  private readonly toast = new Toast();
  private readonly danger = new DangerIndicator();

  constructor() {
    // wrapper stays layout-neutral; children keep their absolute positions under #ui
    this.element.style.display = 'contents';
    this.element.append(
      this.status.element,
      this.traits.element,
      this.depth.element,
      this.gate.element,
      this.toast.element,
      this.danger.element,
    );
    this.setChrome(false);
  }

  setChrome(on: boolean) {
    this.status.setVisible(on);
    this.traits.setVisible(on);
    this.depth.setVisible(on);
    if (!on) this.gate.hide();
  }

  update(s: HudState) {
    this.status.update(s);
    this.traits.update(s.traits);
    this.depth.update(s.depth, s.size);
    this.danger.update(s.danger);
  }

  gateLabel(text: string | null, screenY: number, screenH: number) {
    this.gate.update(text, screenY, screenH);
  }

  showToast(text: string) {
    this.toast.show(text);
  }
}
