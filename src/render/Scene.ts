import { Graphics } from 'pixi.js';
import { clamp, dist2 } from '../core/util';
import { sightOf } from '../content/genome';
import { DEPTH_MAX } from '../content/zones';
import type { Phase } from '../run/phase';
import { noseOf } from '../sim/hull';
import { feelOf, stealthOf } from '../sim/organs';
import type { Creature } from '../sim/creature';
import type { World } from '../sim/world';
import type { Dread } from './Dread';
import type { View } from './view';
import type { Lighting, Light } from './lighting';
import { lightAt, type Water } from './water';

/** The cast on a body the ampullae found but the eyes could not: cold, like the field. */
const FELT_TINT = 0x9fc4ff;
/** A chilled body, frosted pale, and a burning one, gone the vent's sulphur. */
const CHILL_TINT = 0xc8ecff;
const BURN_TINT = 0xf0ffa8;
/**
 * How much of a hidden animal's stealth the player's eyes lose it by, at a distance. Under
 * 1 on purpose: a lurking ribbon eel at the reef can swallow a hatchling, and one that was
 * wholly invisible until it struck would be a death with no read. At 0.8 stealth it is two
 * fifths as clear as it would be, which is a shape to notice and not one to count on.
 */
const HIDDEN = 0.75;
/** The light every player body throws into the water, on top of what its organs add. */
const LARVA_LIGHT = 0.9;
/**
 * How far the larva's own light reaches, in body radii: a pool some four body lengths
 * across, the reference's, which is what the player sees the room by.
 */
const POOL = 11;
/**
 * A hostile's own light: a faint cool presence, so a room's hostiles can be found in the dark
 * outside the larva's pool, which flares warm and wider through a wind-up. The wind-up pose is
 * every role's tell (`Creature.pose`), and a pose in the dark is not a tell; the light is what
 * makes it one. Reach in body radii.
 */
const PRESENCE = { r: 2.4, a: 0.3, color: [0x9f, 0xb4, 0xd8] };
const TELL = { r: 2, a: 0.95, color: [0xff, 0x7a, 0x4a] };
/**
 * The light on a hostile confused by the player's ink (`Creature.confused`): pale, and wider than
 * its presence, so the room it was hiding in shows every body in it while the ink lasts.
 */
const LOST = { r: 3, a: 0.75, color: 0xe8ecff };
/**
 * How much of a waned moon jelly is gone (`Creature.wane`): its body all but, and its light
 * only half, so it is followed by the glow it leaves while it cannot be seen or hit.
 */
const WANED = 0.92;
const WANED_LIGHT = 0.5;

/**
 * What the player can make out this frame: which bodies show and how clearly, the ring
 * around your own, and the water pass.
 */
export class Scene {
  /** The membrane of awareness around your own body, so you never lose yourself. */
  readonly focus = new Graphics();

  private readonly shine: Light[] = [];

  constructor(private readonly water: Water, private readonly lighting: Lighting) {
    // drawn large and scaled down, so the curve stays smooth at any zoom
    this.focus
      .circle(0, 0, 100).stroke({ color: 0xdffdf2, width: 4.5, alpha: 0.38 })
      .circle(0, 0, 94).stroke({ color: 0xdffdf2, width: 12, alpha: 0.05 });
  }

