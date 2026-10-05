import { FishView, type Pose } from '../render/creature/fishview';
import { armourOf, maxHp, type Genome } from '../content/genome';
import { hunts, type Species } from '../content/species';
import { drawnAngle } from '../content/form';
import { angleDelta, clamp, TAU } from '../core/util';
import { guardedOf, organsOf, swimOf, type Organ, type SwimMods } from './organs';

/** Forward drag coefficient: terminal speed works out to genome.speed × throttle. */
export const DRAG_FWD = 3.1;
/** Sideways drag — a body with a keel barely slides. */
const DRAG_LAT = 9;
/** The share of its health a transformed player keeps its own kind's tolerance above (`spares`). */
const KIN_SPARED = 0.5;
/**
 * The speed a body keeps through a flip (`drive`). The heading reverses in a frame but the
 * water does not, so most of the way on is lost at once and the rest drags it backward for
 * an instant: the check that makes a snapped turn read as effort rather than a cut.
 */
const FLIP_KEEP = 0.45;
/**
 * For everything but the player: seconds a heading has to stay across before the body flips
 * to it, and the least between two flips. A brain's heading is noisier than a hand — a flow
 * cell's step, a feeler swinging off the rock, the player passing overhead — and every one of
 * those that crossed vertical was a flip there and back in a few frames.
 */
const FLIP_COMMIT = 0.12;
const FLIP_REST = 0.45;
/**
 * Top speed backing away from what a strafing body faces (`strafe`). A fish does not swim
 * tail first; it sculls. Keeping an attack turned on something while retreating from it is
 * the kiting that makes a room a fight, and this is what it costs.
 */
const BACKPEDAL = 0.6;
/**
 * Seconds of invulnerability after a hit on the player, Isaac's grace: long enough that one
 * contact is one hit rather than a hit a frame, short enough that standing in a crowd still
 * costs. A shrug is the same grace, shorter, so armour is not also a shield.
 */
export const INVULN = 0.8;
const SHRUG_GRACE = 0.3;
/** Armour's chance of shrugging a hit off, per point, and the most it can ever be. */
const SHRUG_PER = 0.05;
const SHRUG_MAX = 0.4;
/**
 * How often venom or an open wound working in the player takes half a heart. Health is in
 * halves, so a wound cannot drain it smoothly the way it drains an animal's.
 */
const AIL_EVERY = 1.5;
/**
 * An animal's points of health to one of the player's half hearts, for the heals written in
 * points — lifesteal, Nematocyst. A hatchling had some thirty points before hearts, and has
 * six halves now; five would be exact, four leans toward the heal being felt.
 */
const HP_PER_HALF = 4;

export type Mood = 'cruise' | 'rest' | 'dart';
/**
 * How a body was last hurt, for the death screen: bitten, pricked by what it bit, poisoned,
 * hit by a shot, or stung by brushing against something.
 */
export type Hurt = 'bite' | 'sting' | 'poison' | 'shot' | 'touch';

/** Armour's chance of shrugging a hit off the player. */
export function shrugChance(g: Genome) {
  return Math.min(SHRUG_MAX, Math.max(0, armourOf(g)) * SHRUG_PER);
}

