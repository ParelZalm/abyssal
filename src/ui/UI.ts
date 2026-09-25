import type { Codex } from '../game/codex';
import type { Transformation } from '../game/forms';
import type { Trait } from '../game/traits';
import { Hud } from './hud/Hud';
import type { Component } from './Component';
import { CodexScreen } from './screens/CodexScreen';
import { DeathScreen } from './screens/DeathScreen';
import { MutationScreen, type DraftOptions } from './screens/MutationScreen';
import { PauseScreen } from './screens/PauseScreen';
import { BandScreen } from './screens/BandScreen';
import { TitleScreen } from './screens/TitleScreen';
import { TransformScreen } from './screens/TransformScreen';
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

  showTitle(onStart: () => void, codex: Codex) {
    this.show(new TitleScreen(() => {
      this.hide();
      this.hud.setChrome(true);
      onStart();
    }, () => this.showCodex(codex, () => this.showTitle(onStart, codex))));
  }

  showMutation(heading: string, traits: Trait[], pick: (t: Trait) => void, opts: DraftOptions) {
    this.show(new MutationScreen(heading, traits, t => {
      this.hide();
      pick(t);
    }, opts));
  }

  showDeath(cause: string, stats: string[], codex: Codex, onRestart: () => void) {
    this.show(new DeathScreen(cause, stats, () => {
      this.hide();
      onRestart();
    }, () => this.showCodex(codex, () => this.showDeath(cause, stats, codex, onRestart))));
  }

  showWin(stats: string[], codex: Codex, onRestart: () => void) {
    this.show(new WinScreen(stats, () => {
      this.hide();
      onRestart();
    }, () => this.showCodex(codex, () => this.showWin(stats, codex, onRestart))));
  }

  /** The codex over whatever screen opened it; `onBack` puts that screen back. */
  showCodex(codex: Codex, onBack: () => void) {
    this.show(new CodexScreen(codex, onBack));
  }

  showBand(index: number, onContinue: () => void) {
    this.show(new BandScreen(index, () => {
      this.hide();
      onContinue();
    }));
  }

  showTransform(to: Transformation, onContinue: () => void) {
    this.show(new TransformScreen(to, () => {
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
