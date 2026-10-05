import { wakeAudio } from '../audio/sound';

const ARROWS: Record<string, [number, number]> = {
  arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1],
};

/**
 * Keyboard state the frame reads, laid out Isaac's way: WASD swims, the arrows attack,
 * Space fires the active mutation, E takes what the player is beside and Q uses the held
 * item — Isaac's pocket key. Bound once for the page; the
 * run's `PlayerController` turns it into a swim and a strike.
 */
export class Input {
  readonly keys = new Set<string>();
  /**
   * Attack keys held, oldest first. The newest one is the direction: pressing a second
   * arrow while holding the first turns the attack, and letting it go turns it back —
   * Isaac's rule, and the only one that does not make two held arrows a diagonal.
   */
  private readonly aims: string[] = [];
  /** A press of the active mutation, waiting for the controller to read it. */
  wantActive = false;
  /** A press of the held item, the same way. */
  wantItem = false;
  /** A press of E: take the pedestal's good or the item the player is beside. */
  wantInteract = false;
  /** Any key or click at all, for skipping a cutscene. Cleared by whoever reads it. */
  anyPress = false;

  constructor(on: { pause(): void; mute(): void }) {
    addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'spacebar' || k in ARROWS) e.preventDefault();
      this.keys.add(k === 'spacebar' ? ' ' : k);
      if (k in ARROWS && !this.aims.includes(k)) this.aims.push(k);
      if ((k === 'p' || k === 'escape') && !e.repeat) on.pause();
      if ((k === ' ' || k === 'spacebar') && !e.repeat) this.wantActive = true;
      if (k === 'q' && !e.repeat) this.wantItem = true;
      if (k === 'e' && !e.repeat) this.wantInteract = true;
      if (k === 'm' && !e.repeat) on.mute();
      if (!e.repeat) this.anyPress = true;
      wakeAudio();
    });
    addEventListener('keyup', e => {
      const k = e.key.toLowerCase();
      this.keys.delete(k === 'spacebar' ? ' ' : k);
      const i = this.aims.indexOf(k);
      if (i >= 0) this.aims.splice(i, 1);
    });
    // any press may be the gesture a browser wants before it will play a sound
    addEventListener('pointerdown', () => { this.anyPress = true; wakeAudio(); });
    addEventListener('blur', () => { this.keys.clear(); this.aims.length = 0; });
  }

  /** The swim direction on WASD, each axis -1, 0 or 1. */
  get move(): [number, number] {
    const k = this.keys;
    return [(k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0), (k.has('s') ? 1 : 0) - (k.has('w') ? 1 : 0)];
  }

  /** The attack direction on the arrows, one of the four, or null when none is held. */
  get aim(): [number, number] | null {
    const k = this.aims[this.aims.length - 1];
    return k ? ARROWS[k] : null;
  }
}
