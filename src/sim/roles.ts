import { formFor, spineAt } from '../content/form';
import type { Genome } from '../content/genome';
import { speciesById, type Moveset, type Role } from '../content/species';
import { angleDelta, clamp, dist2, TAU } from '../core/util';
import { Creature, DRAG_FWD } from './creature';
import { Flow } from './flow';
import { depthOf, noseOf, noseReach, spriteAt, spriteColumn, tailReach, wallR } from './hull';
import { chainPiece, SPRITES, spriteScale } from '../content/sprites';
import { stealthOf } from './organs';
import type { Terrain } from './terrain';
import type { World } from './world';

// Every distance a role keeps is in tiles, and every speed in tiles a second: a tank is
// authored at its animal's scale, so a role reads the same in the nursery as in the deep.

/**
 * The charger. It closes at a little over half its speed — slower than the player, so it can
 * be outswum and has to be dodged rather than fled — and inside `DASH_RANGE` with a clear
 * line it stops, turns square on and winds up, then goes along that line at `DASH` times its
 * speed and cannot steer. The wind-up is the tell, and a bar over it fills through it
 * (`render/tells.ts`); a miss leaves it recovering, side-on and slow, which is the opening.
 *
 * The wind-up ends in `CHARGE_LOCK` with the line fixed and the bar flashing full. It used to
 * track the player to the instant it went, which at the game's tempo made a dash from two
 * tiles off a hit nothing could answer: whatever the player did in the wind-up, the line
 * followed. Locked, a sidestep once the bar is full is always a dodge.
 *
 * `DASH_RANGE` is every charger's but one with a `reach` of its own: the barracuda goes from
 * across the room, which its speed carries it over, and its wind-up is the same tell.
 */
const CHARGE_CLOSE = 0.55;
const DASH_RANGE = 6;
export const CHARGE_WIND = (size: number) => clamp(0.5 + size / 250, 0.5, 0.9);
export const CHARGE_LOCK = 0.3;
export const DASH = 2.1;
export const DASH_TIME = 0.4;
export const CHARGE_RECOVER = 0.7;
const CHARGE_CD: [number, number] = [0.7, 1.3];

/**
 * The spitter. It keeps the player between `NEAR` and `FAR` tiles off — backing off when
 * crowded, closing when out of range or out of sight — and fires when it has a line: a
 * still, open-jawed `SPIT_WIND` first, then one shot at where the player is going.
 */
const NEAR = 4;
const FAR = 8;
const SPIT_RANGE = 11;
export const SPIT_WIND = 0.55;
export const SPIT_RECOVER = 0.3;
const SPIT_CD: [number, number] = [1.4, 2.1];
/** How far ahead of the player a shot is aimed, in seconds of its swim. Short of a full lead, so a steady swim is still a dodge. */
const LEAD = 0.25;

/**
 * The turret. It holds the spot it was put in and fires a ring on a beat, whether it can
 * see the player or not; it swells as the tell. Each ring is turned half a spoke from the
 * last, so the safe line through one is the line the next is fired down.
 */
export const TURRET_WIND = 0.8;
export const TURRET_RECOVER = 0.5;
const TURRET_BEAT: [number, number] = [2.0, 2.5];
export const SPOKES = 8;
/** How far past its size a turret swells at the end of the tell. */
export const SWELL = 0.5;

/**
 * Stealth against a hostile: how wide of the player a spitter's shot goes, in radians per
 * point, and how much longer a room's hostiles take to find the player on entering, in
 * seconds per point (`Spawner.hostiles`). A hostile always knows the player is in its room;
 * stealth makes it slow and inaccurate, not blind.
 */
export const STEALTH_AIM = 0.4;
export const STEALTH_DELAY = 1.5;

/** The drifter: it comes on steadily by the shortest water, and the touch is the attack. */
const DRIFT_THROTTLE = 0.85;

/**
 * How fast a brain's heading eases to what it asks for, a second (`steer`): about a seventh of
 * a second to come round. Asked for raw, the heading jumped with every change of plan — the
 * line to the player opening and closing at a corner, a feeler swinging off the rock, the
 * band a spitter holds — and the body snapped round on each, or flipped there and back.
 */
const STEER = 7;
/** Seconds without steering after which the heading is taken as asked, not eased from a stale one. */
const STEER_STALE = 0.25;
/** How far across a spitter or turret lets the player go before it turns to face it, in tiles. */
const FACE_SLACK = 0.5;

/**
 * A hostile with a moveset turns once, as its health falls under `WOUNDED` of itself — Isaac's
 * monsters change at half — in a stagger of `TURN` seconds: flinched, ringed, doing nothing.
 * The beat says the fight changed; the body says how (`woundedGenome`).
 */
export const WOUNDED = 0.5;
const TURN = 0.5;
/**
 * The most hostiles in a room winding up or striking at once. Isaac's rooms take turns: four
 * going at once is a hit nothing answers, and two is a room to read. A pufferfish puffing at
 * the player is not an attack and takes no token, and a pack has one dash between them.
 */
const TOKENS = 2;

/**
 * The pack (the mackerel). It circles the player `ORBIT` tiles off, each its own way round,
 * steering `ORBIT_LEAD` radians ahead of itself on the circle, and the pack dashes one at a
 * time: a room of three is a rhythm and not a crowd. Below half health it is in a frenzy,
 * flushed red with its fins up: a missed dash is chained into a second, re-aimed through
 * `FRENZY_WIND` seconds before the same lock, and it comes round in `FRENZY_CD` of the time.
 */
const ORBIT = 4.5;
const ORBIT_LEAD = 0.7;
const CIRCLE = 0.6;
/** Seconds a pack member keeps the way round it turned to off the rock before it may turn again. */
const ORBIT_TURN = 1.2;
export const FRENZY_WIND = 0.2;
const FRENZY_CD = 0.6;

/**
 * The volley (the archerfish): `SALVO` spits in a burst, `SALVO_GAP` apart, the last aimed
 * twice as far ahead. A still target takes the first and a steady swim the last, and the grace
 * after a hit means a burst is only ever one. Below half health it keeps to cover: rock between
 * it and the player, found within `COVER_REACH` tiles and looked for again every `COVER_EVERY`
 * seconds. It comes out for a line when it is ready, fires, and goes back.
 */
export const SALVO = 3;
export const SALVO_GAP = 0.14;
const SALVO_CD: [number, number] = [2.0, 2.8];
const COVER_REACH = 5;
const COVER_EVERY = 0.6;

/**
 * The balloon (the pufferfish). A turret that keeps its ring on the beat and puffs at a player
 * closer than `PUFF_NEAR` tiles: `PUFF_HOLD` seconds at full swell taking `PUFF_TAKEN` of
 * every blow, then slack for `PUFF_CD` — the opening. Below half health it stays blown up with
 * its spines raised, comes off its spot and bounces round the room on a diagonal at `BOUNCE`
 * tiles a second, `FAN` spines off every wall it meets (Isaac's Boom Fly). Dead, it pops into
 * a full ring, unless it was swallowed.
 */
const PUFF_NEAR = 3;
export const PUFF_HOLD = 1.6;
const PUFF_CD = 2.2;
export const PUFF_TAKEN = 0.35;
export const BOUNCE = 2.4;
export const FAN = 5;
/** The bouncing swell, short of the puff's: taut, not braced. */
export const TAUT = 0.75;
/** Seconds between fans, so a body skidding into a corner does not fire one a frame. */
const FAN_GAP = 0.3;

/**
 * The bloom (the sea nettle). A bell swims in pulses: a surge at the player for `SURGE`
 * seconds with a `SURGE_KICK` of its cruise thrown in, then a coast for `GLIDE`, and whatever
 * way it goes it leaves its tentacles in the water — a sting every `STING_EVERY` seconds that
 * hangs for `STING_LIFE`, sinking. Below half health it glows hotter and pulses in `FASTER`
 * of the time. Dead, it buds into `BUDS` ephyrae: `BUD_SIZE` of it, `BUD_HP` of its health,
 * whole hostiles the room waits on, which leave no stings and bud no further.
 */
export const SURGE = 0.55;
export const GLIDE = 1.0;
const SURGE_KICK = 0.9;
const STING_EVERY = 0.22;
export const STING_LIFE = 1.4;
const FASTER = 0.6;
const BUDS = 2;
const BUD_SIZE = 0.5;
const BUD_HP = 0.3;

/**
 * The burrow (the ribbon eel). A charger that waits in a hole in the rock with `HEAD_OUT` tiles
 * of its head out, and lunges along the line out of it at a player inside `LURK_REACH` tiles and
 * `LURK_CONE` radians of that line, which its head follows round. The rock is drawn over the
 * bodies, so the body in it is hidden, and a shot meets the rock before it: only the head can be
 * hit. After the lunge it swims to the nearest free hole — the opening — and backs into it tail
 * first in `BACK_IN` seconds, as ribbon and garden eels do. A hole is a rock face with rock
 * behind it for the whole body and `DEN_CLEAR` tiles of water in front. Below half health it
 * leaves the rock for good and hunts in the open, a plain charger.
 */
export const HEAD_OUT = 1.2;
const LURK_REACH = 9;
const LURK_CONE = 0.45;
/** Radians a second the head turns after the player in its hole. */
const LOOK = 2.5;
const BACK_IN = 0.7;
/** Seconds in its hole before it may lunge again, so its arrival reads as one. */
const SETTLE = 0.6;
const DEN_CLEAR = 4;
/** Seconds swimming for a hole before it gives that one up and looks again. */
const DEN_GIVE_UP = 6;
/**
 * Seconds in a hole with the player off its line before it moves to one that has the player on
 * it: an eel left where it was was a room the player could sit out of reach in, and a head to
 * shoot from the side at leisure. A hole with the player on its line counts `COVERED` of its
 * distance when one is chosen.
 */
