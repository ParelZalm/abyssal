import type { HudState } from '../types';
import { ActiveSlot } from './ActiveSlot';
import { DangerIndicator } from './DangerIndicator';
import { DiscoveryCard } from './DiscoveryCard';
import { Minimap } from './Minimap';
import { OfferCard } from './OfferCard';
import { StatColumn } from './StatColumn';
import { StatusPanel } from './StatusPanel';
import { RunStrip } from './RunStrip';
import { Toast } from './Toast';
import { TraitBar } from './TraitBar';

/** Composition root for in-play HUD chrome — not overlays. */
export class Hud {
  readonly element = document.createElement('div');

  private readonly status = new StatusPanel();
  private readonly traits = new TraitBar();
  private readonly run = new RunStrip();
  private readonly toast = new Toast();
  private readonly danger = new DangerIndicator();
  private readonly active = new ActiveSlot();
  private readonly discovery = new DiscoveryCard();
  private readonly minimap = new Minimap();
  private readonly stats = new StatColumn();
  private readonly offer = new OfferCard();

  constructor() {
    // wrapper stays layout-neutral; children keep their absolute positions under #ui
    this.element.style.display = 'contents';
    this.element.append(
      this.status.element,
      this.traits.element,
      this.run.element,
      this.toast.element,
      this.danger.element,
      this.active.element,
      this.discovery.element,
      this.minimap.element,
      this.stats.element,
      this.offer.element,
    );
    this.setChrome(false);
  }

  setChrome(on: boolean) {
    this.status.setVisible(on);
    this.traits.setVisible(on);
    this.run.setVisible(on);
    this.active.setVisible(on);
    this.minimap.setVisible(on);
    this.stats.setVisible(on);
    this.offer.setVisible(on);
  }

  update(s: HudState) {
    this.status.update(s);
    this.traits.update(s.traits);
    this.run.update(s);
    this.danger.update(s.danger);
    this.active.update(s.active);
    this.minimap.update(s.map, s.mapVersion);
    this.stats.update(s.stats);
    this.offer.update(s.offer);
  }

  showToast(text: string) {
    this.toast.show(text);
  }

  showDiscovery(name: string, desc: string, first: boolean) {
    this.discovery.show(name, desc, first);
  }
}