export class Creature {
  x = 0; y = 0; vx = 0; vy = 0; angle = 0;
  /**
   * Which way the animal faces, side-on: it mirrors when it turns back rather than rolling
   * onto its back. Part of the body's state rather than the view's, because the lure's
   * strike point is measured from it and has to agree with where the light is drawn.
   */
  face: 1 | -1 = 1;
  /**
   * A hunter's strike, as a small state machine (`Behaviour.strike`): a wind-up that slows
   * and coils with the jaw opening, the strike that throws the body at its prey, and a
   * recovery. `attackT` counts down the current step; `attackLen` is the step's length, so
   * the view can read how far through it the body is.
   */
  attack: 'none' | 'windup' | 'strike' | 'recover' = 'none';
  attackT = 0;
  attackLen = 1;
  /**
   * 1 as a stroke of the player's swim is thrown, down to 0 as the glide takes over
   * (`PlayerController`): the view snaps the tail and throws the body long on it. Zero for
   * everything else, which swims on a steady thrust.
   */
  burst = 0;
  /**
   * Whether this animal hunts the player on sight, whatever else is in the water — a room's
   * hostile rather than its fauna (`CONTEXT.md`). It takes the player as its quarry whenever
   * it is not tired.
   */
  hostile = false;
  /**
   * A hostile's role (`sim/roles.ts`): seconds until it may attack again, the heading a
   * charger's dash is locked to, the spot a turret holds, and how many rings it has fired —
   * each ring turns half a spoke from the last.
   */
  roleCd = 0;
  aimA = 0;
  /** How far down its locked line a boss's punch is thrown, world units: to where the player was. */
  aimD = 0;
  anchor: { x: number; y: number } | null = null;
  volley = 0;
  /**
   * A hostile's moveset (`Roles`): whether it has turned at half health, seconds left of the
   * stagger it turns in, and whether it is a brood — something a death left (a nettle's
   * ephyrae), which neither turns nor buds again. `salvo` is shots left in a burst and
   * `salvoT` seconds to the next, or to the next sting a bell leaves — or the seconds an eel
   * has waited in its hole with nothing on its line, or a triggerfish ready to blow has waited
   * to get behind the player; `guardCd` seconds before a pufferfish may puff again, an
   * archerfish looks for cover again, an eel gives up on the hole it is swimming for, or a
   * pack member may turn its way round the player again;
   * `surgeT` how far through its pulse a bell is; `orbit` which way round the player a pack
   * circles.
   */
  wounded = false;
  turnT = 0;
  brood = false;
  salvo = 0;
  salvoT = 0;
  guardCd = 0;
  surgeT = 0;
  orbit: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  /**
   * A ribbon eel's hole (`Roles.lurk`): its mouth on the rock face and the heading out of it,
   * and how far into it the body is — `back` backing in tail first, `home` in it with the head
   * out, `out` leaving it. Anything but '' is a body in the rock: the water does not move it
   * and the rock does not push it out, its brain puts it where it is.
   */
  den: { x: number; y: number; a: number } | null = null;
  burrow: '' | 'back' | 'home' | 'out' = '';
  /**
   * How far a moon jelly has faded from the room, 0 there and 1 gone (`Roles.wane`), and the
   * seconds into its cycle. Past `GHOST` it can neither be hit nor hurt.
   */
  wane = 0;
  waneT = Math.random() * 2;
  /**
   * A deep moveset's move in hand beyond its role's own, and the seconds left of it
   * (`Roles`): a gulper eel's jaw left hanging after a gulp that missed (`gape`), a vampire
   * squid turned inside out (`ball`), an anglerfish lunging off its spot (`lunge`).
   */
  trick: '' | 'gape' | 'ball' | 'lunge' = '';
  trickT = 0;
  /**
   * Where the last blow landed on this body, in the world: a siphonophore breaks where it is
   * cut (`Roles.split`). Null until something lands.
   */
  struck: { x: number; y: number } | null = null;
  /**
   * How far the Giant Squid is gone into its ink, 0 there and 1 gone (`Bosses.vanish`): like a
   * waned jelly past `GHOST` it can neither be hit nor hurt, but its light goes with it, or the
   * light would say which of its ghosts it is. And the ghosts it shows, the first of them the
   * squid, each at its spot with the heading it lunges along.
   */
  gone = 0;
  ghosts: { x: number; y: number; a: number }[] = [];
  /**
   * A boss's fight beyond its main move (`sim/bosses.ts`). `move` is the set piece in hand —
   * '' for the main one — and `rounds` how many of the main one since the last. `stuck` is
   * seconds held fast by the room, at `pinX`, `pinY`: a mantis shrimp wedged in a cleft, a
   * squid's arms round a pillar. `cave` is the middle of the cleft a mantis shrimp last
   * jammed itself in, which it will not punch down again until it has jammed in the other;
   * `spitCd` seconds to its next spit, the first a few seconds into the fight; `unseen`
   * how long the player has kept out of its reach; and `lull` seconds since it last began a
   * move of any kind.
   */
  move: '' | 'lob' | 'breach' | 'ink' | 'butt' | 'home' | 'spit' = '';
  rounds = 0;
  stuck = 0;
  pinX = 0;
  pinY = 0;
  cave = NaN;
  spitCd = 4;
  unseen = 0;
  lull = 0;
  /**
   * Seconds a flip holds before another may undo it, and when the last was (`Creature.clock`).
   * Zero for all but a boss: a larva darting back and forth over a mantis shrimp swung its
   * heading across on every pass, and it flipped there and back in a few frames, a spin.
   */
  flipHold = 0;
  flippedAt = -Infinity;
  /** Seconds a body that is not the player has wanted to turn back without turning (`drive`). */
  acrossT = 0;
  /**
   * The heading a brain steers by, eased toward what it asks for (`Roles.steer`), and when it
   * was last asked; and the side `clearHeading` last swung off the rock to, kept while the rock
   * is still ahead so a body along a wall does not try one side and then the other.
   */
  steer = 0;
  steeredAt = -Infinity;
  avoid: 1 | -1 | 0 = 0;
  /**
   * A boss's hull against the room (`World.integrate`, `collideHull`): whether it was on rock
   * last step, the way out of it, and seconds before another thud may be felt — a body
   * pressed along a wall meets it every frame, and only the arrival is a thud.
   */
  onRock = false;
  rockNx = 0;
  rockNy = 0;
  thud = 0;
  /**
   * How far the body stands straight up or down, 0 to 1, where its pitch is otherwise drawn
   * at a cap (`drawnAngle`): the player tucked in a cleft (`PlayerController.nook`). The
   * hitbox and the mouth stand with the drawing.
   */
  upright = 0;
  /** Seconds the player cannot be hit for; see `takeHit`. */
  invuln = 0;
  /** Whether the last blow on the player was shrugged off, for the view to say so. An event. */
  shrugged = false;
  /** Seconds of venom or bleeding the player has taken since its last half heart to them. */
  ailT = 0;
  /** Healing owed the player toward its next half heart; see `heal`. */
  mend = 0;
  /** Set on a body swallowed whole, to what swallowed it — the view follows it down. */
  eatenBy: Creature | null = null;
  hp: number; hpMax: number;
  alive = true;
  view: FishView;
  biteCd = 0;
  wander = Math.random() * TAU;
  panic = 0;
  thrust = 0;
  isPlayer = false;
  /** Swim phase, shared by the tail stroke and the thrust impulse it produces. */
  beat = Math.random() * TAU;
  /** Smoothed turn rate in -1..1, used to lean the body into a turn. */
  bank = 0;
  /** Ambushers hold still until this drops to zero. */
  lunge = 0;
  /**
   * What an unbothered animal is doing between threats and meals. A fish that only ever
   * cruises at one throttle reads as a sprite on a rail; resting, drifting and the odd
   * startled dart are most of what makes water look inhabited.
   */
  mood: Mood = 'cruise';
  moodT = Math.random() * 4;
  /** Seconds a hunter ignores prey after a kill — a fed predator lazes rather than sweeping the screen clean. */
  sated = 0;
  /** Seconds on the current chase; past its stamina the hunter gives up and has to recover in `tired`. */
  chase = 0;
  tired = 0;
  /** Fleeing zigzag: seconds until the next cut, and which way the last one went. */
  jinkT = 0;
  jinkSide = 1;
  /** Guardians only: whether this one has currently registered the player as worth eating. */
  aware = false;
  /**
   * How far into existence this body is, 0 to 1.
   *
   * Nothing in this ocean pops. A spawn is placed past the corner of the screen and
   * finishes its fade unseen; the ones that cannot be — the first fill of a run, and the
   * thin water directly above you in the shallows, where there is no off-screen to hide in
   * — resolve out of the murk instead. The player is born whole, which is why this starts
   * full and only `World.add` clears it.
   */
  fade = 1;
  /** Venom left in the wound: damage per second, and who is owed the kill. */
  poison = 0;
  poisonT = 0;
  poisonByPlayer = false;
  /** An open wound (Vivisect): damage per second, seconds left, who is owed the kill. */
  bleed = 0;
  bleedT = 0;
  bleedByPlayer = false;
  /** Seconds until the wound next drips blood into the water. */
  drip = 0;
  /** A scald (Vent Gland): damage per second, seconds left, who is owed the kill. */
  burn = 0;
  burnT = 0;
  burnByPlayer = false;
  /** Seconds of a chill (Brine Gland) left: the body swims through water gone thick. */
  chillT = 0;
  /** What this animal's tentacles are holding, and what is holding this one. */
  holding: Creature | null = null;
  heldBy: Creature | null = null;
  /** How close the held animal is to tearing free, 0 to 1. */
  strain = 0;
  /** Seconds the current catch has been held. */
  holdT = 0;
  /** Seconds before tentacles that lost their catch can strike again. */
  graspCd = 0;
  /**
   * Something this hunter has come for, whether or not it can see it — the arrival the
   * shallows clock sends. Cleared when the chase runs out of stamina or the quarry is gone.
   */
  quarry: Creature | null = null;
  /** The organs this body carries — see `organs.ts`. Refreshed whenever the genome is. */
  organs: Organ[];
  /** How this body moves, folded from its organs. Cached with them. */
  swim: SwimMods;
  /** Seconds until the mantle can pulse again. */
  pulseT = 0;
  /**
   * The depths this body keeps to instead of its species' range, or null. Set on a room's
   * animals (`Spawner.stock`) to the room's own water, since their species' range would
   * steer them into its ceiling or its floor.
   */
  hold: [number, number] | null = null;
  /** Seconds of stillness banked by a lurking body, spent on its next bite. */
  poise = 0;
  /**
   * Seconds left in the surge of a boost kick, 0 otherwise. The boost lives in `Game`, so
   * this is the seam that lets an organ tell a boost into a body from a swim into it.
   */
  boosting = 0;
  /** Bodies this boost has already struck, so one kick is one blow per body. */
  readonly boostHits = new Set<Creature>();
  /** Boost kicks so far, so an organ can answer each kick exactly once. */
  kicks = 0;
  /** The kick Flash Sense last fired on. */
  flashed = 0;
  /** The boost kick Smoke Screen last puffed ink on, the same way. */
  inked = 0;
  /** Seconds left dazzled: no steering, no bite. Flash Sense's, and held here for any other. */
  stun = 0;
  /** Seconds left inflated (the Inflation organ): too big to swallow, slow, prickly. */
  puffT = 0;
  /**
   * How far past its size the body is blown up: 1, except through a turret's tell, a puff and
   * a bounce. State of the animal rather than a different animal to bake, so the view scales
   * its strip by it (`syncView`), and the rock meets the body as big as it is drawn — kept on
   * the view alone, a pufferfish bouncing as a ball sank a tile into the floor.
   */
  swell = 1;
  /** Seconds a schooling body is scattered from its ball and can be picked off. */
  scatter = 0;
  /**
   * What last hurt this body and how, for the death screen: the species, how (`Hurt`), and
   * the run clock when it happened (`Creature.clock`).
   */
  hurtBy: Species | null = null;
  hurtHow: Hurt = 'bite';
  hurtAt = -1;
  /** The world's clock, shared so `hurt` can stamp without a reference to the world. */
  static clock = 0;
  /** A guardian's pattern: the tell's seconds left, the rush's, the opening's, the cooldown. */
  tellT = 0;
  rushT = 0;
  /** Seconds left of a `suck` pattern's draw, the jaw open and the water pouring in. */
  drawT = 0;
  exposed = 0;
  patternCd = 0;
  /** The rush's locked heading, and whether it has already found the player. */
  rushA = 0;
  landed = false;