const LURK_BORED = 5;
const COVERED = 0.3;
/** Seconds in or out of standing up in a hole in the floor or the ceiling (`Creature.upright`). */
const STAND = 0.35;
/** The ways a hole is looked for from open water: across to a wall, down to the floor, up to the ceiling. */
const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * The jet (the triggerfish). A spitter whose shot is a jet of water that throws the player
 * `JET_KNOCK` tiles a second along its line, landed or not, and which between shots works round
 * to `JET_BEHIND` tiles off the player on the far side from the room's other hostiles, and
 * blows once it is there, so the jet blows the player into them. Below half health it is flushed red and stops blowing: it
 * charges, a charger's wind-up, lock and dash.
 */
const JET_KNOCK = 9;
const JET_BEHIND = 6;
/**
 * How near the line from it through the player to the others a triggerfish has to be to blow,
 * in radians, and the seconds it will wait to get there before it blows from wherever it is.
 */
const JET_LINED = 0.8;
const JET_WAIT = 1.5;

/**
 * The herd (the lionfish). A turret whose beat is a fan of `HERD` spines at the player,
 * `HERD_GAP` radians apart, instead of a ring. The way out of a fan is to its side, so it moves
 * the player where the lionfish chooses rather than only where it is not: into the room's
 * others and its corners, the way a lionfish corners a fish with its fins spread. Below half
 * health it is flared hot and fires the fan and the ring together.
 */
export const HERD = 5;
export const HERD_GAP = 0.24;

/**
 * The wane (the moon jelly). A drifter that fades out of the room and back: `WANE_SHOWN`
 * seconds there, `WANE_FADE` going, `WANE_GONE` gone and `WANE_FADE` coming back. Faded past
 * `GHOST` it can neither be hit nor hurt, and it comes on `WANE_HASTE` times as fast unseen, so
 * it is back nearer than it went; its own light stays on, faint (`Scene`), which is how it is
 * followed. Below half health it stays, flushed, and buds an ephyra every `SPAWN_EVERY`
 * seconds, `SPAWN_MAX` of them at a time.
 */
export const WANE_SHOWN = 2.8;
export const WANE_FADE = 0.5;
export const WANE_GONE = 1.6;
const WANE_HASTE = 1.6;
export const GHOST = 0.5;
const SPAWN_EVERY = 3.5;
const SPAWN_MAX = 3;

/**
 * The line (the barracuda). It hangs `LINE_OFF` tiles across from the player and slides into the
 * player's row at `LINE_CREEP` of its cruise, and the moment the player is on its line — within
 * `LINE_BAND` tiles of its row, inside its reach, nothing between — it gives the shortest tell in
 * the deep, `LINE_WIND` and the lock, and crosses the room along that row at a charger's dash —
 * which at its speed is the room in a second — until rock stops it, stunned for `LINE_STUN`
 * (Isaac's charger, which goes when it is lined up). Below half health a dash that meets rock
 * ricochets off it, turned up to `RICOCHET_AIM` toward the player, `RICOCHET` dashes to a run.
 */
const LINE_BAND = 0.8;
export const LINE_WIND = 0.2;
const LINE_OFF = 6;
const LINE_CREEP = 0.35;
/** The longest a line dash goes, seconds, if rock does not end it first. */
export const LINE_DASH = 1.2;
export const LINE_STUN = 1.1;
export const RICOCHET = 3;
const RICOCHET_AIM = 0.6;

/**
 * The gulp (the gulper eel). A charger that does not dash: inside `GULP_REACH` tiles of its mouth
 * and `GULP_CONE` of its line it opens its jaw through `GULP_WIND`, and then draws the water in for
 * `GULP_DRAW` — the player pulled toward the mouth at up to `GULP_PULL` of its cruise, so close
 * to the lips the way out is across the cone and not away down it, and the player's shots bent
 * into it and swallowed whole. The jaw shuts on whatever the draw delivered.
 * A gulp that took nothing leaves the jaw hanging for `GULP_GAPE`, the body `exposed`: the
 * opening, Isaac's Maw. Below half health it spits what it swallowed back out, a fan of `SPRAY`
 * and one more for each shot, `SPRAY_MORE` at most.
 */
const GULP_REACH = 4.5;
const GULP_CONE = 0.9;
export const GULP_WIND = 0.6;
export const GULP_DRAW = 1.1;
const GULP_PULL = 1.1;
export const GULP_GAPE = 1.6;
const GULP_CD: [number, number] = [1.2, 2.0];
export const SPRAY = 3;
const SPRAY_MORE = 6;
export const SPRAY_GAP = 0.2;
/**
 * How far the jaw takes in from the mouth, in tiles: what it bites and what it swallows. Its
 * pouch opens far past the head's own depth, which at half a tile let a player drawn to
 * a tile off the lips go free.
 */
const MAW = 1.1;
/** Draw streaks a second across the cone, as a guardian's suck draws them (`Patterns.draw`). */
const STREAKS = 30;

/**
 * The cloak (the vampire squid). A spitter whose bolts bend after the player at `CURVE` radians a
 * second for their first second (`Shot.home`), and then fly on. Below half health a player closer
 * than `BALL_NEAR` tiles turns it inside out, as the real animal does: `BALL_HOLD` seconds a spiked
 * ball, its arms swept back over the mantle, taking `BALL_TAKEN` of every blow, still; and then it
 * bursts, leaving a cloud of `CLOUD` glowing motes that sting and thin over `CLOUD_LIFE`, and jets
 * away from the player at `JET_AWAY` times its cruise for `JET_T`. `BALL_CD` before the next.
 */
export const CURVE = 0.9;
const BALL_NEAR = 3.5;
export const BALL_HOLD = 1.4;
export const BALL_TAKEN = 0.25;
const BALL_CD = 4;
export const CLOUD = 10;
export const CLOUD_LIFE = 2.6;
const JET_AWAY = 1.8;
const JET_T = 0.5;

/**
 * The orbit (the anglerfish). A turret whose beat is not a ring fired out but `LURE_N` bolts
 * hung on a circle `LURE_R` tiles round its lure, turning at `LURE_SPIN` radians a second for
 * `LURE_HOLD`, and then let go out along their spokes, one of them at where the player was; each
 * ring turns the other way. The circle itself is no place to be. Below half
 * health it also lunges at a player inside `LUNGE_NEAR` tiles: a charger's wind-up, lock and dash,
 * which at its speed carries it some six tiles — the turret's bite — every `LUNGE_CD` at most.
 */
export const LURE_N = 6;
export const LURE_R = 1.4;
export const LURE_SPIN = 2.6;
export const LURE_HOLD = 1.2;
const LUNGE_NEAR = 4;
const LUNGE_CD = 3.5;

/**
 * The chain (the siphonophore). It is a colony, and below half health it breaks in two where the
 * blow that turned it landed, each piece a colony of its own on its stretch of the picture, with
 * its share of the health left by length. A piece breaks again at half of its own, while it is
 * `LINK` columns of the picture long either side of a cut; a piece of stem without bells drifts at
 * `STEM` of the pace.
 */
const LINK = 110;
const STEM = 0.6;

/**
 * What a moveset looks like turned: the mackerel flushed red with its jaw and fins up, the
 * pufferfish's spines raised, the nettle's bell hotter, the triggerfish flushed red, the
 * lionfish flared, the moon jelly's gonads hot. A turn is a rebuild of the bake with this, once,
 * so the phase is on the animal and not only in its timings; a body drawn from a sprite has the
 * look drawn instead, as its wounded pair, and the genome only says it for a painted one. Only
 * colours for the reef's, which every sprite of theirs is: a fin or a jaw changes the form, and
 * the form is what a sprite is scaled to. Null for one whose turn is all in what it does: the
 * archerfish going to ground and the ribbon eel leaving the rock are their own tells.
 */
export function woundedGenome(moves: Moveset, g: Genome): Genome | null {
  switch (moves) {
    // the whole body flushed: the accent alone is a few dots on a darter and did not read
    case 'pack': return { ...g, hue: 6, accentHue: 356, jaw: g.jaw + 0.2, finSize: g.finSize * 1.3 };
    case 'balloon': return { ...g, spikes: g.spikes + 1 };
    case 'bloom': return { ...g, glow: Math.min(1, g.glow + 0.35) };
    case 'jet': return { ...g, hue: 4, accentHue: 48 };
    case 'herd': return { ...g, hue: 22, accentHue: 44 };
    case 'wane': return { ...g, glow: Math.min(1, g.glow + 0.3) };
    // the deep's are all sprites with no turned pair, and turn in what they do: the ricochet,
    // the spray, the ball, the lunge, the break
    case 'volley': case 'burrow': case 'line': case 'gulp': case 'cloak': case 'orbit': case 'chain':
      return null;
  }
}

/**
 * The role a hostile plays now, which is its species' but for a turned triggerfish, which stops
 * blowing and charges, and a turned anglerfish through a lunge.
 */
export function roleOf(c: Creature): Role | undefined {
  if (c.trick === 'lunge') return 'charger';
  return c.wounded && c.species.moves === 'jet' ? 'charger' : c.species.role;
}

/** Where a body's lure hangs: the sprite's bulb, or the mouth for one that has none drawn. */
export function lureOf(c: Creature): { x: number; y: number } {
  const b = SPRITES[c.species.id]?.bulb;
  return (b && spriteAt(c, b)) ?? { x: c.mouthX, y: c.mouthY };
}

/** Whether a body has faded too far out of the room to be hit or to hurt: a waning moon jelly, the Giant Squid in its ink. */
export function ghostly(c: Creature) {
  return c.wane > GHOST || c.gone > GHOST;
}

/** Whether an eel is in the rock, held where its brain puts it rather than swimming. */
function inRock(c: Creature) {
  return c.burrow === 'home' || c.burrow === 'back';
}

/** The share of a blow a hostile takes: a puffed pufferfish and a balled vampire squid are braced against it. */
export function bracedOf(c: Creature) {
  if (!c.hostile) return 1;
  if (c.trick === 'ball') return BALL_TAKEN;
  return c.species.moves === 'balloon' && c.puffT > 0 ? PUFF_TAKEN : 1;
}

