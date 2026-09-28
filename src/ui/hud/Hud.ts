import type { HudState } from '../types';
import { ActiveSlot } from './ActiveSlot';
import { DangerIndicator } from './DangerIndicator';
import { DiscoveryCard } from './DiscoveryCard';
import { DepthBar } from './DepthBar';
import { GateLabel } from './GateLabel';
import { StatusPanel } from './StatusPanel';
import { RunStrip } from './RunStrip';
import { Toast } from './Toast';
import { TraitBar } from './TraitBar';

/** Composition root for in-play HUD chrome — not overlays. */
export class Hud {
  readonly element = document.createElement('div');

  private readonly status = new StatusPanel();
  private readonly traits = new TraitBar();
  private readonly depth = new DepthBar();
  private readonly gate = new GateLabel();
  private readonly run = new RunStrip();
  private readonly toast = new Toast();
  private readonly danger = new DangerIndicator();
  private readonly active = new ActiveSlot();
  private readonly discovery = new DiscoveryCard();

  constructor() {
    // wrapper stays layout-neutral; children keep their absolute positions under #ui
    this.element.style.display = 'contents';
    this.element.append(
      this.status.element,
      this.traits.element,
      this.run.element,
      this.depth.element,
      this.gate.element,
      this.toast.element,
      this.danger.element,
      this.active.element,
      this.discovery.element,
    );
    this.setChrome(false);
  }

  setChrome(on: boolean) {
    this.status.setVisible(on);
    this.traits.setVisible(on);
    this.run.setVisible(on);
    this.depth.setVisible(on);
    this.active.setVisible(on);
    if (!on) this.gate.hide();
  }

  update(s: HudState) {
    this.status.update(s);
    this.traits.update(s.traits);
    this.run.update(s);
    this.depth.update(s.depth, s.size);
    this.danger.update(s.danger);
    this.active.update(s.active);
  }

  gateLabel(text: string | null, screenY: number, screenH: number) {
    this.gate.update(text, screenY, screenH);
  }

  showToast(text: string) {
    this.toast.show(text);
  }

  showDiscovery(name: string, desc: string, first: boolean) {
    this.discovery.show(name, desc, first);
  }
}