  constructor(public species: Species, public genome: Genome) {
    this.hpMax = maxHp(genome);
    this.hp = this.hpMax;
    this.organs = organsOf(genome);
    this.swim = swimOf(genome, this.organs);
    this.view = new FishView(genome, species.plan, species);
  }

  /**
   * A hit on the player, in half hearts. Nothing lands during the grace of the last one, and
   * armour may shrug it off; otherwise it costs `halves`, starts the grace and flinches.
   * Returns what landed.
   */
  takeHit(by: Creature, halves: number, how: Hurt): number {
    if (this.invuln > 0) return 0;
    if (guardedOf(this) || Math.random() < shrugChance(this.genome)) {
      this.invuln = SHRUG_GRACE;
      this.shrugged = true;
      return 0;
    }
    this.hp -= halves;
    this.invuln = INVULN;
    this.hurt(by, how);
    this.view.hurt(this.x - by.x, this.y - by.y);
    return halves;
  }

  /**
   * Venom or a bleed working on the player: half a heart every `AIL_EVERY` seconds of it,
   * through no grace — a wound is not a blow, and dodging does not stop it.
   */
  ail(dt: number) {
    this.ailT += dt;
    if (this.ailT < AIL_EVERY) return;
    this.ailT -= AIL_EVERY;
    this.hp -= 1;
    this.view.hurt();
  }