/**
 * How far a charger is through its wind-up, for the bar over it: `fill` 0 to 1 through the
 * tracking part, and `locked` once the line is fixed. Null for anything not winding up a charge.
 */
export function chargeOf(c: Creature): { fill: number; locked: boolean } | null {
  // a gulp is not a dash: its tell is the jaw, and a bar that locked would promise a line
  if (roleOf(c) !== 'charger' || c.attack !== 'windup' || c.species.moves === 'gulp') return null;
  const done = c.attackLen - c.attackT;
  return { fill: Math.min(1, done / Math.max(0.01, c.attackLen - CHARGE_LOCK)), locked: c.attackT <= CHARGE_LOCK };
}

/**
 * Shot speeds, in tiles a second. The player cruises about six at the game's tempo, so a spit
 * is just outswum and a bolt easily: a shot is dodged across its line, not fled down it.
 */
export const SHOT_SPEED = { spit: 7, spine: 5.25, bolt: 4.5 } as const;

/**
 * The hostiles' brains. A hostile does not live in the room the way its fauna does — it has
 * one job, and its role is how it goes about it (see *Role* in `CONTEXT.md`). Each role is a
 * little state machine on `Creature.attack` — wind-up, strike, recovery — so every role's
 * tell is the one pose the view already draws for a wind-up: the body coiled and the jaw
 * open (`Creature.pose`).
 *
 * The way to the player is by the room's water (`Flow`), straight where a body's width of
 * water runs straight, so nothing in a room noses into the rock between it and the player;
 * and every heading a brain asks for is eased in (`steer`), so a change of plan is a turn.
 */
export class Roles {
  private flow: Flow | null = null;
  /**
   * The way to anywhere but the player: an eel's hole. One field is built for one target, and
   * shared, every eel looking for a hole rebuilt the player's under every other hostile.
   */
  private elsewhere: Flow | null = null;
  private flowOf: Terrain | null = null;

  constructor(private readonly world: World) {}

  step(c: Creature, dt: number, p: Creature, role: Role) {
    const t = this.world.terrain;
    if (!t) return;
    if (this.flowOf !== t) { this.flowOf = t; this.flow = new Flow(t); this.elsewhere = null; }
    c.roleCd = Math.max(0, c.roleCd - dt);
    // a body in the rock does not swim: a drive levels it out, and an eel standing in the
    // floor levelled would swing through the rock round its middle
    const rock = inRock(c);
    // arriving: it resolves out of the murk before it does anything, the moment Isaac gives
    // a room's monsters before they move
    if (c.fade < 1) { if (!rock) c.drive(dt, c.angle, 0); return; }
    if (!p.alive) { if (!rock) c.drive(dt, c.angle, 0.2); return; }
    c.guardCd = Math.max(0, c.guardCd - dt);
    c.exposed = Math.max(0, c.exposed - dt);
    if (!c.wounded && !c.brood && c.species.moves && c.hp < c.hpMax * WOUNDED) {
      // a colony breaks where it was cut, and is gone into its pieces
      if (c.species.moves === 'chain' && this.split(c)) return;
      this.turn(c, p);
    }
    if (c.turnT > 0) {
      c.turnT -= dt;
      if (!rock) c.drive(dt, c.angle, 0);
      return;
    }
    // a bouncing pufferfish aims at nothing, so ink has nothing to hide from it
    if (c.wounded && c.species.moves === 'balloon') { this.bounce(c); return; }
    // in ink the player is not there to be found: whatever was not already under way is
    // abandoned, and the room's hostiles drift where they were until it thins. An eel in its
    // hole stays in it, and `lurk` asks the same before it lunges
    if (this.inked(p) && c.attack !== 'strike' && !rock) {
      if (c.attack === 'windup') c.attack = 'none';
      c.swell = 1;
      c.drive(dt, this.steer(c, dt, clearHeading(t, c, c.angle + Math.sin(c.wander * 0.8) * 0.8)), 0.25);
      return;
    }
    switch (roleOf(c) ?? role) {
      case 'charger':
        if (c.species.moves === 'burrow') this.lurk(c, dt, p, t);
        else if (c.species.moves === 'gulp') this.gulp(c, dt, p, t);
        else this.charger(c, dt, p, t);
        break;
      case 'spitter': this.spitter(c, dt, p, t); break;
      case 'turret': this.turret(c, dt, p); break;
      case 'drifter': this.drifter(c, dt, p, t); break;
    }
  }

  /** Whether the player is in ink, where no hostile can find it. */
  private inked(p: Creature) {
    return this.world.inks.some(k => dist2(k.x, k.y, p.x, p.y) < k.r * k.r);
  }

  private charger(c: Creature, dt: number, p: Creature, t: Terrain) {
    const d = Math.sqrt(dist2(c.x, c.y, p.x, p.y));
    const line = c.species.moves === 'line';
    if (this.tick(c, dt)) {
      if (c.attack === 'windup') {
        // square on to the player through the wind-up, and held on the line for its last beat;
        // a barracuda's line is its row, so it only ever chooses which way along it
        if (c.attackT > CHARGE_LOCK) c.aimA = line ? (p.x >= c.x ? 0 : Math.PI) : Math.atan2(p.y - c.y, p.x - c.x);
        c.drive(dt, c.aimA, c.attackT > CHARGE_LOCK ? 0.15 : 0, 1);
      } else if (c.attack === 'strike') {
        this.dash(c);
        if (line) this.wall(c, p, t);
      } else {
        c.drive(dt, c.angle, 0.1);
      }
      return;
    }
    const sees = t.clearLine(c.x, c.y, p.x, p.y);
    if (line) { this.hang(c, dt, p, t, d, sees); return; }
    if (sees && d < (c.species.reach ?? DASH_RANGE) * t.tile && c.roleCd <= 0 && this.free(c)) {
      c.volley = 0;
      this.begin(c, 'windup', CHARGE_WIND(c.genome.size) + CHARGE_LOCK);
      c.aimA = Math.atan2(p.y - c.y, p.x - c.x);
      return;
    }
    if (c.species.moves === 'pack' && sees && d < (ORBIT + 2) * t.tile) { this.circle(c, dt, p, t); return; }
    c.drive(dt, this.steer(c, dt, this.way(c, p, t)), CHARGE_CLOSE);
  }

  /**
   * A barracuda between dashes: across from the player and sliding into its row, and the moment
   * the player is on its line, the tell.
   */
  private hang(c: Creature, dt: number, p: Creature, t: Terrain, d: number, sees: boolean) {
    const lined = Math.abs(p.y - c.y) < LINE_BAND * t.tile && d < (c.species.reach ?? DASH_RANGE) * t.tile;
    if (sees && lined && c.roleCd <= 0 && this.free(c)) {
      c.volley = 0;
      this.begin(c, 'windup', LINE_WIND + CHARGE_LOCK);
      c.aimA = p.x >= c.x ? 0 : Math.PI;
      return;
    }
    // out of sight, it comes round by the water; in it, it keeps its side and creeps level
    if (!sees) { c.drive(dt, this.steer(c, dt, this.way(c, p, t)), CHARGE_CLOSE); return; }
    const side = c.x <= p.x ? -1 : 1;
    const gx = p.x + side * LINE_OFF * t.tile, gy = p.y;
    if (dist2(c.x, c.y, gx, gy) < (t.tile * 0.6) ** 2) {
      c.drive(dt, c.angle, 0);
      c.faceToward(p.x, FACE_SLACK * t.tile);
      return;
    }
    c.drive(dt, this.steer(c, dt, clearHeading(t, c, Math.atan2(gy - c.y, gx - c.x))), LINE_CREEP);
  }

  /**
   * A line dash meeting rock, felt at the nose a step ahead: it ends there, stunned — or, turned
   * and with dashes left in the run, it comes off the wall square, turned toward the player.
   */
  private wall(c: Creature, p: Creature, t: Terrain) {
    const n = noseOf(c);
    const ux = Math.cos(c.aimA), uy = Math.sin(c.aimA);
    const ahead = t.cell + Math.hypot(c.vx, c.vy) * (1 / 60);
    // the room's edge is rock to a dash: an open door on its row let it out of the room
    const rock = (x: number, y: number) => t.solidAt(x, y) || x < t.x0 || x > t.x0 + t.width || y < t.y0 || y > t.y0 + t.height;
    const hitX = rock(n.x + Math.sign(ux) * ahead, n.y) && Math.abs(ux) > 0.1;
    const hitY = rock(n.x, n.y + Math.sign(uy) * ahead) && Math.abs(uy) > 0.1;
    if (!hitX && !hitY && !rock(n.x + ux * ahead, n.y + uy * ahead)) return;
    this.world.pulses.push({ x: n.x, y: n.y, r: depthOf(c) * 2.5, kind: 'dust' });
    c.view.bump(0.8, 0, 0);
    if (c.wounded && c.volley < RICOCHET - 1) {
      c.volley++;
      // square off whatever it met; a nose into a corner comes back the way it went
      const rx = hitX || !hitY ? -ux : ux, ry = hitY || !hitX ? -uy : uy;
      const off = Math.atan2(ry, rx);
      c.aimA = off + clamp(angleDelta(off, Math.atan2(p.y - c.y, p.x - c.x)), -RICOCHET_AIM, RICOCHET_AIM);
      c.attackT = c.attackLen = LINE_DASH;
      this.dash(c);
      return;
    }
    c.vx *= 0.1;
    c.vy *= 0.1;
    this.begin(c, 'recover', LINE_STUN);
  }

  /** A charger's dash: committed, the heading the one it wound up on, and the speed held. */
  private dash(c: Creature) {
    const v = Math.max(1, c.genome.speed) * DASH;
    c.angle = c.aimA;
    // straight up or down either facing will do, and an eel out of the floor keeps its own
    if (Math.abs(Math.cos(c.aimA)) > 0.2) c.face = Math.cos(c.aimA) >= 0 ? 1 : -1;
    c.vx = Math.cos(c.aimA) * v;
    c.vy = Math.sin(c.aimA) * v;
    c.thrust = 1.6;
  }

