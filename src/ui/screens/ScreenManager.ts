import type { Component } from '../Component';

/** Owns the active full-screen overlay — at most one at a time. */
export class ScreenManager {
  private current: Component | null = null;

  constructor(private readonly root: HTMLElement) {}

  show(screen: Component) {
    this.hide();
    this.current = screen;
    screen.mount(this.root);
  }

  hide() {
    this.current?.destroy();
    this.current = null;
  }
}