  /**
   * Health back, in an animal's points. An animal takes it as it comes; the player's hearts
   * are in halves, so it is owed up to the next half and paid a half at a time — and a heal
   * on full health is not banked against the next wound.
   */
  heal(points: number) {
    if (!this.isPlayer) { this.hp = Math.min(this.hpMax, this.hp + points); return; }
    if (this.hp >= this.hpMax) { this.mend = 0; return; }
    this.mend += points / HP_PER_HALF;
    while (this.mend >= 1 && this.hp < this.hpMax) { this.mend -= 1; this.hp += 1; }
  }

  /** Book what just hurt this body. */
  hurt(by: Creature, how: Hurt) {
    this.hurtBy = by.species;
    this.hurtHow = how;
    this.hurtAt = Creature.clock;
  }

  /** A boost kick: open the surge window an organ can strike in. */
  kick(window: number) {
    this.boosting = window;
    this.boostHits.clear();
    this.kicks++;
  }

  /** Call after a genome change, beside `view.rebuild`: a new organ has to act as well as show. */
  refreshOrgans() {
    this.organs = organsOf(this.genome);
    this.swim = swimOf(this.genome, this.organs);
  }

  /** Where the mouth actually is — bites and gulps are measured from here. */
  get mouthX() { return this.x + Math.cos(this.angle) * this.radius * 0.8; }
  get mouthY() { return this.y + Math.sin(this.angle) * this.radius * 0.8; }