  /**
   * The gulper eel: closes as a charger does, and with the player in front of its mouth opens
   * it, draws, and shuts it; a gulp that took nothing hangs open (`tick`, `snap`).
   */
  private gulp(c: Creature, dt: number, p: Creature, t: Terrain) {
    if (this.tick(c, dt)) {
      if (c.attack === 'windup') {
        // square on to the player while the jaw opens; the draw itself does not track, or the
        // way out across the cone would close with it
        c.aimA = Math.atan2(p.y - c.y, p.x - c.x);
        c.drive(dt, c.aimA, 0.1, 1);
      } else if (c.attack === 'strike') {
        this.draw(c, dt, p, t);
      } else {
        c.drive(dt, c.angle, 0.05);
      }
      return;
    }
    const m = noseOf(c);
    const d = Math.sqrt(dist2(m.x, m.y, p.x, p.y));
    const ahead = Math.abs(angleDelta(c.angle, Math.atan2(p.y - m.y, p.x - m.x))) < GULP_CONE;
    if (ahead && d < GULP_REACH * t.tile && c.roleCd <= 0 && t.clearLine(m.x, m.y, p.x, p.y) && this.free(c)) {
      c.salvo = 0;
      this.begin(c, 'windup', GULP_WIND);
      return;
    }
    c.drive(dt, this.steer(c, dt, this.way(c, p, t)), CHARGE_CLOSE);
  }

  /**
   * The gulp's draw: the body hangs, and in front of the mouth the water pours in, the player
   * with it, and any of the player's shots in the cone are bent into the jaw and swallowed.
   */
  private draw(c: Creature, dt: number, p: Creature, t: Terrain) {
    c.drive(dt, c.angle, 0);
    const w = this.world;
    // a shot goes in nearer the lips than a body is bitten from, or one fired past the head
    // would be eaten out of the water beside it
    const m = noseOf(c), range = GULP_REACH * t.tile, maw = MAW * t.tile * 0.6;
    const into = (x: number, y: number) => {
      const dx = m.x - x, dy = m.y - y, d = Math.hypot(dx, dy) || 1;
      const inside = d < range && Math.abs(angleDelta(c.angle, Math.atan2(-dy, -dx))) < GULP_CONE * 1.3;
      return { dx: dx / d, dy: dy / d, d, k: inside ? 1 - d / range : 0 };
    };
    if (p.alive) {
      const q = into(p.x, p.y);
      // along a body the forward drag is DRAG_FWD, so this holds a drift of GULP_PULL × cruise
      const a = DRAG_FWD * Math.max(1, p.genome.speed) * GULP_PULL * q.k;
      p.vx += q.dx * a * dt;
      p.vy += q.dy * a * dt;
    }
    for (let i = w.shots.length - 1; i >= 0; i--) {
      const s = w.shots[i];
      if (!s.by.isPlayer || s.fry?.on) continue;
      const q = into(s.x, s.y);
      // a step ahead of it, and its own reach: a shot meets the head's hull a step after it
      // is in range, and it is the hull it would have landed on
      if (q.d < maw + s.r + Math.hypot(s.vx, s.vy) * dt) {
        w.shots.splice(i, 1);
        c.salvo++;
        w.pulses.push({ x: s.x, y: s.y, r: s.r * 3, kind: 'bubbles' });
        continue;
      }
      if (!q.k) continue;
      // turned into the jaw at its own speed: a shot fired into the draw is a shot it eats
      const v = Math.hypot(s.vx, s.vy);
      const a = Math.atan2(s.vy, s.vx) + clamp(angleDelta(Math.atan2(s.vy, s.vx), Math.atan2(q.dy, q.dx)), -6 * dt, 6 * dt);
      s.vx = Math.cos(a) * v;
      s.vy = Math.sin(a) * v;
    }
    for (let n = Math.floor(STREAKS * dt + Math.random()); n > 0; n--) {
      const a = c.angle + (Math.random() * 2 - 1) * GULP_CONE;
      const d = range * (0.25 + Math.random() * 0.75);
      const x = m.x + Math.cos(a) * d, y = m.y + Math.sin(a) * d;
      w.pulses.push({ x, y, r: depthOf(c) * 0.3, kind: 'draw', vx: (m.x - x) * 2.4, vy: (m.y - y) * 2.4 });
    }
  }

  /**
   * The end of a gulp: the jaw shuts on whatever the draw brought to it. Turned, it spits back
   * a fan for what it swallowed; a gulp that took nothing hangs its jaw open and the body is
   * exposed. Returns the recovery's length.
   */
  private snap(c: Creature, p: Creature) {
    const w = this.world;
    const m = noseOf(c);
    c.view.chomp();
    w.pulses.push({ x: m.x, y: m.y, r: depthOf(c) * 2, kind: 'snap' });
    const reach = MAW * w.terrain!.tile + p.radius * 0.5;
    c.landed = p.alive && dist2(m.x, m.y, p.x, p.y) < reach * reach && w.hurtPlayer(c, 'bite') > 0;
    if (c.wounded) {
      const n = SPRAY + Math.min(c.salvo, SPRAY_MORE);
      const at = Math.atan2(p.y - m.y, p.x - m.x);
      for (let k = 0; k < n; k++) w.fire(c, 'spit', m.x, m.y, at + (k - (n - 1) / 2) * SPRAY_GAP, SHOT_SPEED.spit);
    }
    c.salvo = 0;
    if (c.landed) return SPIT_RECOVER;
    c.trick = 'gape';
    c.exposed = GULP_GAPE;
    w.pulses.push({ x: c.x, y: c.y, r: c.radius * 1.2, kind: 'exposed' });
    return GULP_GAPE;
  }

  /**
   * The ribbon eel: in its hole, out of it along its line, and back to the nearest free one.
   * Turned, it comes out and is a charger in the open.
   */
  private lurk(c: Creature, dt: number, p: Creature, t: Terrain) {
    // leaving the rock it is let through it until its middle is clear, and then the rock is
    // the rock again
    if (c.burrow === 'out' && t.clearAt(c.x, c.y, wallR(c))) c.burrow = '';
    const den = c.den;
    const stand = inRock(c) && den && Math.abs(Math.sin(den.a)) > 0.7 ? 1 : 0;
    c.upright += clamp(stand - c.upright, -dt / STAND, dt / STAND);
    if (c.wounded) {
      if (c.burrow) c.drive(dt, c.aimA, 0.6);
      else this.charger(c, dt, p, t);
      return;
    }
    if (this.tick(c, dt)) {
      if (c.attack === 'windup' && den) {
        // the head after the player inside its cone, and held on the line for the last beat
        if (c.attackT > CHARGE_LOCK) c.aimA = this.coned(den, p);
        this.look(c, dt, c.aimA, den, p);
      } else if (c.attack === 'strike') {
        this.dash(c);
      } else {
        // spent, and still coming out of the rock along the line it went
        c.drive(dt, c.angle, c.burrow ? 0.5 : 0.1);
      }
      return;
    }
    if (c.burrow === 'home' && den) {
      const a = this.coned(den, p);
      this.look(c, dt, a, den, p);
      if (!this.covers(den, p, t)) {
        // nothing has crossed its line for a while: out, and to a hole that has the player
        // in its, which is the eel in the open between the two
        if ((c.salvoT += dt) < LURK_BORED) return;
        c.salvoT = 0;
        const next = this.hole(c, t, p, den);
        if (!next) return;
        c.burrow = 'out';
        c.aimA = den.a;
        c.den = next;
        c.guardCd = DEN_GIVE_UP;
        this.world.pulses.push({ x: den.x, y: den.y, r: depthOf(c) * 2, kind: 'dust' });
        return;
      }
      c.salvoT = 0;
      if (c.roleCd <= 0 && !this.inked(p) && this.free(c)) {
        c.volley = 0;
        c.aimA = a;
        this.begin(c, 'windup', CHARGE_WIND(c.genome.size) + CHARGE_LOCK);
      }
      return;
    }
    if (c.burrow === 'back' && den) {
      // tail first along the line out of the hole, faster than it could swim it
      const h = this.homeOf(c, den, den.a);
      const dx = h.x - c.x, dy = h.y - c.y, d = Math.hypot(dx, dy);
      const step = (noseReach(c) + tailReach(c)) / BACK_IN * dt;
      if (d <= step) {
        c.x = h.x;
        c.y = h.y;
        c.burrow = 'home';
        // settled before it goes again, so its arrival is seen as one
        c.roleCd = Math.max(c.roleCd, SETTLE);
        return;
      }
      c.x += (dx / d) * step;
      c.y += (dy / d) * step;
      return;
    }
    // out of the rock the way it went in: along the line out of the hole it left
    if (c.burrow === 'out') { c.drive(dt, c.aimA, 0.6); return; }
    // in the open, after a lunge: the nearest free hole, given up on if it cannot be reached
    if (c.guardCd <= 0) {
      c.den = this.hole(c, t, p);
      c.guardCd = c.den ? DEN_GIVE_UP : 1;
    }
    if (!c.den) { this.charger(c, dt, p, t); return; }
    const f = this.front(c, c.den, t);
    if (dist2(c.x, c.y, f.x, f.y) < (t.tile * 0.8) ** 2) {
      // turned to face out, and in it goes
      c.burrow = 'back';
      c.angle = c.den.a;
      c.face = this.faceIn(c.den, p, c.face);
      c.attack = 'none';
      this.world.pulses.push({ x: c.den.x, y: c.den.y, r: depthOf(c) * 2, kind: 'dust' });
      return;
    }
    this.elsewhere ??= new Flow(t);
    const to = this.elsewhere.toward(c.x, c.y, f.x, f.y) ?? Math.atan2(f.y - c.y, f.x - c.x);
    c.drive(dt, this.steer(c, dt, clearHeading(t, c, to)), 0.8);
  }

