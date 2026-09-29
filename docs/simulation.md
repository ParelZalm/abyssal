# Simulation

All of it is `src/sim/`. `Creature` (`creature.ts`) is one animal; `World` (`world.ts`)
owns the list, the outbox and the three update passes. The passes and the spawner are
classes of their own over it: `Behaviour` (`think`, perception, smell), `Patterns`
(a guardian's set piece), `Combat` (contacts, bites, grasping, bleeding, deaths) and
`Spawner`.

## Swimming

A creature is not a velocity you set. `Creature.propel(dt, turnInput, throttle)` applies
a force along the body axis and lets drag do the rest:

- **`DRAG_FWD = 3.1`, `DRAG_LAT = 9`.** Sideways drag is roughly three times forward
  drag. That single ratio is what makes turns arc, gives the body a keel, and makes
  releasing the throttle a glide rather than a stop.
- **Thrust surges on `beat`.** The swim phase that sways the tail in `FishView` is the
  same phase that scales thrust, so the visible stroke and the felt acceleration are
  locked together. Backing up is a steady scull instead, not a beat.
- **`agility()` falls with speed** — a body already moving fast cannot pivot tightly.
- **`bank`** is the smoothed turn rate, passed to the view to lean the body.

`drive(dt, desiredAngle, throttle, flick)` wraps `propel` for anything that thinks in
headings: the AI, and the player — the cursor and the keys both give a direction on the
screen.

- **Turning back is a flip.** Whenever the wanted heading is clearly on the other side
  (`cos · face` under -0.2, the band `faceFor` holds a facing with) and the body is driving,
  `drive` mirrors the heading about vertical and swaps `face` in one step. It keeps its climb
  or dive, and `FLIP_KEEP` 0.45 of its speed, so it is checked and drifts the old way for an
  instant. Every body but a bell.
- **`flick`** is extra turning authority for what is left, the pitch: tapered to `1 + flick`
  at the widest, so a dive thrown into a climb snaps rather than arcs. Only the player passes
  one (`FLICK` in `PlayerController`, 6), so the chases tuned against the ordinary rate hold.
- The controller eases throttle to 0.3 while the body points away from where it wants to go,
  so a hard turn pivots instead of arcing under full power.

Side-on, two rules keep bodies looking like fish in profile:

- **Idle levels out.** Under a fifth of throttle, `propel` eases the heading back toward
  level, whichever way the body faces. Bells (`pulseEvery`) are exempt.
- **Pitch by activity.** `Behaviour.think` runs every heading it settles on through
  `levelled`, capped by `STEEP`: 0.5 rad cruising, schooling and idling, 0.8 on a scent,
  1.15 in a chase or a bolt. A hunter under prey climbs on a slant, not straight up.
  Plankton and drifters are carried, and are exempt.

Every animated turn-back — a roll about the spine, a yaw folding nose to tail — was tried
and undone; see `decisions.md` for why the flip landed where the earlier flips did not.

### Strikes

A hunter does not simply swim into its prey. `Behaviour.strike` runs a small state machine
on `Creature.attack`, started on prey already ahead of it and inside 2.4 × its bite reach:

1. **Wind-up** (`WINDUP`, 0.12 s for a small body up to 0.42 s for a big one): throttle
   drops to 0.12 while it keeps aiming. This is the tell — the view coils the body and
   opens the jaw — and it grows with size, so a shark visibly gathers itself.
2. **Strike** (0.32 s): a kick of 0.95 × top speed along the heading and full throttle.
   A bite ends it early.
3. **Recover** (0.4 s): easy throttle, jaw shut.

Contacts still bite at any time; the strike is the approach. Tentacled bodies never wind
up — they strike with their arms (`Combat.grasp`). An ambusher's `lunge` is now set by the
strike, which is what makes it settle back afterwards. Guardians' tells and rushes read the
same way to the view through `Creature.pose`.

### The player's strike

The player does not bite on contact. The arrows throw a strike one of four ways
(`PlayerController.strike`): left and right turn the body to face it, up and down leave it
level and move the bite above or below the head (`Creature.aimY`, read by `biteX`/`biteY`),
since a fish pointed straight up stands on its tail. The strike is out for 0.2 s and the
bite lands on whatever is in reach while it is (`Combat.strike`); nothing is pulled in by a
gulp, so swimming into prey is not eating it. Strikes come every `ATTACK_EVERY` (0.4 s)
bent by the organs' `biteRate`, which is the HUD's rate.

While an arrow is held, and for `HOLD_FACE` after, the body **strafes** (`Creature.strafe`):
it stays level and facing the attack and moves toward WASD whichever way that is, with even
drag in every direction and backing away held to 0.6 of top speed — a fish sculls, it does
not swim tail first. That is Isaac's walk one way, shoot the other, and it is what kiting
is. A strike thrown against the direction of the swim keeps only a quarter of its lunge:
at full strength each strike at a pursuer threw the body back into it, and a held arrow
while retreating stood still.

The lunge goes through the boost's old seam, `Creature.kick`: it opens the same surge
window, so what organs did on a boost kick — Ballistic's ram, Flash Sense, Smoke Screen's
puff, a bait ball scattering — they now do on a strike, and the boost modifiers scale its
shove.

## Perception and behaviour

`Behaviour.think(c, dt, player)` runs per creature, per frame, and is the whole AI:

- A **player lure** overrides everything for prey that the player could eat, within
  `240 + lure * 340` — checked before the behaviour switch, because that is the point of
  the organ.
- `plankton` and `drift` ignore the world and follow slow sinusoidal wander.
- Everything else looks for the nearest thing that `preysOn(c)` inside `genome.sense`
  and flees it, then for prey it can eat and chases that. `stealth` on the player is a
  per-creature roll against being noticed (`rngLike(c)`, a cheap positional hash — not
  the seeded `Rng`, deliberately, so perception never desyncs the run seed).
- `ambush` species sit still until `lunge` expires; `school` species take their heading
  from `flock`.

`canEat` is `swallowSize > other.size * 1.02`, and `swallowSize` grows with `jaw`; it is
the raw size test behind the red danger tint and the dread uniform. `preysOn` is that plus
the kin rule, and is what threat, prey and contacts actually go through.

`flock(c, radius)` is boids without a neighbour list: alignment to the neighbours' average
heading, cohesion toward their centre weighted by how far out the fish has drifted, and
separation from the one that is genuinely too close. Throttle falls off the same weight, so
the core loiters while the rim drives — a school where everyone cruises at one speed cannot
hold station and orbits itself apart. Steering at the single nearest neighbour, which this
replaced, settles a shoal into pairs within seconds of arriving.

## Contacts

`resolveContacts` pairs overlapping creatures once per frame (`pair(a, b)` dedupes),
then `strike` decides what happens:

- `preysOn` gates every contact and every perception roll, and carries two rules `canEat`
  does not. **Kin**: a species is a size *range*, so the bare size test had the 7 cm end of
  a krill swarm eating the 4 cm end and half of every school fleeing its own shoal.
  **`hunts`**: only `hunter`, `ambush` and `apex` strike at all. Letting everything with a
  mouth eat gutted the shallows — an anchovy shoal is bigger than a krill swarm, so it ate
  its way through every swarm it crossed and the first minute of a run had nothing left in
  it to catch. The red danger tint in `Scene.draw` goes through the same predicate, so
  something that cannot actually eat you never glows as though it could.
- Small enough to swallow → gone in one, credited through `slay`.
- Otherwise a `bite`, on `biteCd`, with `biteDamage(genome)` against `armor`.
- `venom` leaves `poison` on the victim with `poisonByPlayer` recorded, so a kill that
  lands after the mouth has let go is still the player's.
- Every bite pushes a `Bite` record onto `world.bites`; `Game.digest` hands it to `Impacts`.
- Plans with `PLAN_ART.grasp > 0` (the squids) never bite on contact. `Combat.grasp`
  latches the feeding tentacles on prey up to `size × grasp` past the mouth, in a forward
  cone, then reels it to the crown and bites there — never whole, and only after 0.9 s
  held, so a guardian's grab is a struggle and not an instant death. The catch escapes
  by building `strain`: its `thrust × speed` against the holder's speed scaled by a root
  of the size ratio, plus any outward burst the grip damping has not eaten yet (a strike's
  lunge). Cruising never breaks free; striking away from the holder is the answer.
  Effort is read from `thrust`, not velocity, because the grip damps velocity. A holder
  does not throttle and does not lunge on its bites — either one feeds back through the
  reel and the pair drifts apart with no strain at all. `world.playerHeld` is published
  for the HUD.

The player's own eating is not special-cased here — `playerGain` accumulates nutrition
and `main` converts it into biomass, size and particles.

## Population

A room is stocked from its tank (`Tank.fauna`, `Tank.population`): `Spawner.stock` rolls a
species by `weight` and places it in open water — a school as a shoal of three to six on
one heading, plankton as a sheet five to nine wide, anything else alone — and the room is
topped back up as bodies die. That keeps a room alive while there is nothing else in it;
fight rooms, hostiles and rooms that stay cleared come with stage 3 of the roadmap.
Guardians are not rolled at all until they come back as bosses (stage 7).

**Where a body is placed.** `Terrain.openSpot` draws points in the room and **rejects**
anything without enough water around it, never nudges one out of the rock — a nudged point
is a body half inside a boulder. A group member that would land in rock is simply not
placed: a shoal against a wall is a smaller shoal. Every room animal carries
`Creature.hold` set to the room's water, since its species' own depth range would steer it
into the ceiling or the floor.

**Never at the origin.** `add` places the view and hides it before returning. A fresh
`FishView` is a Container — visible, opaque, at its own origin, which is world (0, 0) — and
the room is topped up *after* `Scene.draw` has decided what every creature looks like this
frame. Without those two lines every spawn is drawn once, at full alpha, in the corner of
the world, and then snaps to where it really is on the next frame.

**Fading in.** Every body carries `fade`, 0 to 1 over `FADE_IN`, exposed as `emergence`
and multiplied into the alpha `Scene.draw` hands `view.show`. A room has no off-screen to
hide an arrival in, so every one resolves out of the murk. The player is born whole.

## Blood

A kill pushes a `Blood` onto `world.blood` — a position, the body length of what died, and
a countdown — and onto `world.spilled`, the per-frame event `Impacts.drain` draws
the cloud (`Fx.blood`, and `bloodColour` for the depth: red is the first thing the water
takes, so a cloud in the Abyss is a black smear and not a crimson one).

`smell(c, sense, keen)` is the mechanic half. Reach comes off **what died** rather than off
the nose — a krill leaves nothing worth crossing water for, a guardian leaves a cloud half
the zone can taste — with `sense` as a multiplier on it, so a bloodhound build is a real
one. The pick is by strength and not by distance, or the whole thing is just "swim to the
nearest corpse". Prey always beats blood: a hunter that can see something alive ignores the
cloud.

Guardians get `keen` 0.45 and a separate steering rule: the lean is applied to their
**wander** rather than to their current heading, and they do not speed up. Blending off the
heading converges on the spot within seconds however small the weight, because every frame
closes a fixed fraction of what is left — which is a summons, not a nudge. What you get
instead is a guardian that drifts your way when something large dies under its nose.

Every `Blood` carries the `kind` (plan) of what bled, and a drip from a bleeding body
(Vivisect) carries its `from`, which cannot smell its own. **Sharks are the exception to
blood as a lure**: `smell` skips shark blood for a shark, and `smellDeath` turns any shark
— the Great White included — away from shark blood inside 0.6 of the reach that would
draw it to another kill, whatever it was hunting. Killing a reef shark clears the water of
sharks for as long as its cloud lasts (up to 14 s), and a bleeding shark carries the
warning with it.

## Tactics

Three animals are beaten by behaviour rather than by size:

- **Bait balls.** A schooling body with six or more of its own kind within
  `3 × size + 40` is `balled`: a bite that has to tear glances off it (a gulp that would
  swallow it whole still works), and the player is told to scatter it. Every strike
  (`Creature.kicks`, answered once in `World.update` by `Behaviour.scatterFrom`) scatters schooling bodies within
  `4 × radius + 220` of the player — they bolt outward, panicked, and are loose for 3 s.
- **Shark blood**, above.
- **The anglerfish's lure.** NPC anglerfish carry `lure` 1. On anything but the player the
  `lure` organ's `onTick` is a trap: whatever touches the bulb — placed by `lureBulb`, the
  same point the paint hangs it at — is struck for 2.5 bites at once, whatever its size,
  and the angler lunges. From behind or beside it is prey like any other.

**Guardians have patterns** (`Species.pattern`, run by `Patterns.patternStep` ahead of the
rest of `think`): a tell, a committed attack, and an opening. Each starts only on a
guardian already hunting the player, within 0.7 of its sense and outside its own length,
and comes round every 6 s.

- `charge` (Great White): 1.1 s lining up — slow, turning to face you, a red
  ring and a tighter frame — then a 0.9 s rush at 2.4× its speed on a heading locked a
  third of a second ahead of you. The rush cannot steer and bites for 1.8 × only what is
  in its line: none of the lunge's extra reach and no gulp, which is what makes the dodge
  possible. At 110 cm a sidestep at a boost's 300 u/s once the rush starts clears it; at
  200 u/s it does not. A miss leaves it `exposed` for 2.5 s — slow, lazy, and taking every
  bite at 1.5 ×.
- `click` (Sperm Whale): 1.4 s of three clicks, then a blast in a cone of 0.6 rad either
  side of its head out to 0.85 × sense that stuns the player for 1.3 s (no drive, no boost)
  and lands half a bite; then the same rush. Behind it or beside it, nothing.
- `suck` (Leviathan): 0.9 s gaping and turning to face you, then a 1.4 s draw. It hangs
  where it is, heading fixed, and everything smaller in a cone of 0.8 rad either side of its
  head out to 2.2 body lengths is pulled toward the mouth — hard enough to hold a drift of
  twice the victim's own cruise at the lips, falling to nothing at the edge — with pale
  streaks running in and the small fish in front of it going with them. Its ordinary bite
  is off for the draw (`Combat.strike`); when it ends the jaw snaps, biting the player for
  2.2 × if it is within the mouth's reach, and the snap uses the bite cooldown so contacts
  that frame cannot bite again. Cruising straight out escapes from outside half the range,
  a boost from all but the lips, and from beside or behind it there is no pull at all. A
  miss leaves it `exposed`, as the charge does.
- The squids keep their arms: a grab you tear free of by striking away.

The patterns were tuned against the boost, which the rework took out; they are refitted to
one screen and the strike with the bosses (roadmap stage 7).

The first tell from each guardian toasts its counter (`world.tellBy`); after that the
tell has to be read.

## Notice

A guardian ignores anything smaller than `noticeSize(zone)`, which is interpolated between
the gate that opens its zone and the gate that opens the next. It has seen you and does not
care, which is the scene that sells a zone. `Behaviour.notices` gates the prey filter;
`noticedBy` publishes the instant one turns toward the player and `hunted` stays true while
any is chasing. `Game` turns those into a spike-and-sustain envelope on the water shader's
`uDread`. Stealth multiplies the threshold up. See
[adr/0002](adr/0002-guardian-notice-is-measured-against-the-zone.md) for why the threshold
is not a share of the guardian's own body, which was tried first and is backwards.

Population target itself falls with depth (`POP_SHALLOW` 140 → `POP_DEEP` 46 in
`run/Bands.ts`, applied by `Bands.stock`) because deep creatures are far larger, and by up to 30% more in a band the
player has overstayed — see `spendWater` in `progression.md`. `rollSpecies` takes that
band's `world.spent` too, read at the spawn point rather than at the player. The shallow figure went up when groups
went in: the same budget spread evenly reads as crowded, and spent on a handful of big
shoals it buys a frame with one shoal in it and dead water everywhere else. Measured at
420 m: 138 bodies, 95 of them in frame, 115 fps. At 6300 m: 75 bodies, 40 in frame.

## Walls

A room's rock, sand and boulders are `Terrain` (`sim/terrain.ts`), a tile grid in world
space; off the grid is rock. `World.integrate` moves a body and then `Terrain.collide`
pushes its circle out of every solid cell it overlaps and takes away the velocity it was
driving into the wall, in two passes so an inside corner settles. The circle is half the
body's radius (`WALL_R`): the radius is half a body length, and side-on a fish is long and
thin, so a full-radius circle held it a head's length off every floor. The nose goes a
little into the rock, which the room draws over the bodies to hide.

Nothing steers around a wall yet: a shoal that heads for one presses against it until its
wander turns it. The hostile roles (roadmap stage 4) are where avoidance belongs.