  /**
   * Where a strike leaves from: the mouth as it is drawn, at the capped pitch (`drawnAngle`)
   * rather than the heading. A body aimed straight down is drawn nose-down at the cap, and a
   * shot that left from where the heading put the mouth came out of its cheek.
   */
  get biteX() { return this.x + Math.cos(drawnAngle(this.angle, this.face, this.upright)) * this.face * this.radius * 0.8; }
  get biteY() { return this.y + Math.sin(drawnAngle(this.angle, this.face, this.upright)) * this.face * this.radius * 0.8; }

  /** Effective reach: a distensible gullet lets you swallow above your weight. */
  get swallowSize() {
    return this.genome.size * (1 + (this.genome.jaw - 0.3) * 0.35);
  }
  canEat(other: Creature) {
    return this.swallowSize > other.genome.size * 1.02;
  }

  /**
   * Whether this animal would actually eat that one: it has to hunt, it has to be big
   * enough, and it does not eat its own kind.
   *
   * `canEat` is only the size half, and both of the others were missing at the call sites.
   * A species is a size *range*, so the 7 cm end of a krill swarm could swallow the 4 cm
   * end — half of every school fled its own shoal and the rest was eaten from inside. And
   * `pair` let anything with a mouth strike, so a shoal of anchovy ate its way through
   * every krill swarm it crossed and the shallows had no food left in them by the time the
   * player arrived. Both rules live here rather than being remembered at four call sites.
   */
  preysOn(other: Creature) {
    return hunts(this.species) && this.species.id !== other.species.id && this.canEat(other) &&
      !this.spares(other);
  }