  /** Whether the player is on a hole's line: inside its cone and reach, with nothing between. */
  private covers(den: NonNullable<Creature['den']>, p: Creature, t: Terrain) {
    return Math.abs(angleDelta(den.a, Math.atan2(p.y - den.y, p.x - den.x))) < LURK_CONE &&
      dist2(den.x, den.y, p.x, p.y) < (LURK_REACH * t.tile) ** 2 && t.clearLine(den.x, den.y, p.x, p.y);
  }

  /** The heading out of a hole nearest the player's, inside the eel's cone. */
  private coned(den: NonNullable<Creature['den']>, p: Creature) {
    const off = angleDelta(den.a, Math.atan2(p.y - den.y, p.x - den.x));
    return den.a + clamp(off, -LURK_CONE, LURK_CONE);
  }

  /**
   * The facing in a hole: out of it, for one in a wall; in the floor or the ceiling it stands
   * near straight, where either facing is the same eel, and it takes the player's side, flipping
   * only once the player is a tile across — every sway of its head would mirror it otherwise.
   */
  private faceIn(den: NonNullable<Creature['den']>, p: Creature, face: 1 | -1): 1 | -1 {
    if (Math.abs(Math.sin(den.a)) <= 0.7) return Math.cos(den.a) >= 0 ? 1 : -1;
    const across = (p.x - den.x) * face;
    return across < -this.world.terrain!.tile ? (face > 0 ? -1 : 1) : face;
  }

  /** In its hole, the head turned toward `want` and the body held so the head is at the mouth. */
  private look(c: Creature, dt: number, want: number, den: NonNullable<Creature['den']>, p: Creature) {
    c.face = this.faceIn(den, p, c.face);
    c.angle += clamp(angleDelta(c.angle, want), -LOOK * dt, LOOK * dt);
    const h = this.homeOf(c, den, c.angle);
    c.x = h.x;
    c.y = h.y;
  }

  /**
   * Where the body's middle is with its nose `HEAD_OUT` tiles out of the hole along `a`: the
   * nose as drawn, so the head is where the picture's is whatever the pitch it is drawn at.
   */
  private homeOf(c: Creature, den: NonNullable<Creature['den']>, a: number) {
    const n = noseOf(c, a);
    const ox = n.x - c.x, oy = n.y - c.y, d = Math.hypot(ox, oy) || 1;
    const out = HEAD_OUT * this.world.terrain!.tile;
    return { x: den.x + (ox / d) * out - ox, y: den.y + (oy / d) * out - oy };
  }

  /** Where a body is with its tail at a hole's mouth, facing out: where it backs in from. */
  private front(c: Creature, den: NonNullable<Creature['den']>, t: Terrain) {
    const d = tailReach(c) + t.tile * 0.4;
    return { x: den.x + Math.cos(den.a) * d, y: den.y + Math.sin(den.a) * d };
  }

  /**
   * The nearest free hole: a rock face found from open water straight across, up or down, with
   * rock behind its mouth for the whole body as it lies in it and `DEN_CLEAR` tiles of open
   * water in front, away from the doors and another eel's. One with the player on its line
   * (`covers`) counts as `COVERED` of its distance, so an eel goes where it can lunge from. Not
   * `left`, the hole it is leaving. Sampled, not searched: a room's faces are many and any near
   * one will do. Null when the room has none.
   */
  private hole(c: Creature, t: Terrain, p?: Creature, left?: Creature['den']): Creature['den'] {
    const tile = t.tile, step = t.cell;
    const deep = noseReach(c) + tailReach(c) - HEAD_OUT * tile + tile * 0.3;
    const side = depthOf(c);
    const ahead = tailReach(c) + tile * 0.4;
    const doors = t.doors.map(s => t.doorRect(s));
    let best: Creature['den'] = null, bd = Infinity;
    for (let n = 0; n < 48; n++) {
      const x = t.x0 + Math.random() * t.width, y = t.y0 + Math.random() * t.height;
      if (t.solidAt(x, y)) continue;
      for (const [dx, dy] of DIRS) {
        let k = 0;
        while (k < 4 * tile && !t.solidAt(x + dx * k, y + dy * k)) k += step;
        if (k >= 4 * tile) continue;
        const mx = x + dx * (k - step), my = y + dy * (k - step);
        // the body turns about the mouth as the head follows the player, so the rock has to
        // take it at either edge of the cone as well as straight in: a ledge a tile thick held
        // the eel lying straight and showed its tail swung up over it
        let ok = true;
        for (const turn of [0, -LURK_CONE, LURK_CONE]) {
          const ux = dx * Math.cos(turn) - dy * Math.sin(turn), uy = dx * Math.sin(turn) + dy * Math.cos(turn);
          for (let s = tile * 0.4; s <= deep && ok; s += tile * 0.4) {
            const bx = mx + ux * s, by = my + uy * s;
            ok = t.solidAt(bx, by) && t.solidAt(bx - uy * side, by + ux * side) && t.solidAt(bx + uy * side, by - ux * side);
          }
        }
        if (!ok) continue;
        const fx = mx - dx * ahead, fy = my - dy * ahead;
        if (!t.clearLine(mx, my, mx - dx * DEN_CLEAR * tile, my - dy * DEN_CLEAR * tile) || !t.clearAt(fx, fy, wallR(c))) continue;
        if (doors.some(r => mx > r.x - tile * 2 && mx < r.x + r.w + tile * 2 && my > r.y - tile * 2 && my < r.y + r.h + tile * 2)) continue;
        if (this.world.creatures.some(o => o !== c && o.alive && o.den && dist2(o.den.x, o.den.y, mx, my) < (tile * 3) ** 2)) continue;
        if (left && dist2(left.x, left.y, mx, my) < (tile * 3) ** 2) continue;
        const den = { x: mx, y: my, a: Math.atan2(-dy, -dx) };
        const d = Math.sqrt(dist2(c.x, c.y, fx, fy)) * (p && this.covers(den, p, t) ? COVERED : 1);
        if (d < bd) { bd = d; best = den; }
      }
    }
    return best;
  }

  /**
   * An eel put straight into a hole as it arrives (`Spawner.hostiles`), so the first the player
   * sees of it is a head out of the rock. False when the room has none, and it arrives in the
   * open as any charger does.
   */
  dig(c: Creature) {
    const t = this.world.terrain;
    if (!t) return false;
    c.den = this.hole(c, t);
    if (!c.den) return false;
    c.burrow = 'home';
    c.angle = c.den.a;
    c.face = this.faceIn(c.den, this.world.player, Math.cos(c.den.a) >= 0 ? 1 : -1);
    c.upright = Math.abs(Math.sin(c.den.a)) > 0.7 ? 1 : 0;
    c.vx = c.vy = 0;
    const h = this.homeOf(c, c.den, c.angle);
    c.x = h.x;
    c.y = h.y;
    return true;
  }

  /**
   * A pack member waiting its turn: round the player on the circle, steering for a point
   * ahead of it there. Turned off the rock, it goes the other way round instead of grinding
   * along the wall.
   */
  private circle(c: Creature, dt: number, p: Creature, t: Terrain) {
    const r = ORBIT * t.tile;
    const b = Math.atan2(c.y - p.y, c.x - p.x) + c.orbit * ORBIT_LEAD;
    const want = Math.atan2(p.y + Math.sin(b) * r - c.y, p.x + Math.cos(b) * r - c.x);
    const a = clearHeading(t, c, want);
    // held a while once turned, or a body boxed in on both sides turned there and back
    if (Math.abs(angleDelta(want, a)) > 1.2 && c.guardCd <= 0) {
      c.orbit = c.orbit > 0 ? -1 : 1;
      c.guardCd = ORBIT_TURN;
    }
    c.drive(dt, this.steer(c, dt, a), CIRCLE);
  }

  private spitter(c: Creature, dt: number, p: Creature, t: Terrain) {
    const d = Math.sqrt(dist2(c.x, c.y, p.x, p.y));
    const aim = Math.atan2(p.y - c.y, p.x - c.x);
    if (c.species.moves === 'cloak' && c.wounded && this.cloak(c, dt, p, t, d)) return;
    c.faceToward(p.x, FACE_SLACK * t.tile);
    if (this.tick(c, dt)) {
      // still, and pitched toward the player as far as a fish side-on will pitch: quickly, but
      // not in a frame, or the wind-up opened on the body jerking its nose up or down
      c.strafe(dt, 0, 0, 0, pitched(aim, c.face, 0.6));
      if (c.attack === 'strike' && c.salvo > 0 && (c.salvoT -= dt) <= 0) {
        c.salvo--;
        c.salvoT = SALVO_GAP;
        this.spit(c, c.salvo === 0 ? LEAD * 2 : 0);
      }
      return;
    }
    const m = spitFrom(c);
    const sees = t.clearLine(m.x, m.y, p.x, p.y);
    // a triggerfish holds its jet until it is behind the player from the others, or has waited
    // long enough that a jet anywhere is better than none
    const jet = c.species.moves === 'jet';
    if (jet && c.roleCd <= 0) c.salvoT += dt;
    const ready = !jet || c.salvoT > JET_WAIT || this.lined(c, p);
    if (sees && d < SPIT_RANGE * t.tile && c.roleCd <= 0 && ready && this.free(c)) {
      c.salvoT = 0;
      this.begin(c, 'windup', SPIT_WIND);
      return;
    }
    if (c.species.moves === 'volley' && c.wounded && c.roleCd > 0 && this.hide(c, dt, p, t)) return;
    // hold the band: in from too far or out of sight, back from too close, and otherwise
    // drift across the player's line so it is never a still target
    let a: number, throttle = 0.5;
    if (!sees || d > FAR * t.tile) {
      a = this.way(c, p, t);
    } else if (d < NEAR * t.tile) {
      a = clearHeading(t, c, aim + Math.PI);
      throttle = 0.7;
    } else {
      const behind = c.species.moves === 'jet' ? this.behind(c, p, t) : null;
      const side = Math.sin(c.wander * 0.6) >= 0 ? 1 : -1;
      a = clearHeading(t, c, behind ?? aim + side * Math.PI / 2);
      throttle = behind === null ? 0.3 : 0.5;
    }
    a = this.steer(c, dt, a);
    c.strafe(dt, Math.cos(a), Math.sin(a), throttle);
  }

