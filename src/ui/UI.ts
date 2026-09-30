import type { Codex } from '../run/codex';
import type { Transformation } from '../content/forms';
import { Hud } from './hud/Hud';
import type { Component } from './Component';
import { CodexScreen } from './screens/CodexScreen';
import { DeathScreen } from './screens/DeathScreen';
import { PauseScreen } from './screens/PauseScreen';
import { TitleScreen, type RunChoice } from './screens/TitleScreen';
import type { LineageFrame } from './screens/lineage';
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

  /** A title over the whole screen, or none. */
  caption(text: string | null) {
    this.hud.caption(text);
  }

  /** A line along the bottom; `boss` for a guardian's tell or set piece. */
  toast(text: string, tone: 'boss' | null = null) {
    this.hud.showToast(text, tone);
  }

  discovery(name: string, desc: string, first: boolean) {
    this.hud.showDiscovery(name, desc, first);
  }

  showTitle(onStart: (choice: RunChoice) => void, codex: Codex, dailyBest: (date: string) => number) {
    this.show(new TitleScreen(choice => {
      this.hide();
      this.hud.setChrome(true);
      onStart(choice);
    }, () => this.showCodex(codex, () => this.showTitle(onStart, codex, dailyBest)), codex,
    dailyBest));
  }

  showDeath(cause: string, stats: string[], codex: Codex, onRestart: () => void, onTitle: () => void,
            lineage: LineageFrame[] = []) {
    this.show(new DeathScreen(cause, stats, () => {
      this.hide();
      onRestart();
    }, () => this.showCodex(codex, () => this.showDeath(cause, stats, codex, onRestart, onTitle, lineage)),
    onTitle, lineage));
  }

  showWin(stats: string[], codex: Codex, onRestart: () => void, onTitle: () => void,
          lineage: LineageFrame[] = []) {
    this.show(new WinScreen(stats, () => {
      this.hide();
      onRestart();
    }, () => this.showCodex(codex, () => this.showWin(stats, codex, onRestart, onTitle, lineage)),
    onTitle, lineage));
  }

  /** The codex over whatever screen opened it; `onBack` puts that screen back. */
  showCodex(codex: Codex, onBack: () => void) {
    this.show(new CodexScreen(codex, onBack));
  }

  showTransform(to: Transformation, was: Transformation | null, nth: number,
                onContinue: () => void) {
    this.show(new TransformScreen(to, was, nth, () => {
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