  /**
   * Whether this body's mouth goes for that one when they meet. For the animals it is
   * `preysOn`; the player strikes at anything its strike reaches, whatever the size, since
   * the kill that swallows is the bite that would have killed and not a question of gape.
   * Kept apart from `preysOn`, which is also what the ocean flees and fears by, and a larva
   * is not something a mackerel runs from.
   */
  attacks(other: Creature) {
    if (this.isPlayer) return other !== this;
    // a hostile is set on the player whatever the sizes, and on nothing else: a bite on a
    // passing fish ends a strike (`Combat.bite`), and a boss that ate its way out of its own
    // tell had no tell. The fauna still flee it, by `preysOn`. Everything else goes by its diet
    if (this.hostile) return other.isPlayer;
    return this.preysOn(other);
  }

  /**
   * Whether this animal takes that one for its own kind and leaves it be: a transformed
   * player, drawn on the plan of the animals it became, among those animals. Only while it
   * is whole — below half health it is a wounded one of their own, and they turn on it the
   * way sharks turn on a bleeding shark, which is the same line the Shark's frenzy bites at.
   * Guardians keep plans of their own, so none of them is ever fooled.
   */
  spares(other: Creature) {
    return other.isPlayer && other.species.plan === this.species.plan &&
      other.hp > other.hpMax * KIN_SPARED;
  }
  /** The size it is drawn at, and met at (`Species.drawn`); the genome's size is its stats'. */
  get drawnSize() {
    return this.genome.size * (this.species.drawn ?? 1);
  }
  get radius() {
    return this.drawnSize * 0.62;
  }
  syncView() {
    this.view.swell = this.swell;
    this.view.cloak = this.trick === 'ball';
    this.view.place(this.x, this.y, this.angle, this.face, this.upright);
  }

  /**
   * What the view should be doing this frame beyond swimming: a strike's wind-up and lunge,
   * a guardian's tell and rush, a boost, and whether the jaw is open. `hungry` is the
   * player's own anticipation — prey at its mouth — which only the world can see.
   */
  pose(hungry = false): Pose {
    const windup = this.attack === 'windup' ? 1 - this.attackT / this.attackLen
      : this.tellT > 0 || this.drawT > 0 ? 0.85 : 0;
    const strike = this.attack === 'strike' ? this.attackT / this.attackLen
      : this.rushT > 0 ? 0.6 : this.boosting > 0 ? this.boosting / 0.4 * 0.7 : 0;
    // the jaw opens partway into the wind-up, not on its first frame: the coil comes first
    const open = windup > 0.35 || this.attack === 'strike' || this.rushT > 0 || this.drawT > 0 ||
      this.trick === 'gape' || hungry;
    return { windup, strike, open, burst: this.burst };
  }

  /** The fade as an alpha, eased at both ends so an arrival has no edges. */
  get emergence() {
    return this.fade * this.fade * (3 - 2 * this.fade);
  }

  /** Turning authority right now: a body already moving fast cannot pivot as tightly. */
  private agility() {
    const g = this.genome;
    const speed = Math.hypot(this.vx, this.vy);
    const hold = this.swim.hold;
    return g.turn * (hold + (1 - hold) / (1 + speed / (Math.max(1, g.speed) * 0.8)));
  }