  /**
   * A turned vampire squid's cloak: the ball, the cloud it bursts into and the jet away, or
   * nothing, and it plays its spitter. Whether it took the step.
   */
  private cloak(c: Creature, dt: number, p: Creature, t: Terrain, d: number) {
    if (c.trick === 'ball') {
      c.strafe(dt, 0, 0, 0);
      if ((c.trickT -= dt) > 0) return true;
      c.trick = '';
      this.cloud(c);
      c.aimA = clearHeading(t, c, Math.atan2(c.y - p.y, c.x - p.x));
      c.guardCd = BALL_CD;
      c.roleCd = Math.max(c.roleCd, JET_T + 0.4);
      return true;
    }
    // jetting away from the cloud: driven, not steered, as a squid's jet is
    if (c.guardCd > BALL_CD - JET_T) {
      c.angle = c.aimA;
      c.strafe(dt, Math.cos(c.aimA), Math.sin(c.aimA), JET_AWAY, c.aimA);
      return true;
    }
    if (c.attack !== 'none' || c.guardCd > 0 || d > BALL_NEAR * t.tile) return false;
    c.trick = 'ball';
    c.trickT = BALL_HOLD;
    c.view.bump(0.6, 0, 0);
    this.world.pulses.push({ x: c.x, y: c.y, r: c.radius * 1.6, kind: 'inflate' });
    return true;
  }

  /**
   * The cloud a vampire squid bursts into: a flash, and motes of its glowing mucus thrown out on
   * every side to hang in the water, each a sting, thinning out through `CLOUD_LIFE`.
   */
  private cloud(c: Creature) {
    const w = this.world, tile = w.terrain!.tile;
    w.pulses.push({ x: c.x, y: c.y, r: c.radius * 2.4, kind: 'flash' });
    for (let k = 0; k < CLOUD; k++) {
      const a = (k / CLOUD) * TAU + Math.random() * 0.5;
      const v = tile * (0.5 + Math.random() * 0.8);
      w.lob(c, 'bolt', c.x, c.y, Math.cos(a) * v, Math.sin(a) * v, undefined, CLOUD_LIFE, { fades: true });
    }
  }

  /** The hostile nearest the player but `c`, which a triggerfish blows the player into. */
  private partner(c: Creature, p: Creature) {
    let o: Creature | null = null, od = Infinity;
    for (const k of this.world.creatures) {
      if (k === c || !k.alive || !k.hostile) continue;
      const d = dist2(k.x, k.y, p.x, p.y);
      if (d < od) { od = d; o = k; }
    }
    return o;
  }

  /** Whether a jet from `c` would blow the player toward the others: `JET_LINED` of the line to one. */
  private lined(c: Creature, p: Creature) {
    const o = this.partner(c, p);
    return !o || Math.abs(angleDelta(Math.atan2(p.y - c.y, p.x - c.x), Math.atan2(o.y - p.y, o.x - p.x))) < JET_LINED;
  }

  /**
   * A triggerfish between jets: the way to the water `JET_BEHIND` tiles off the player on the
   * far side from the nearest other hostile, so the jet blows the player toward it. Null with
   * no other in the room, or already there, and it drifts across the line as any spitter does.
   */
  private behind(c: Creature, p: Creature, t: Terrain) {
    const o = this.partner(c, p);
    if (!o) return null;
    const away = Math.atan2(p.y - o.y, p.x - o.x);
    const r = JET_BEHIND * t.tile;
    const x = p.x + Math.cos(away) * r, y = p.y + Math.sin(away) * r;
    if (dist2(c.x, c.y, x, y) < (t.tile * 1.5) ** 2) return null;
    return Math.atan2(y - c.y, x - c.x);
  }

  /**
   * A wounded archerfish between bursts: to the nearest cover and still there, facing out.
   * The spot is kept while the player cannot see into it — looked for afresh each time from
   * where the body is, it crept from one nearest spot to the next and never settled. False
   * when there is none to be had, and it holds the band as it did whole.
   */
  private hide(c: Creature, dt: number, p: Creature, t: Terrain) {
    if (c.guardCd <= 0) {
      c.guardCd = COVER_EVERY;
      if (!c.anchor || t.clearLine(p.x, p.y, c.anchor.x, c.anchor.y)) c.anchor = this.cover(c, p, t);
    }
    if (!c.anchor) return false;
    const dx = c.anchor.x - c.x, dy = c.anchor.y - c.y;
    if (Math.hypot(dx, dy) < t.tile * 0.4) { c.strafe(dt, 0, 0, 0); return true; }
    const a = this.steer(c, dt, clearHeading(t, c, Math.atan2(dy, dx)));
    c.strafe(dt, Math.cos(a), Math.sin(a), 0.75);
    return true;
  }