  /**
   * Draw the frame and return how frightening it is, for the HUD. `lights` are the room's
   * standing lights — the decoration's — added to what the bodies throw.
   */
  draw(view: View, world: World, p: Creature, phase: Phase, dread: Dread, lights: readonly Light[],
       ambient?: number) {
    // close round the body: at 4.4 radii it was a bubble a room's width of fish swam inside
    const halo = p.radius * (3 + Math.sin(view.t * 1.1) * 0.1);
    this.focus.x = p.x;
    this.focus.y = p.y;
    this.focus.scale.set(halo / 100);
    this.focus.visible = phase !== 'over';

    // Visibility: the deeper you are, the more you rely on sense and their glow — and past
    // the reach of the eyes, on whatever the body feels without them (`feelOf`)
    const light = lightAt(p.y);
    const sense = sightOf(p.genome, light);
    const feel = feelOf(p);
    const edgeX = view.w * 0.55, edgeY = view.h * 0.55;
    let danger = 0;
    for (const c of world.creatures) {
      const d = Math.sqrt(dist2(c.x, c.y, p.x, p.y));
      // a chill frosts the body over and a burn yellows it, so a struck hostile says what is
      // still working on it after the flinch is gone
      let tint = c.chillT > 0 ? CHILL_TINT : c.burnT > 0 ? BURN_TINT : 0xffffff;
      // dazed by the Angler's glow: drained grey through the skin, eased in and out over a fifth of a second
      c.view.dazed = Math.min(1, c.dazzled * 5);
      if (c.hostile) {
        // nothing swallows the player now, so the frame no longer closes on whatever could:
        // it closes on a hostile with its body nearly on the player's, gap not centres, and
        // only by half — a room is full of them, and the edge would never open otherwise
        const gap = d - c.radius - p.radius;
        const near = c.radius * 2 + 40;
        danger = Math.max(danger, clamp(1 - gap / near, 0, 1) ** 2 * 0.5);
      }

      // anything outside the frame skips its art entirely — it still swims and hunts
      const r = c.radius * 2;
      const seen = Math.abs(c.x - view.x) < edgeX + r && Math.abs(c.y - view.y) < edgeY + r;
      let alpha = 1;
      let felt = false;
      if (seen && light <= 0.75) {
        const own = c.genome.glow * 260 + c.genome.size * 3;
        const vis = clamp(1 - (d - sense - own) / (sense * 0.55), 0, 1);
        alpha = clamp(light * 1.35 + vis, 0.02, 1);
        // felt, not seen: the whole body shows, in a cold cast, so the player can tell a
        // shape found by the ampullae from one the eyes resolved. A wounded field carries
        // twice as far, which is what makes a bleeding or poisoned animal findable
        const hurt = c.hp < c.hpMax * 0.5 || c.bleedT > 0 || c.poisonT > 0 || c.stun > 0;
        if (feel > 0 && alpha < 0.9 && d - c.radius < feel * (hurt ? 2 : 1)) {
          alpha = 1;
          felt = true;
          if (tint === 0xffffff) tint = FELT_TINT;
        }
      }
      // an animal that hides is hidden from the player's eyes as the player's stealth hides
      // it from theirs: faint at a distance and found up close, a few body lengths out. A
      // body felt by its field is not found by its outline, so the ampullae see through it
      if (seen && !felt) {
        const gap = d - c.radius - p.radius;
        alpha *= 1 - clamp(stealthOf(c), 0, 0.8) * HIDDEN * clamp(gap / (c.radius * 4 + 80), 0, 1);
      }
      // an off-screen view is not placed (see `World.integrate`), so it still sits wherever
      // it left the frame; reveal it without moving it and it draws there for a frame and
      // then snaps across the screen — worst along a seal, where band-holding bodies bob
      // across the frame edge all the time
      if (seen && !c.view.visible) c.syncView();
      // confused by the ink, it is in plain sight whatever the dark and its own stealth: the
      // ink is the player's, and what it buys is a clear look at the room
      if (c.confused > 0) alpha = 1;
      c.view.show(seen, alpha * c.emergence * (1 - c.wane * WANED) * (1 - c.gone), tint);
    }

    const level = dread.level(danger);
    // the player blinks through the grace after a hit, the way Isaac does: it says both that
    // the hit landed and that the next one cannot yet
    if (phase !== 'over') {
      const blink = p.invuln > 0.35 && Math.floor(view.t * 16) % 2 === 0 ? 0.3 : 1;
      p.view.show(true, blink, 0xffffff);
    }
    // the lights the frame is made of: the larva's pool first, then every lamp in the room
    const lit = this.lighting;
    lit.begin(ambient);
    if (phase !== 'over') {
      lit.add({ x: p.x, y: p.y, r: p.radius * POOL, color: 0xd6e2ff, a: 1 });
    }
    this.shine.length = 0;
    p.view.shine(this.shine);
    for (const c of world.creatures) c.view.shine(this.shine);
    for (const c of world.carcasses) c.view.shine(this.shine);
    for (const l of this.shine) lit.add(l);
    for (const c of world.creatures) {
      if (!c.hostile || !c.alive || !c.view.visible) continue;
      const k = c.attack === 'windup' ? 1 - c.attackT / c.attackLen : 0;
      const [r, g, b] = PRESENCE.color.map((v, i) => Math.round(v + (TELL.color[i] - v) * k));
      // an eel in the rock lights the water at its head, not the rock round its middle
      const at = c.burrow ? noseOf(c) : c;
      // a squid in the rock's colour gives no more away by its light than by its body
      lit.add({ x: at.x, y: at.y, r: c.radius * (PRESENCE.r + TELL.r * k), color: (r << 16) | (g << 8) | b,
        a: (PRESENCE.a * (1 - c.camo) + TELL.a * k) * c.emergence * (1 - c.wane * WANED_LIGHT) * (1 - c.gone) });
      if (c.confused > 0) {
        lit.add({ x: at.x, y: at.y, r: c.radius * LOST.r, color: LOST.color, a: LOST.a * Math.min(1, c.confused) });
      }
    }
    for (const l of lights) lit.add(l);
    // a tank has no thermocline: the shader's seal is put below the floor of the world, open.
    // The player carries a light of its own whatever its organs: a larva is the brightest
    // thing in the tank (`docs/media/reference/`), and the pool it throws is how you find it
    this.water.update(view, LARVA_LIGHT + p.genome.glow, phase === 'play' ? level : 0,
      DEPTH_MAX * 2, true, { x: p.x, y: p.y, r: p.radius * 7 });
    return phase === 'over' ? 0 : level;
  }
}