  /**
   * One swim step from raw controls: `turnInput` is a multiple of the available turning
   * rate, ±1 an ordinary turn and more only for a hard one (`drive`'s `flick`), and
   * `throttle` is the propelling force along the body axis, negative to back up, and `power`
   * scales only the push it makes — the player's strokes carry the rest of it. Thrust
   * surges on the tail beat, and lateral drag is far stronger than forward drag — that is
   * what makes a turn arc and a glide coast instead of the heading snapping the velocity.
   */
  propel(dt: number, turnInput: number, throttle: number, power = 1) {
    const g = this.genome;
    const top = Math.max(1, g.speed);
    const turn = turnInput * this.agility() * dt;
    this.angle += turn;
    this.bank += (clamp(dt > 0 ? turn / dt / Math.max(0.01, g.turn) : 0, -1, 1) - this.bank) *
      Math.min(1, dt * 7);

    const m = this.swim;
    const speed = Math.hypot(this.vx, this.vy);
    const fx = Math.cos(this.angle), fy = Math.sin(this.angle);
    if (m.pulseEvery > 0) {
      // one beat per pulse, and the kick lands on its crest, so the bell contracts as it
      // fires rather than at whatever phase the swim rate had wandered to
      this.beat += dt * TAU / m.pulseEvery;
      this.pulseT -= dt;
      if (throttle > 0.3 && this.pulseT <= 0) {
        this.pulseT = m.pulseEvery;
        const kick = top * m.pulseKick * Math.min(1, throttle);
        this.vx += fx * kick;
        this.vy += fy * kick;
        this.beat = Math.PI * 0.5;
      }
    } else {
      this.beat += dt * (3.4 + Math.abs(throttle) * 5.5 + (speed / top) * 3.5);
    }
    // a stroke pushes; backing up is a steady scull, not a beat
    const stroke = (throttle > 0 ? 0.62 + 0.62 * Math.max(0, Math.sin(this.beat)) : 1) * m.stroke;
    const accel = top * DRAG_FWD * throttle * stroke * power;
    this.vx += fx * accel * dt;
    this.vy += fy * accel * dt;
    const idle = Math.abs(throttle) < 0.1;
    if (idle && m.sink > 0) this.vy += m.sink * dt;
    this.vy += m.weight * dt;
    // Side-on, a body with nothing to do levels out: fish hang horizontal, nose neither up
    // nor down, and one left pitched at the angle of its last turn looks broken rather than
    // at rest. A bell is the exception — it hangs whichever way its pulse left it.
    if (Math.abs(throttle) < 0.2 && m.pulseEvery <= 0) {
      const level = Math.cos(this.angle) >= 0 ? 0 : Math.PI;
      this.angle += angleDelta(this.angle, level) * Math.min(1, dt * 1.4);
    }

    let fwd = this.vx * fx + this.vy * fy;
    let lat = -this.vx * fy + this.vy * fx;
    // flaring to stop bites much harder than coasting does
    const braking = (throttle < 0 && fwd > 0 ? DRAG_FWD * 2.4 : DRAG_FWD * m.drag) *
      (idle ? m.coast : 1);
    fwd *= Math.exp(-braking * dt);
    lat *= Math.exp(-DRAG_LAT * dt);
    this.vx = fx * fwd - fy * lat;
    this.vy = fy * fwd + fx * lat;
    this.thrust = Math.abs(throttle);
  }

  /**
   * Swimming while holding a facing: the body turns to `hold`, level on its facing unless
   * told otherwise, and moves toward (`dx`, `dy`) whichever way it points — the player's swim
   * while an attack is held, Isaac's walk-one-way-shoot-the-other. Given a `pivot` in radians
   * a second it turns at that constant rate rather than easing, so the time the player's aim
   * costs is the angle it is thrown through. Drag is the same in every
   * direction here, since a body swimming sideways to its keel is the whole point; backing
   * away from where it points is held to `BACKPEDAL` of top speed.
   */
  strafe(dt: number, dx: number, dy: number, throttle: number,
         hold = this.face > 0 ? 0 : Math.PI, pivot = 0, power = 1) {
    const g = this.genome;
    const top = Math.max(1, g.speed);
    const want = angleDelta(this.angle, hold);
    const turn = pivot > 0 ? clamp(want, -pivot * dt, pivot * dt) : want * Math.min(1, dt * 12);
    this.angle += turn;
    // the body curls into a pivot the way it curls into a turn, so a snapped aim reads as a
    // flex of the whole animal rather than a sprite rotated on its centre
    const curl = pivot > 0 && dt > 0 ? clamp(turn / dt / Math.max(0.01, g.turn), -1, 1) : 0;
    this.bank += (curl - this.bank) * Math.min(1, dt * 7);
    const n = Math.hypot(dx, dy);
    const speed = Math.hypot(this.vx, this.vy);
    this.beat += dt * (3.4 + throttle * 5.5 + (speed / top) * 3.5);
    if (n > 0) {
      const accel = top * DRAG_FWD * throttle * this.backing(dx / n, dy / n, hold) * this.swim.stroke * power;
      this.vx += (dx / n) * accel * dt;
      this.vy += (dy / n) * accel * dt;
    }
    const k = Math.exp(-DRAG_FWD * this.swim.drag * dt);
    this.vx *= k;
    this.vy *= k;
    this.thrust = n > 0 ? throttle : 0;
  }