  /**
   * The nearest water the player cannot see into from where it is and the archerfish can
   * swim to straight: rock between the two, and not so near the player that hiding is a
   * meeting. Sampled round the body out to `COVER_REACH` tiles.
   */
  private cover(c: Creature, p: Creature, t: Terrain) {
    let best: { x: number; y: number } | null = null, bd = Infinity;
    for (let ring = 1; ring <= 3; ring++) {
      const d = (COVER_REACH / 3) * ring * t.tile;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * TAU;
        const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d;
        if (d >= bd || !t.clearAt(x, y, c.radius * 0.6)) continue;
        if (dist2(x, y, p.x, p.y) < (NEAR * t.tile) ** 2) continue;
        if (t.clearLine(p.x, p.y, x, y) || !t.clearLine(c.x, c.y, x, y)) continue;
        best = { x, y };
        bd = d;
      }
      if (best) break;
    }
    return best;
  }

  private turret(c: Creature, dt: number, p: Creature) {
    const balloon = c.species.moves === 'balloon';
    if (c.species.moves === 'orbit' && c.wounded && this.lunge(c, p)) return;
    c.anchor ??= { x: c.x, y: c.y };
    c.faceToward(p.x, FACE_SLACK * this.world.terrain!.tile);
    // it holds its spot against anything that knocked it off, facing the player
    const hx = c.anchor.x - c.x, hy = c.anchor.y - c.y;
    const off = Math.hypot(hx, hy) > c.radius * 0.3;
    c.strafe(dt, off ? hx : 0, off ? hy : 0, off ? 0.4 : 0);
    const busy = this.tick(c, dt);
    if (balloon && !busy) {
      // braced: blown up at once and held, then let go over its last moment — the puff is
      // the body's whole answer to a player too close, and it fires nothing through it
      if (c.puffT > 0) {
        c.swell = 1 + SWELL * clamp(Math.min((PUFF_HOLD - c.puffT) / 0.12, c.puffT / 0.3), 0, 1);
        return;
      }
      if (c.guardCd <= 0 && dist2(c.x, c.y, p.x, p.y) < (PUFF_NEAR * this.world.terrain!.tile) ** 2) {
        c.puffT = PUFF_HOLD;
        c.guardCd = PUFF_HOLD + PUFF_CD;
        this.world.pulses.push({ x: c.x, y: c.y, r: c.radius * 2, kind: 'inflate' });
        return;
      }
    }
    c.swell = 1 + SWELL * (c.attack === 'windup' ? 1 - c.attackT / c.attackLen
      : c.attack === 'strike' ? 1 : c.attack === 'recover' ? c.attackT / c.attackLen : 0);
    if (!busy && c.roleCd <= 0 && this.free(c)) this.begin(c, 'windup', TURRET_WIND);
  }

  /**
   * A turned anglerfish with the player close and in sight: off its spot in a charger's lunge
   * (`roleOf` is the charger's through it, so the wind-up, the bar and the lock are a charger's).
   * It holds wherever the lunge leaves it. Whether it went.
   */
  private lunge(c: Creature, p: Creature) {
    const t = this.world.terrain!;
    if (c.attack !== 'none' || c.guardCd > 0 || !this.free(c)) return false;
    if (dist2(c.x, c.y, p.x, p.y) > (LUNGE_NEAR * t.tile) ** 2 || !t.clearLine(c.x, c.y, p.x, p.y)) return false;
    c.trick = 'lunge';
    c.guardCd = LUNGE_CD;
    c.swell = 1;
    c.anchor = null;
    this.begin(c, 'windup', CHARGE_WIND(c.genome.size) + CHARGE_LOCK);
    c.aimA = Math.atan2(p.y - c.y, p.x - c.x);
    return true;
  }

  /**
   * A wounded pufferfish: off its spot, taut, on a diagonal at a steady speed, and turned back
   * square off any rock it meets — first across, then up or down, so a corner is both. Each
   * wall throws a fan of spines out across the water it came off.
   */
  private bounce(c: Creature) {
    const t = this.world.terrain!;
    c.swell = 1 + SWELL * TAUT;
    let ux = Math.cos(c.aimA), uy = Math.sin(c.aimA);
    // a cell past the circle it meets the rock with, or the rock stops it before it is felt
    const r = wallR(c) + t.cell;
    let nx = 0, ny = 0;
    if (t.solidAt(c.x + Math.sign(ux) * r, c.y)) { ux = -ux; nx = Math.sign(ux); }
    if (t.solidAt(c.x, c.y + Math.sign(uy) * r)) { uy = -uy; ny = Math.sign(uy); }
    if (nx || ny) {
      c.aimA = Math.atan2(uy, ux);
      c.view.bump(0.5, 0, 0);
      if (c.roleCd <= 0) {
        c.roleCd = FAN_GAP;
        const off = Math.atan2(ny, nx);
        for (let k = 0; k < FAN; k++) this.spine(c, off + ((k / (FAN - 1)) - 0.5) * Math.PI * 0.8, TAUT);
      }
    }
    const v = BOUNCE * t.tile;
    c.vx = ux * v;
    c.vy = uy * v;
    c.face = ux >= 0 ? 1 : -1;
    c.angle = c.face > 0 ? 0 : Math.PI;
    c.thrust = 0.3;
  }

  private drifter(c: Creature, dt: number, p: Creature, t: Terrain) {
    // a bell does not aim so much as lean: the heading wanders about the way to the player
    const wobble = Math.sin(c.wander * 1.3) * 0.5;
    if (c.species.moves === 'bloom') { this.pulse(c, dt, p, t, wobble); return; }
    const haste = c.species.moves === 'wane' && !c.brood ? this.wane(c, dt) : 1;
    // a piece of a colony with no bells in it has nothing to swim with but its pulse
    const stem = c.species.moves === 'chain' && !SPRITES[c.species.id]?.bells ? STEM : 1;
    c.drive(dt, this.steer(c, dt, this.way(c, p, t) + wobble), DRIFT_THROTTLE * stem, 0, haste);
  }

  /**
   * A moon jelly's cycle out of the room and back, or, turned, its budding; returns how hard it
   * swims, which unseen is harder.
   */
  private wane(c: Creature, dt: number) {
    if (c.wounded) {
      c.wane = Math.max(0, c.wane - dt / WANE_FADE);
      if ((c.waneT -= dt) > 0) return 1;
      c.waneT = SPAWN_EVERY;
      let n = 0;
      for (const o of this.world.creatures) if (o.alive && o.brood && o.species === c.species) n++;
      if (n < SPAWN_MAX) {
        this.bud(c, c.angle + Math.PI + (Math.random() - 0.5) * 1.2);
        this.world.pulses.push({ x: c.x, y: c.y, r: c.radius, kind: 'turn' });
      }
      return 1;
    }
    const cycle = WANE_SHOWN + WANE_FADE * 2 + WANE_GONE;
    c.waneT = (c.waneT + dt) % cycle;
    const k = c.waneT - WANE_SHOWN;
    c.wane = k < 0 ? 0 : k < WANE_FADE ? k / WANE_FADE : k < WANE_FADE + WANE_GONE ? 1
      : 1 - (k - WANE_FADE - WANE_GONE) / WANE_FADE;
    return ghostly(c) ? WANE_HASTE : 1;
  }

  /**
   * A bell's pulse: a kick and a surge at the player, then a coast, and the tentacles left
   * hanging behind it as it goes — in the way it came, which is where a player circling it is.
   */
  private pulse(c: Creature, dt: number, p: Creature, t: Terrain, wobble: number) {
    const k = c.wounded ? FASTER : 1;
    const a = this.steer(c, dt, this.way(c, p, t) + wobble * 0.5);
    if ((c.surgeT -= dt) <= -GLIDE * k) {
      c.surgeT = SURGE * k;
      const kick = Math.max(1, c.genome.speed) * SURGE_KICK;
      c.vx += Math.cos(a) * kick;
      c.vy += Math.sin(a) * kick;
    }
    c.drive(dt, a, c.surgeT > 0 ? 1 : 0.1);
    if (c.brood || (c.salvoT -= dt) > 0) return;
    c.salvoT = STING_EVERY;
    const v = Math.hypot(c.vx, c.vy) || 1;
    const back = c.radius * 0.8;
    this.world.lob(c, 'sting', c.x - (c.vx / v) * back, c.y - (c.vy / v) * back, c.vx * 0.1, c.vy * 0.1,
      { g: t.tile * 0.4, sink: t.tile * 0.3, drag: 2 }, STING_LIFE, { fades: true });
  }

  /**
   * Run the current step's clock and move to the next, firing on the step into the strike.
   * Returns whether a step is under way.
   */
  private tick(c: Creature, dt: number): boolean {
    if (c.attack === 'none') return false;
    if ((c.attackT -= dt) > 0) return true;
    const role = roleOf(c)!;
    const moves = c.species.moves;
    if (c.attack === 'windup') {
      this.strike(c, role);
      this.begin(c, 'strike', role === 'charger'
        ? (moves === 'line' ? LINE_DASH : moves === 'gulp' ? GULP_DRAW : DASH_TIME)
        : moves === 'volley' ? SALVO_GAP * (SALVO - 1) + 0.12 : 0.12);
    } else if (c.attack === 'strike') {
      if (moves === 'gulp') {
        this.begin(c, 'recover', this.snap(c, this.world.player));
        return true;
      }
      // a frenzied pack member that missed goes again, at once, on a fresh line
      if (moves === 'pack' && c.wounded && c.volley === 0) {
        const p = this.world.player;
        c.volley = 1;
        this.begin(c, 'windup', FRENZY_WIND + CHARGE_LOCK);
        c.aimA = Math.atan2(p.y - c.y, p.x - c.x);
        return true;
      }
      this.begin(c, 'recover', role === 'charger' ? CHARGE_RECOVER
        : role === 'turret' ? TURRET_RECOVER : SPIT_RECOVER);
    } else {
      c.attack = 'none';
      // a lunge over, the anglerfish holds where it is and its beat comes round soon
      if (c.trick === 'lunge') { c.trick = ''; c.roleCd = TURRET_RECOVER; return false; }
      if (c.trick === 'gape') c.trick = '';
      const [a, b] = moves === 'gulp' ? GULP_CD : role === 'charger' ? CHARGE_CD : role === 'turret' ? TURRET_BEAT
        : moves === 'volley' ? SALVO_CD : SPIT_CD;
      c.roleCd = (a + Math.random() * (b - a)) * (moves === 'pack' && c.wounded ? FRENZY_CD : 1);
      return false;
    }
    return true;
  }

  /** Whether the room has a token free for `c` to begin an attack on: see `TOKENS`. */
  private free(c: Creature) {
    let n = 0;
    for (const o of this.world.creatures) {
      if (o === c || !o.alive || !o.hostile || (o.attack !== 'windup' && o.attack !== 'strike')) continue;
      if (c.species.moves === 'pack' && o.species.id === c.species.id) return false;
      if (++n >= TOKENS) return false;
    }
    return true;
  }

  /**
   * The turn at half health: the stagger, the ring, and the body rebuilt as its moveset
   * looks turned. Whatever was under way is dropped, and a pufferfish lets go of its spot and
   * sets off on the diagonal toward the player.
   */
  private turn(c: Creature, p: Creature) {
    c.wounded = true;
    c.turnT = TURN;
    c.attack = 'none';
    c.salvo = 0;
    c.puffT = 0;
    c.trick = '';
    c.roleCd = Math.max(c.roleCd, 0.4);
    const g = woundedGenome(c.species.moves!, c.genome);
    if (g) {
      c.genome = g;
      c.refreshOrgans();
    }
    // a painted body is turned by the genome above; a sprite cannot read one, and has its
    // turned look drawn as frames of its own, which the flag picks
    c.view.rebuild(c.genome, true);
    if (c.species.moves === 'balloon') {
      c.anchor = null;
      c.aimA = Math.atan2(p.y >= c.y ? 1 : -1, p.x >= c.x ? 1 : -1);
    }
    // an eel turned in its hole comes out of it, along its line, for good
    if (c.burrow) {
      c.burrow = 'out';
      if (c.den) c.aimA = c.den.a;
    }
    if (c.species.moves === 'wane') c.waneT = SPAWN_EVERY * 0.5;
    c.view.hurt();
    this.world.pulses.push({ x: c.x, y: c.y, r: c.radius * 1.8, kind: 'turn' });
  }

  /**
   * What a hostile's death leaves, called once as it is booked (`Combat.slay`): a pufferfish
   * pops into a ring, a nettle buds into its ephyrae. A body swallowed whole leaves nothing —
   * it went down whole.
   */
  died(c: Creature) {
    if (!c.hostile || c.eatenBy) return;
    const moves = c.species.moves;
    if (moves === 'balloon') {
      for (let k = 0; k < SPOKES; k++) this.spine(c, (k / SPOKES) * TAU, c.wounded ? TAUT : 0);
    } else if (moves === 'bloom' && !c.brood) {
      for (let k = 0; k < BUDS; k++) this.bud(c, c.angle + Math.PI / 2 + k * Math.PI);
    }
  }

  /**
   * A siphonophore turned: the colony broken in two where the blow that turned it landed
   * (`Creature.struck`), each piece drawn from its stretch of the picture (`chainPiece`), as big
   * and as healthy as its share of the length, placed where it lay in the whole and thrown a
   * little apart. False for a piece too short to break, which turns as anything else does.
   */
  private split(c: Creature) {
    const art = SPRITES[c.species.id];
    if (!art) return false;
    const root = speciesById(c.species.of ?? c.species.id);
    // this body's stretch of the whole picture, and of its body, in the whole one's columns
    const x0 = art.cut?.x0 ?? 0, x1 = x0 + art.w;
    const lo = x0 + art.tail, hi = x0 + art.snout;
    if (hi - lo < LINK * 2) return false;
    const at = c.struck ? (spriteColumn(c, c.struck.x, c.struck.y) ?? (art.tail + art.snout) / 2) + x0 : (lo + hi) / 2;
    const cut = clamp(at, lo + LINK, hi - LINK);
    const w = this.world;
    const len = art.snout - art.tail;
    const nose = Math.atan2(Math.sin(c.angle), Math.cos(c.angle));
    for (const [a, b, away] of [[x0, cut, -1], [cut, x1, 1]] as const) {
      const sp = chainPiece(root, a, b);
      const pa = SPRITES[sp.id];
      const share = (pa.snout - pa.tail) / len;
      const g = { ...c.genome, size: c.genome.size * share };
      // the column its middle is at, where that column lies in the colony now
      const f = formFor(g, sp.plan);
      const mid = pa.snout - spineAt(0, f) * spriteScale(pa, f);
      const pos = spriteAt(c, [mid + a - x0, art.axis]) ?? { x: c.x, y: c.y };
      const o = w.add(sp, pos.x, pos.y);
      o.genome = g;
      o.view.rebuild(g);
      o.refreshOrgans();
      o.hostile = true;
      o.hold = c.hold;
      o.hp = o.hpMax = Math.max(1, c.hp * share);
      o.fade = 1;
      o.angle = c.angle;
      o.face = c.face;
      o.turnT = TURN;
      o.roleCd = c.roleCd;
      // apart along the colony's line, the way each piece lay from the cut
      const push = Math.max(1, c.genome.speed) * 0.6 * away;
      o.vx = c.vx + Math.cos(nose) * push;
      o.vy = c.vy + Math.sin(nose) * push;
      o.syncView();
    }
    const where = spriteAt(c, [cut - x0, art.axis]) ?? c;
    w.pulses.push({ x: where.x, y: where.y, r: depthOf(c) * 3, kind: 'turn' });
    c.view.hurt();
    w.release(c);
    return true;
  }

  /** One ephyra off a dead bell, thrown along `a`: small, quick, and already pulsing. */
  private bud(c: Creature, a: number) {
    const w = this.world;
    const o = w.add(c.species, c.x + Math.cos(a) * c.radius * 0.4, c.y + Math.sin(a) * c.radius * 0.4);
    o.hostile = o.brood = true;
    o.hold = c.hold;
    o.genome.size = c.genome.size * BUD_SIZE;
    o.genome.speed = c.genome.speed * 1.15;
    o.view.rebuild(o.genome);
    o.refreshOrgans();
    o.hp = o.hpMax = c.hpMax * BUD_HP;
    // most of the way out of the murk already: it is born, not arriving
    o.fade = 0.6;
    o.angle = a;
    o.vx = Math.cos(a) * o.genome.speed * 0.8;
    o.vy = Math.sin(a) * o.genome.speed * 0.8;
    o.surgeT = SURGE;
  }

  private begin(c: Creature, step: Creature['attack'], len: number) {
    c.attack = step;
    c.attackT = c.attackLen = len;
  }

  /** The moment the wind-up gives way: a shot, a ring of them, or the dash. */
  private strike(c: Creature, role: Role) {
    const kind = c.species.shot;
    if (role === 'spitter' && kind) {
      // a volley opens on the spot the player is in, and leads only with its last
      const volley = c.species.moves === 'volley';
      if (volley) { c.salvo = SALVO - 1; c.salvoT = SALVO_GAP; }
      this.spit(c, volley ? 0 : LEAD);
    } else if (role === 'turret' && kind && c.species.moves === 'orbit') {
      this.orbit(c);
    } else if (role === 'turret' && kind) {
      c.volley++;
      const herd = c.species.moves === 'herd';
      if (herd) {
        // the fan at the player, its middle spine down the line to it
        const p = this.world.player;
        const at = Math.atan2(p.y - c.y, p.x - c.x);
        for (let k = 0; k < HERD; k++) this.spine(c, at + (k - (HERD - 1) / 2) * HERD_GAP, 1);
      }
      if (!herd || c.wounded) {
        const turn = (c.volley % 2) * (TAU / SPOKES / 2);
        for (let k = 0; k < SPOKES; k++) this.spine(c, turn + (k / SPOKES) * TAU, 1);
      }
    } else if (role === 'charger') {
      c.landed = false;
      // out of its hole along the line: the rock is let go of until the body is out of it
      if (c.burrow) {
        c.burrow = 'out';
        c.guardCd = 0;
        if (c.den) this.world.pulses.push({ x: c.den.x, y: c.den.y, r: depthOf(c) * 2.5, kind: 'dust' });
      }
    }
  }

  /**
   * An anglerfish's beat: `LURE_N` bolts hung on a circle round its lure, turning, to be let go
   * along their spokes (`Shot.orbit`). Each ring turns the other way from the last, and one
   * spoke runs through where the player was as it formed when the ring lets go: still is hit,
   * and the hold is the time to move. Let go wherever the spin had them, six spokes left a
   * still player between two of them nearly every time.
   */
  private orbit(c: Creature) {
    const w = this.world, tile = w.terrain!.tile, p = w.player;
    const at = lureOf(c);
    c.volley++;
    const spin = c.volley % 2 ? LURE_SPIN : -LURE_SPIN;
    const turn = (c.volley % 2) * (TAU / LURE_N / 2);
    for (let k = 0; k < LURE_N; k++) {
      const a = turn + (k / LURE_N) * TAU;
      const s = w.fire(c, 'bolt', at.x, at.y, a, SHOT_SPEED.bolt);
      if (!s) continue;
      s.orbit = { by: c, a, r: LURE_R * tile, w: spin, hold: LURE_HOLD, speed: SHOT_SPEED.bolt * tile,
                  spokes: LURE_N, aim: { x: p.x, y: p.y } };
      s.life += LURE_HOLD;
    }
  }

  /** One shot from the mouth at where the player will be `lead` seconds on, thrown wide by its stealth. */
  private spit(c: Creature, lead: number) {
    const w = this.world, p = w.player, kind = c.species.shot!;
    const wide = (Math.random() * 2 - 1) * Math.max(0, stealthOf(p)) * STEALTH_AIM;
    const m = spitFrom(c);
    const a = Math.atan2(p.y + p.vy * lead - m.y, p.x + p.vx * lead - m.x) + wide;
    const s = w.fire(c, kind, m.x, m.y, a, SHOT_SPEED[kind]);
    if (s && c.species.moves === 'jet') s.knock = JET_KNOCK * w.terrain!.tile;
    if (s && c.species.moves === 'cloak') s.home = CURVE;
  }

  /**
   * One of a turret's shots out along `a`, from the skin as drawn at `swell` of its full
   * swell: fired from the resting body's, a spine crossed the puffed body in the body's own
   * orange before it was out of it.
   */
  private spine(c: Creature, a: number, swell: number) {
    const kind = c.species.shot!;
    const from = c.radius * 0.6 * (1 + SWELL * swell);
    this.world.fire(c, kind, c.x + Math.cos(a) * from, c.y + Math.sin(a) * from, a, SHOT_SPEED[kind]);
  }

  /**
   * Which way to swim to reach the player: down the room's water, which is straight at it
   * whenever a body's width of water runs straight there (`Flow.toward`), and turned off any
   * rock just ahead. It used to go straight on a clear line and by the water otherwise, and at
   * a corner, where the line opens and closes as the body swims, it swung between the two.
   */
  private way(c: Creature, p: Creature, t: Terrain) {
    return clearHeading(t, c, this.flow!.toward(c.x, c.y, p.x, p.y) ?? Math.atan2(p.y - c.y, p.x - c.x));
  }

  /** The heading `want` eased into from the one steered by last: see `STEER`. */
  private steer(c: Creature, dt: number, want: number) {
    c.steer = Creature.clock - c.steeredAt > STEER_STALE ? want
      : c.steer + angleDelta(c.steer, want) * Math.min(1, dt * STEER);
    c.steeredAt = Creature.clock;
    return c.steer;
  }
}

