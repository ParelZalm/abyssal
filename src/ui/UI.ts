import type { Trait } from '../game/traits';
import { Hud } from './hud/Hud';
import type { Component } from './Component';
import { DeathScreen } from './screens/DeathScreen';
import { MutationScreen } from './screens/MutationScreen';
import { PauseScreen } from './screens/PauseScreen';
import { BandScreen } from './screens/BandScreen';
import { TitleScreen } from './screens/TitleScreen';
import { WinScreen } from './screens/WinScreen';
import type { HudState, PauseInfo } from './types';

export type { HudState, PauseInfo, TraitEntry } from './types';

/**
 * Game-facing DOM UI facade. Pixi owns the canvas; this owns HUD + overlays.
 * Call sites should not reach past these methods into component internals.
 */
export class UI {
  readonly hud: Hud;
  private current: Component | null = null;

  /** At most one full-screen overlay at a time. */
  constructor(private readonly root: HTMLElement = document.getElementById('ui')!) {
    this.hud = new Hud();
    root.append(this.hud.element);
  }

  update(s: HudState) {
    this.hud.update(s);
  }

  gateLabel(text: string | null, screenY: number, screenH: number) {
    this.hud.gateLabel(text, screenY, screenH);
  }

  toast(text: string) {
    this.hud.showToast(text);
  }

  showTitle(onStart: () => void) {
    this.show(new TitleScreen(() => {
      this.hide();
      this.hud.setChrome(true);
      onStart();
    }));
  }

  showMutation(heading: string, traits: Trait[], pick: (t: Trait) => void) {
    this.show(new MutationScreen(heading, traits, t => {
      this.hide();
      pick(t);
    }));
  }

  showDeath(cause: string, stats: string[], onRestart: () => void) {
    this.show(new DeathScreen(cause, stats, () => {
      this.hide();
      onRestart();
    }));
  }

  showWin(stats: string[], onRestart: () => void) {
    this.show(new WinScreen(stats, () => {
      this.hide();
      onRestart();
    }));
  }

  showBand(index: number, onContinue: () => void) {
    this.show(new BandScreen(index, () => {
      this.hide();
      onContinue();
    }));
  }

  showPause(info: PauseInfo) {
    this.show(new PauseScreen(info));
  }

  hideOverlay() {
    this.hide();
  }

  private show(screen: Component) {
    this.hide();
    this.current = screen;
    screen.mount(this.root);
  }

  private hide() {
    this.current?.destroy();
    this.current = null;
  }
}
