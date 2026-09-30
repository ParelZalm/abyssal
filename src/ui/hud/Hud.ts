import { div } from '../dom/element';
import type { HudState } from '../types';
import { ActiveSlot } from './ActiveSlot';
import { DangerIndicator } from './DangerIndicator';
import { DiscoveryCard } from './DiscoveryCard';
import { Minimap } from './Minimap';
import { BossBar } from './BossBar';
import { ItemSlot } from './ItemSlot';
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
  private readonly item = new ItemSlot();
  private readonly boss = new BossBar();
  /** A title over the whole screen — the tank's name through the drop-in. Not chrome. */
  private readonly captionEl = document.createElement('div');

  constructor() {
    // wrapper stays layout-neutral; the stacks keep their absolute positions under #ui
    this.element.style.display = 'contents';
    // Each region is one stack, so what shares a corner pushes its neighbour along instead of
    // landing on it: pinned one by one, the mutations sat over the minimap, the toast over the
    // boss bar, the synergy card over the pedestal's. The transient pieces go on the end
    // nearest the middle of the screen, where their reserved space pushes nothing.
    const stack = (where: string, ...parts: HTMLElement[]) => {
      const s = div(`hud-stack ${where}`);
      s.append(...parts);
      return s;
    };
    this.element.append(
      this.danger.element,
      stack('top-left', this.status.element, this.stats.element),
      stack('top-centre', this.run.element, this.offer.element, this.discovery.element),
      stack('top-right', this.minimap.element, this.traits.element),
      stack('bottom-centre', this.toast.element, this.boss.element, this.active.element),
      this.item.element,
      this.captionEl,
    );
    this.captionEl.className = 'caption';
    this.captionEl.hidden = true;
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
    this.item.setVisible(on);
    this.boss.setVisible(on);
  }

  caption(text: string | null) {
    this.captionEl.hidden = !text;
    this.captionEl.textContent = text ?? '';
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
    this.item.update(s.item);
    this.boss.update(s.boss);
  }

  showToast(text: string, tone: 'boss' | null = null) {
    this.toast.show(text, tone);
  }

  showDiscovery(name: string, desc: string, first: boolean) {
    this.discovery.show(name, desc, first);
  }
}