/** The heading nearest `aim` that a side-on body facing `face` can point, `cap` from level. */
function pitched(aim: number, face: 1 | -1, cap: number) {
  const level = face > 0 ? 0 : Math.PI;
  return level + clamp(angleDelta(level, aim), -cap, cap);
}

/**
 * The heading nearest `desired` with water ahead: feelers out along it at a body and most
 * of a tile, and at half that, and if either finds rock the heading swings out in steps to
 * each side — the side the body is already turning toward first — until one runs clear.
 * Boxed in on every side, it keeps what it wanted and leaves the collision to hold it.
 *
 * Every body that is not the player steers through this, fauna included: before rooms
 * nothing had a wall to avoid, and a school pressed into a ledge reads as broken.
 */
export function clearHeading(t: Terrain | null, c: Creature, desired: number): number {
  if (!t) return desired;
  // a boss's nose is tiles ahead of its middle, and it is the nose that meets the rock
  const front = c.species.boss ? Math.max(c.radius * 0.7, noseReach(c)) : c.radius * 0.7;
  const reach = front + t.tile * 0.7 + Math.hypot(c.vx, c.vy) * 0.2;
  const free = (a: number) => {
    const cx = Math.cos(a), cy = Math.sin(a);
    return !t.solidAt(c.x + cx * reach, c.y + cy * reach) &&
      !t.solidAt(c.x + cx * reach * 0.5, c.y + cy * reach * 0.5);
  };
  if (free(desired)) { c.avoid = 0; return desired; }
  // the side it swung to last, while the rock is still ahead, or else the side it is turning
  // toward; the other only once it is clearly the shorter way round, or a body along a wall
  // took whichever side ran clear first that frame, and wavered between them
  const side = c.avoid || (angleDelta(desired, c.angle) >= 0 ? 1 : -1);
  const bias = c.avoid ? 2 : 0;
  let near = 0, far = 0;
  for (let k = 1; k <= 7 && !(near && far); k++) {
    if (!near && free(desired + side * k * 0.4)) near = k;
    if (!far && free(desired - side * k * 0.4)) far = k;
  }
  if (near && (!far || near <= far + bias)) { c.avoid = side; return desired + side * near * 0.4; }
  if (far) { c.avoid = side > 0 ? -1 : 1; return desired - side * far * 0.4; }
  return desired;
}

/**
 * Where a spitter's shots leave it: the mouth as drawn, for a sprite that marks one
 * (`SpriteArt.mouth`), or the body's mouth, a little inside its radius. On the triggerfish
 * drawn twice its size that was halfway up its head, and its spit came out of its cheek.
 */
function spitFrom(c: Creature) {
  const at = SPRITES[c.species.id]?.mouth;
  return (at && spriteAt(c, at)) ?? { x: c.mouthX, y: c.mouthY };
}
