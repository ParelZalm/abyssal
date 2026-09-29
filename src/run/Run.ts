import type { Plan } from '../content/form';
import type { Transformation } from '../content/forms';
import type { Genome } from '../content/genome';
import type { ItemId } from '../content/items';
import { TANKS, type Tank } from '../content/tanks';
import { TRAITS, type Trait } from '../content/traits';
import type { Creature } from '../sim/creature';
import type { RunChoice } from '../ui/screens/TitleScreen';
import { saveCodex, type Codex } from './codex';

export const COMBO_WINDOW = 3.5;
export const comboMult = (n: number) => Math.min(3, 1 + Math.max(0, n - 1) * 0.25);
/** Heart containers a run starts with, Isaac's three. */
export const START_CONTAINERS = 3;
/** Keys a run starts with: one, so the first shop is not a locked door. */
export const START_KEYS = 1;

export interface TakenName {
  name: string; desc: string; icon: Trait['icon']; rarity: Trait['rarity']; stacks: number;
}

/**
 * One run's record: what it has taken, eaten, scored and become. A new one is made on every
 * reset, so nothing here has to remember to clear itself. The systems that change these
 * numbers (`Evolution`, `Belly`) hold their own working state; this is only
 * what more than one of them, the HUD or the end screen needs to read.
 */
export class Run {
  stage = 1;
  /** Heart containers: health is twice this in halves. Deals are paid in them. */
  containers = START_CONTAINERS;
  /** What the belly holds toward its next pickup (`run/Belly.ts`). */
  belly = 0;
  shells = 0;
  /** Keys, spent one a lock (`run/Pockets.ts`), and the one item held, used on E. */
  keys = START_KEYS;
  item: ItemId | null = null;
  readonly taken = new Map<string, number>();
  readonly takenNames: TakenName[] = [];
  /** Named synergies discovered this run, in the order they first fired. */
  readonly synergies: string[] = [];
  /** Names this run added to the codex for the first time, for the end screen. */
  readonly found: string[] = [];
  /** The run's metamorphoses, first first; at most `MAX_FORMS`. See `content/forms.ts`. */
  readonly forms: Transformation[] = [];
  /** What the body is now: the last metamorphosis, or null before the first. */
  get form(): Transformation | null { return this.forms[this.forms.length - 1] ?? null; }
  eaten = 0;
  elapsed = 0;
  /** The tank the run is in. */
  tank: Tank = TANKS[0];
  score = 0;
  /** Kills landed inside the combo window, and the seconds left in it. */
  combo = 0;
  comboT = 0;
  /**
   * The body at each stage of the run — a genome copy and its plan, taken at hatching, on
   * every level-up and at a transformation — for the silhouettes on the end screen.
   */
  readonly lineage: { g: Genome; plan: Plan; stage: number; label?: string }[] = [];

  constructor(
    /** How this run was started: its body, its seed, and the date if it is the daily. */
    readonly choice: RunChoice,
    readonly seed: number,
    /** What every run has found, kept across runs. See `run/codex.ts`. */
    readonly codex: Codex,
  ) {}

  takenTraits() {
    return TRAITS.filter(t => this.taken.has(t.id));
  }

  /** A swallow: chained ones multiply the score, capped so a school is not a jackpot. */
  kill(gain: number) {
    this.eaten++;
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = COMBO_WINDOW;
    this.score += Math.round(gain * 10 * comboMult(this.combo));
  }

  tick(dt: number) {
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT <= 0) this.combo = 0;
  }

  /** A first for the codex: saved now, since a discovery is what a player would miss. */
  discover(name: string) {
    this.found.push(name);
    saveCodex(this.codex);
  }

  /** Snapshot the body for the lineage row. */
  remember(p: Creature, label?: string) {
    this.lineage.push({ g: { ...p.genome }, plan: p.species.plan, stage: this.stage, label });
  }
}