  /** The share of a strafing push kept swimming (`ux`, `uy`) while pointed along `hold`. */
  backing(ux: number, uy: number, hold: number) {
    return 1 - (1 - BACKPEDAL) * Math.max(0, -(ux * Math.cos(hold) + uy * Math.sin(hold)));
  }

  /**
   * Steering for anything that thinks in headings rather than in keys. A heading across to
   * the other side is a flip; what is left is pitch, and `flick` is extra turning authority
   * for a heading far from the body's, tapered to `1 + flick` times the usual rate at the
   * widest — a dive thrown into a climb snaps like a C-start rather than swimming an arc.
   * Only the player asks for it, so the chases tuned against the ordinary rate keep it.
   */
  drive(dt: number, desired: number, throttle: number, flick = 0, power = 1) {
    // Turning back is a flip, in one step: the heading mirrored about vertical keeps its climb
    // or dive and swaps its side. Only on a heading clearly across — the same 0.2 band
    // `faceFor` holds a facing with — or a body swimming near vertical would flip on every
    // wobble. A bell has no side to turn to.
    const across = throttle > 0.1 && this.swim.pulseEvery <= 0 && Math.cos(desired) * this.face < -0.2;
    this.acrossT = across ? this.acrossT + dt : 0;
    if (across) {
      const hold = this.isPlayer ? this.flipHold : Math.max(this.flipHold, FLIP_REST);
      const meant = this.isPlayer || this.acrossT >= FLIP_COMMIT;
      if (meant && Creature.clock - this.flippedAt >= hold) {
        this.turnAbout();
        this.vx *= FLIP_KEEP;
        this.vy *= FLIP_KEEP;
        this.flippedAt = Creature.clock;
        this.acrossT = 0;
      } else {
        // held: the heading mirrored onto the side it faces, so it keeps the climb or dive
        // and does not turn the long way round through its back to get there
        desired = Math.PI - desired;
      }
    }
    const rate = this.agility() * dt;
    const want = angleDelta(this.angle, desired);
    // tapered over the whole turn, not cut at the perpendicular, or the flick runs out
    // halfway round and the back half of a hard turn crawls at the ordinary rate
    const reach = 1 + flick * (1 - Math.cos(want)) * 0.5;
    this.propel(dt, rate > 0 ? clamp(want / rate, -reach, reach) : 0, throttle, power);
  }

  /**
   * The flip, and only the flip: the heading mirrored about vertical with the facing, so the
   * body keeps its climb or dive. A brain that sets `face` alone leaves the heading on the old
   * side, and `World.integrate` reads the facing back off the heading and flips it home.
   */
  turnAbout() {
    this.angle = Math.PI - this.angle;
    this.face = this.face > 0 ? -1 : 1;
  }

  /**
   * Faced toward a point across, flipping only once it is `margin` past the body's middle: the
   * player passing overhead flipped a spitter there and back on every sway.
   */
  faceToward(x: number, margin: number) {
    if ((x - this.x) * this.face < -margin) this.turnAbout();
  }
}
