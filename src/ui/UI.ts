import type { Trait } from '../game/traits';
import { Hud } from './hud/Hud';
import { ScreenManager } from './screens/ScreenManager';
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
  readonly screens: ScreenManager;

  constructor(root: HTMLElement = document.getElementById('ui')!) {
    this.hud = new Hud();
    this.screens = new ScreenManager(root);
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
    this.screens.show(new TitleScreen(() => {
      this.screens.hide();
      this.hud.setChrome(true);
      onStart();
    }));
  }

  showMutation(heading: string, traits: Trait[], pick: (t: Trait) => void) {
    this.screens.show(new MutationScreen(heading, traits, t => {
      this.screens.hide();
      pick(t);
    }));
  }

  showDeath(cause: string, stats: string[], onRestart: () => void) {
    this.screens.show(new DeathScreen(cause, stats, () => {
      this.screens.hide();
      onRestart();
    }));
  }

  showWin(stats: string[], onRestart: () => void) {
    this.screens.show(new WinScreen(stats, () => {
      this.screens.hide();
      onRestart();
    }));
  }

  showBand(index: number, onContinue: () => void) {
    this.screens.show(new BandScreen(index, () => {
      this.screens.hide();
      onContinue();
    }));
  }

  showPause(info: PauseInfo) {
    this.screens.show(new PauseScreen(info));
  }

  hideOverlay() {
    this.screens.hide();
  }
}
