import { wakeAudio } from '../audio/sound';

/**
 * Keyboard and pointer, as state the frame reads. Bound once for the page; the run's
 * `PlayerController` turns it into a swim.
 */
export class Input {
  readonly keys = new Set<string>();
  readonly mouse = { x: 0, y: 0, down: false };
  /** Cursor steering until a movement key is pressed, and back on the next pointer move. */
  useMouse = true;
  /** A press of the active organ, waiting for the controller to read it. */
  wantActive = false;

  constructor(canvas: HTMLCanvasElement, on: { pause(): void; mute(): void }) {
    addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'spacebar') e.preventDefault();
      this.keys.add(k === 'spacebar' ? ' ' : k);
      if ('wasd'.includes(k) || k.startsWith('arrow')) this.useMouse = false;
      if (k === 'p') on.pause();
      if (k === 'e' && !e.repeat) this.wantActive = true;
      if (k === 'm' && !e.repeat) on.mute();
      wakeAudio();
    });
    addEventListener('keyup', e => {
      const k = e.key.toLowerCase();
      this.keys.delete(k === 'spacebar' ? ' ' : k);
    });
    addEventListener('pointermove', e => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.useMouse = true;
    });
    addEventListener('pointerdown', e => {
      // any press may be the gesture a browser wants before it will play a sound
      wakeAudio();
      if (e.target !== canvas) return;
      // the right button fires the active organ; the left is the boost
      if (e.button === 2) this.wantActive = true;
      else this.mouse.down = true;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('pointerup', () => { this.mouse.down = false; });
    addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });
  }
}
