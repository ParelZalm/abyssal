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
(`PlayerController.strike`), and **every arrow points the body**: left and right flip it
on the spot (`aimAt`), up and down pitch it nose-up or nose-down on the side it already
faces — held a hair off vertical (`AIM_LEAN`) so the level-out and the flip still know
which side it is on, and drawn at the pitch cap. Nothing is thrown until the body points
within `AIM_TOL` (0.3 rad) of the aim, and it pivots there at `PIVOT` (3) times its turn
rate, a constant rate rather than an ease: level to down costs a hatchling about 0.1 s, a
climb into a dive twice that, and a flip nothing. So a new aim has a price, a held one does
not, and fins that turn faster aim faster. The strike leaves from the mouth as it is drawn
(`biteX`/`biteY`, at `drawnAngle`), not where the heading would put it. It is out for 0.2 s
and the bite lands on whatever is in reach while it is (`Combat.strike`); nothing is pulled
in by a gulp, so swimming into prey is not eating it. Strikes come every `ATTACK_EVERY`
(0.33 s) bent by the organs' `biteRate`, which is the HUD's rate.

While an arrow is held, and for `HOLD_FACE` after, the body **strafes** (`Creature.strafe`):
it holds the aim's heading and moves toward WASD whichever way that is, with even drag in
every direction and backing away from where it points held to 0.6 of top speed — a fish
sculls, it does not swim tail first (`Creature.backing`, smooth in the angle). That is
Isaac's walk one way, shoot the other, and it is what kiting is. A strike thrown against the
direction of the swim keeps only a quarter of its lunge: at full strength each strike at a
pursuer threw the body back into it, and a held arrow while retreating stood still.

**The swim is strokes** (`PlayerController.stroke`): a kick every `STROKE_EVERY` (0.25 s)
that drag bleeds into a glide, over a steady `CRUISE` (0.3) share of the old thrust, which
`drive`, `propel` and `strafe` take as `power`. The kick is sized from the drag so the
average is still the speed stat — measured at the stroke's first cut, a held key averaged
the same 116 as the steady swim did — while the body surges to about 1.1 of it and sags to 0.4. A fresh press or a new
direction strokes at once once `STROKE_GAP` (0.13 s) has passed, so a dodge answers the key.
Swimming free, the kick goes down the nose and waits for the body to point within
`STROKE_ALIGN` of the swim: turn, then kick. Strafing, it goes down the swim, cut by the
backpedal. Let go, the body takes `BRAKE` on top of the water's drag and stops in about a tile
rather than coasting two, except while a lunge or a blow's knockback carries it. Each stroke sets `Creature.burst`, which the view reads through `pose` to bunch
the body and throw it long, drives the tail through one sweep (`SNAP`), and puffs wake off
the tail. A bell pulses on its own clock and takes none.

The lunge goes through the boost's old seam, `Creature.kick`: it opens the same surge
window, so what organs did on a boost kick — Ballistic's ram, Flash Sense, Smoke Screen's
puff, a bait ball scattering — they now do on a strike, and the boost modifiers scale its
shove.

**A ranged primary** (Archer Spit, which every larva hatches with, and Spine Volley;
`Organ.primary`) fires the strike instead of biting with it — only the Lunging Bite brings the
bite back, at `strikeOf` (twice) its damage: its shots leave from `biteX`/`biteY` down the aim
carrying half the body's own velocity (`SHOT_CARRY`) — Isaac's tears, which lean with his
walk, so a shot fired right while swimming up drifts up — the body is pushed back a little
rather than forward, and `Combat.strike` lands no bite while one is carried.
The player's shots are `World.shots` like a hostile's, looking for anything alive but the
player — and while a room is locked, only for its hostiles, so a shoal in the line of fire
does not soak up the fight's shots; the bite takes the same rule. One lands as `Combat.hit`
at its share of a bite, carries a little of its way into what it hit, and never swallows.
The kick still opens its window.

**Hitboxes are the drawn body** (`sim/hull.ts`): the spine of `formFor`, sampled nose to tail
root with the outline's half-height at each point, in the facing frame the body is drawn in,
joined into tapered capsules. `surfaceGap(c, x, y)` is what a player's shot, the player's bite
and a hostile's touch measure. It replaced a circle at the middle a third of a size across,
which a darter is 2.2 sizes long around and an eel 4.2: a shot at a mackerel's head passed
through, and so did a mackerel's head on the larva. The tail fan and fins are left out, as
Isaac's hitboxes sit a little inside the sprite; a drifter's touch keeps the old circle
beside the hull for its tentacles. The player's own hitbox is still its middle, small.

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

A room is stocked from its tank's fauna (`Tank.fauna`): `Spawner.stock` rolls a species by
`weight` and places it in open water — a school as a shoal of three to six on one heading,
plankton as a sheet five to nine wide, anything else alone. Each room is dealt a roll of
`FAUNA` (none to ten) the first time the map is made, off the room's own seed, and that
count **only falls**: nothing that dies is replaced, and a room left keeps what was still
swimming in it (`Cell.fauna`, counted in `TankMap.leave`).
**A locked room holds no fauna**: the small fish keep to the rock while there are hunters
about, so a fight is the player and its hostiles alone. When the room is won they come back
out (`TankMap.release`): `HUSH` seconds of empty water, then the room's count comes out over
`EMERGE` seconds, each arrival placed beside the rock and swimming out towards the middle.
**The fauna is not food.** Whatever the player lands on it ends it, bite or shot
(`Combat.damage`); it is not swallowed, fills nothing, and leaves no carcass — the view is
simply dropped (`World.remove`). Where it died is published on `World.felled`, and now and
then (`CRITTER_SPOILS`) it leaves a shell, a half heart or a key (`Pockets.loot`).

**Pots.** A room other than the start and the boss room is dealt up to three clay pots on
its floor (`TankMap.placePots`), handed to the world as `World.pots` — the room's own list,
so a broken pot stays broken. The player's strike breaks one within its bite's reach
(`World.smash`), and the player's shot one it flies into; `World.broken` carries it to
`Game.digest`, which throws the shards (`PotView.shatter`) and rolls the same pool as the
fauna, one time in three (`POT_SPOILS`).
A fight room is also dealt its hostiles, the first time it is entered (`Spawner.hostiles`):
three or four from the tank's table (`Tank.hostiles`, species to weight), no more than
`ROLE_MAX` of one role, placed at least three tenths of the room from the player, with
their first attacks staggered. Guardians are not rolled at all until they come back as bosses (stage 7).

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

A room's rock, sand and boulders are `Terrain` (`sim/terrain.ts`). The template is authored
in tiles, but the rock is the smooth shape they imply: each tile is a sample at its centre,
blended between centres with a smoothstep, bent by broad noise and raised into knobs by a
dome over cellular noise, and a wall runs where that field crosses one half
(`Terrain.field`). A corner rounds, a straight run wanders into a line of knobs the way reef
limestone does, a lone boulder is a lump. The collision holds the field on cells a quarter of a
tile across (`SUB`), built once; off the grid is rock. `World.integrate` moves a body and
then `Terrain.collide`
pushes its circle out of every solid cell it overlaps and takes away the velocity it was
driving into the wall, in two passes so an inside corner settles. The circle is half the
body's radius (`WALL_R`): the radius is half a body length, and side-on a fish is long and
thin, so a full-radius circle held it a head's length off every floor. The nose goes a
little into the rock, which the room draws over the bodies to hide.

A boss is several tiles of armour side-on, and a circle at its middle let the club, the snout
and the tail fan swim through the walls, so a boss holds its whole hull out of the rock
instead (`collideHull`, `World.meetRock`): each of the hull's nine samples pushed out as a
circle of its half-depth, the body carried with it. A sample already inside the rock backs the
body out along its own length, away from the buried end, and no step corrects more than 0.4
of a tile — pushed out whole through the nearest face, a Great White a third of its room long
was thrown through the thin side of a wall and out of the room. A boss that arrives at over
1.5 tiles a second comes off the rock with 0.45 of that speed and a thud (`FishView.bump`):
squashed along the axis that met the rock, sprung off it and settling in three swings, turned
off it by a blow at its end, with grit off the rock over a third of full weight. Its brain
reads the rock through `Creature.onRock` and the hull's nose (`noseOf`, `noseReach`,
`depthOf`), since the nose is tiles from its middle. The bosses are sized to fit their rooms
with it: the mantis shrimp some four tiles long, the Great White seven (they were six and a
half and eleven, and the Great White's hull was in the rock as long as it was out).

**Doors.** A room is built with the sides that have a neighbour (`Terrain.doors`): each is
carved, tiles turned to water from the edge inward along its band until the middle reaches
the room's own water, and off the grid the field is water straight out through it, so the
opening runs on into the room beside. A shut door (`Terrain.locked`) is its gate band — a
tile of collision cells at the edge and a tile past it — made solid; the opening is still
drawn, and `RoomView` draws a grate across it. Off the grid, collision reads the field.

**Steering clear.** Every body that is not the player turns its heading through
`clearHeading` (`sim/roles.ts`) before it swims: two feelers out along the heading, at a
body and most of a tile and at half that, and if either finds rock the heading swings out in
steps of 0.4 rad to each side until one runs clear. The side it swung to is kept
(`Creature.avoid`) while the rock is still ahead, and the other taken only once it is two
steps shorter; otherwise the side the body is already turning toward goes first. A shoal
meeting a ledge turns along it instead of pressing into it, and does not waver along it.

**The way round.** Feelers turn a body off the rock in front of it, not round a pillar
between it and the player. Every hostile goes by a `Flow` field: a Dijkstra distance from
the player's cell over every collision cell that is water with water all round it — ten a
square step and fourteen a diagonal, so open water has one shortest way and not a staircase
of 45° legs, and a few more for each step within three cells of the rock, so the way round a
pillar keeps off its face. It is rebuilt when the player has moved three cells or the doors
have changed (~0.5 ms over the nursery's 9 200 cells). A body reads it by walking down the
field up to 32 cells and aiming at the furthest of them it can swim to straight through the
field's water: straight at the player whenever there is a body's width of water to it, and
round the pillar's shoulder when there is not, with nothing to switch between at a corner.
A read is a few microseconds. An eel's hole has a field of its own (`Roles.elsewhere`), or
one eel would rebuild the player's under every other hostile.

**Easing and the flip.** What a brain asks for is noisy — the field's next leg, a feeler
swinging off the rock, the line to the player opening and closing — so a role eases its
heading in (`Roles.steer`, about a seventh of a second) instead of handing it to `drive`
raw. A body that is not the player then flips only once a heading has been across for
0.12 s, and not again for 0.45 s (`FLIP_COMMIT`, `FLIP_REST`); a spitter or a turret turns to
face the player only once it is half a tile across (`Creature.faceToward`), and mirrors its
heading as it does. Setting `face` alone left the heading on the old side, and
`World.integrate` read the facing back off it and flipped the body home the next frame.
Fast bodies move against the rock in half-cell steps: a barracuda's dash covers half a tile a
frame, and its middle landed inside the rock and was let out by the far face.

## Hostile roles

A hostile does not live in its room the way the fauna does; it has one job, and its role is
how it goes about it (*Role* in `CONTEXT.md`). `Behaviour.think` hands any hostile with a
`Species.role` to `Roles.step` (`sim/roles.ts`) and nothing else about it runs — no flight,
no blood, no band to keep to. Every role is the same small state machine on
`Creature.attack` — wind-up, strike, recovery, then a cooldown on `roleCd` — so every role's
tell is the wind-up pose the view already draws, and `Scene` lights it (see *Lighting* in
`rendering.md`). A body still fading in does nothing, which is Isaac's beat before a room's
monsters move. Distances are in tiles and speeds in tiles a second, so a role reads the same
in every tank.

- **Charger** — closes at a little over half its speed, slower than the player, so it is
  dodged rather than fled; inside six tiles with a clear line it turns square on, winds up
  (0.5–0.9 s by size, tracking the player) and then holds still for `CHARGE_LOCK` (0.3 s)
  with its line fixed, and dashes along that line at 2.1× its speed for 0.4 s, which it
  cannot steer. A dash ends on what it hits. A bar over it (`render/tells.ts`, read through
  `chargeOf`) fills through the tracking part and flashes red once the line is locked: that
  flash is the moment a sidestep is always a dodge. It tracked to the instant it went before,
  which at the game's tempo was a hit nothing could answer.
- **Spitter** — holds four to eight tiles off: backs away when crowded, closes when out of
  range or sight, and otherwise drifts across the player's line. With a line and inside
  eleven tiles it stops, pitches toward the player as far as a side-on fish will, and after
  0.55 s fires one shot a quarter second ahead of where the player is going.
- **Turret** — holds the spot it arrived at (`Creature.anchor`) and fires a ring of eight on
  a 2.4–3 s beat whether it can see the player or not, swelling through the 0.8 s tell. Each
  ring is turned half a spoke from the last.
- **Drifter** — comes on by the shortest water with its heading wobbling about it; the touch
  is its attack.

**Movesets.** A role is the skeleton a species plays on, and a `Species.moves` is how it
plays it (*Moveset* in `CONTEXT.md`): before them every species of a role was the same brain
at another size, and four behaviours across twelve hostiles was what made the rooms between
the bosses flat. A moveset hooks the role's own state machine rather than replacing it, so
the tells, the bar and `Flow` are shared. Three things are common to all of them:

- **The turn.** Under `WOUNDED` (half) of its health a hostile turns once (`Roles.turn`): a
  `TURN` stagger, a `turn` pulse, and its body rebuilt from `woundedGenome`, so the phase is
  on the animal and not only in its timings. Broods never turn.
- **Tokens.** At most `TOKENS` (two) hostiles in a room wind up or strike at once
  (`Roles.free`), and a pack has one dash between its members: Isaac's rooms take turns.
- **Deaths.** `Combat.slay` calls `Roles.died`, which is why `World` owns the `Roles` and
  hands them to `Behaviour`. A body swallowed whole leaves nothing.

The nursery's:

- **Pack** (mackerel) — dealt two at a time (`Spawner.hostiles`); circles the player
  `ORBIT` tiles off, each its own way round and turning back off rock, and dashes one at a
  time. Turned, it is flushed red with its jaw and fins up, and a missed dash chains into a
  second on a `FRENZY_WIND` wind-up before the same lock.
- **Volley** (archerfish) — `SALVO` spits `SALVO_GAP` apart, the first two at the player
  and the last leading twice as far: the grace after a hit makes a burst one hit at most.
  Turned, it keeps to cover between bursts — the nearest water the player cannot see into
  and it can swim to straight — kept while it stays hidden, and comes out for a line.
- **Balloon** (pufferfish) — its ring on the beat, and a puff at a player inside
  `PUFF_NEAR`: `PUFF_HOLD` seconds braced at `PUFF_TAKEN` of every blow (`bracedOf`, in
  `Combat.damage`), through which it fires nothing, then slack. Turned, its spines raised,
  it leaves its spot and bounces on a diagonal at `BOUNCE` tiles a second, `FAN` spines off
  each wall. Dead, it pops into a full ring.
- **Bloom** (sea nettle) — pulses: a kick and a surge at the player, then a coast. Behind
  it hang stings (`ShotKind` `sting`, `World.lob` with `fades`): a hit by touch, sinking and
  thinning through `STING_LIFE`, gone without a splash. Turned, hotter and faster. Dead, it
  buds into `BUDS` ephyrae, half its size and under a third of its health, which the room
  waits on and which leave no stings.

The reef's:

- **Burrow** (ribbon eel) — a charger in a hole in the rock (`Roles.lurk`, `Creature.den` and
  `burrow`), its head `HEAD_OUT` tiles out of the mouth and the rest in the rock, which is drawn
  over the bodies, so a shot meets the rock before anything but the head. A hole is a face found
  straight across, up or down from open water, with rock behind it for the whole body at either
  edge of `LURK_CONE` — the body turns about the mouth as the head follows the player — and
  `DEN_CLEAR` tiles of water in front. In one, the body is placed by its brain: the water does not
  move it (`World.integrate`), the rock does not push it out, and in a floor or ceiling it stands
  straight (`Creature.upright`) with its facing held. It lunges a charger's wind-up, lock and dash
  at a player on its line, swims to the nearest free hole — one with the player on its line
  counts `COVERED` of its distance — and backs in tail first in `BACK_IN`; after `LURK_BORED` with
  nothing on its line it moves to one that has. It arrives in a hole (`Roles.dig`). Turned, it
  leaves the rock for good and is a plain charger.
- **Jet** (triggerfish) — its spit carries a `knock` (`Shot.knock`): `JET_KNOCK` tiles a second
  along its line on the player, landed or not. Between jets it works round to `JET_BEHIND` tiles
  off the player on the far side from the nearest other hostile, and blows once it is within
  `JET_LINED` of that line, or after `JET_WAIT` of waiting. Turned, flushed red, it plays a
  charger (`roleOf`).
- **Herd** (lionfish) — a turret whose beat is a fan of `HERD` spines at the player, `HERD_GAP`
  apart, not a ring: out of a fan is to its side. Turned, flared hot, the fan and the ring at
  once.
- **Wane** (moon jelly) — fades from the room and back on a cycle (`Creature.wane`): past
  `GHOST` it can be neither hit nor hurt (`ghostly`, in `World.canHit` and `Combat.touch`) and
  swims `WANE_HASTE` as hard; `Scene` draws it nearly gone and leaves half its light, which is
  how it is followed. Turned, it stays and buds an ephyra every `SPAWN_EVERY`, `SPAWN_MAX` at a
  time.

The deep's:

- **Line** (barracuda) — hangs `LINE_OFF` tiles across from the player and creeps into its
  row; with the player within `LINE_BAND` of its row, inside its reach and in sight, the
  shortest tell in the deep (`LINE_WIND` and the lock) and a dash along the row until the rock
  stops it (`Roles.wall`, felt a step ahead of the nose; the room's edge counts, or a door on its
  row let it out), stunned for `LINE_STUN`. A charger's dash at its speed is the room in a
  second. Turned, a dash that meets rock comes off it square, turned up to `RICOCHET_AIM`
  toward the player, `RICOCHET` dashes to a run.
- **Gulp** (gulper eel) — a charger that does not dash: with the player in front of its mouth
  it opens its jaw (`GULP_WIND`, no bar: the jaw is the tell) and draws for `GULP_DRAW`, the
  player pulled toward the lips at up to `GULP_PULL` of its cruise, so near them the way out
  is across the cone; the player's shots in the cone are bent in and swallowed (counted on
  `salvo`). The jaw shuts (`snap`) on what it brought, `MAW` tiles of it — a touch in the draw
  does not end it, as it ends a dash — and a gulp that took nothing hangs open for `GULP_GAPE`,
  `exposed`. Turned, the snap spits a fan of `SPRAY` and one more for each shot it swallowed.
- **Cloak** (vampire squid) — its bolts bend after the player at `CURVE` for their first
  `HOME_FOR` (`Shot.home`), then fly on. Turned, a player inside `BALL_NEAR` turns it inside out
  (`Creature.trick` `ball`): `BALL_HOLD` still, its arms swept back over the mantle
  (`FishView.cloak`), taking `BALL_TAKEN` of every blow (`bracedOf`); then a flash and `CLOUD`
  motes of glowing mucus thrown out to hang and sting, thinning through `CLOUD_LIFE`, and a jet
  away for `JET_T`.
- **Lure** (anglerfish) — its beat lets `LURE_MIN` to `LURE_MAX` sparks (`lumen`, a shot kind
  of its own: a violet four-pointed star, turning and twinkling in a wide soft bloom) out of its
  lure (`lureOf`, the sprite's bulb), which flares through the wind-up and burns while they hang
  (`Creature.lit`, `FishView.flare`), to hang at spots `LURE_R` off it on a fan toward the player
  (`Shot.hang`, `World.hangs`), following the lure as it bobs; after `LURE_HOLD` they fire at
  the player one after another, `LURE_GAP` apart, each at where the player is as it goes. Still
  is hit; moving through the hang and the rattle is the dodge. Turned, it always lets out the
  most, and a player inside `LUNGE_NEAR` in sight draws a lunge (`trick` `lunge`, through which
  `roleOf` is the charger's, bar and lock included); it holds wherever the lunge leaves it.
- **Chain** (siphonophore) — the turn is a break (`Roles.split`): the colony is gone into two
  pieces cut where the blow that turned it landed (`Creature.struck`, read along the picture by
  `spriteColumn`), at least `LINK` columns either side. Each piece is drawn from its stretch of
  the picture (`chainPiece`, `cutSprite`), as big as its share of the length and with that share
  of the health left, so breaking adds none; a piece long enough breaks again at half of its
  own. A piece of stem with no bells drifts at `STEM` of the pace and does not squeeze. The
  pieces are booked as the siphonophore (`Species.of`).

A role runs its own attack clock (`Roles.tick`), so `Behaviour.tickStrike` — the ecology's
strike clock — skips a role hostile; run on both, every step went by twice as fast and the
recovery ended with no cooldown. **Ink** over the player hides it: a hostile abandons a
wind-up it has not thrown and drifts until the cloud thins. **Stealth** delays a room's first
attacks (`STEALTH_DELAY`, in `Spawner.hostiles`) and throws a spitter's aim wide (`STEALTH_AIM`).

**Touch.** Any hostile's body against the player's is a hit (`Combat.touch`), Isaac's rule —
a circle of seven tenths of its radius, no reach past the body and no gulp, or a spitter
would pull the player onto itself. `Creature.attacks` is true for a hostile against the
player whatever the sizes, and false against anything else: a bite on a passing fish ends a
strike, and a boss that ate its way out of its own tell had none. Hostiles do not regenerate.

**Shots** are `World.shots`: straight, one speed (`SHOT_SPEED`, in tiles a second — the
player cruises about six), a reach of 0.16 tiles, spent on rock, on the player — landed or
not; a shot breaks on a body in its grace rather than passing through — or after five
seconds. A hit is half a heart through `takeHit` like any other. Firing and breaking are
published as `shot` and `splash` pulses for `Impacts`. A shot's flight is its range over its
speed (`Shot.life`); a hostile's is five seconds.

## Bosses

A tank is built around one (`Tank.boss`), fought in its boss room and fitted to it
(`sim/bosses.ts`). `Behaviour.think` hands a hostile with a `Species.boss` to `Bosses.step`
before anything else. Each fight is the roles' state machine on `Creature.attack` — so the
tell is the wind-up pose and `Scene`'s warm light — and a boss that has missed is `exposed`
for a moment and takes blows half again as hard (`EXPOSED_TAKEN`), as the column's guardians
did. A boss's hit is a whole heart, and its body hurts by touch — except while it is spent,
dazed, wedged or snagged: that is the opening, and a larva that bites has to be against it to
take it. The first tell of each names its answer (`World.tellBy`).

- **The mantis shrimp's punch** (nursery). It sidles 3.5–5.5 tiles off, then cocks its club
  for 0.75 s (0.5 s for the second and third of a combo), tracking the player until the last
  0.3 s, when the line and the spot on it lock under the charge bar (`lockOf`). Then it throws
  itself down the line to the spot, up to four tiles from its club, in 0.16 s. Where the club
  lands the water boils: a burst two tiles across that is the hit, touch or not. Three punches
  and it rests, spent, for 2.2 s. Under half health each burst throws a ring of spray. It used
  to track to the throw, down a fixed 3.5 tiles into a burst three across, and every punch
  landed: locked, the lock and the throw are half a second in which a larva at a cruise is
  three tiles off the spot, so a punch is dodged by moving and never by waiting.
- **The Great White's charge** (reef). It circles six tiles off, turns square on and holds
  for a second, and rushes the line at 2.4× its speed for up to a second — rock ends it, the
  snout meeting the wall. A miss in open water leaves it spent for 1.2 s. Under half health
  such a miss is followed by a second rush on a shorter tell.
- **The Giant Squid's ink** (deep). It keeps five tiles off the player, crossing its line,
  then squirts a cloud and is gone (`Creature.gone`, half a second going): gone it can be
  neither hit nor hurt (`ghostly`), and its light goes with it. Its ghosts show round the
  player (`World.ghosts`, drawn by `render/ghosts.ts` over the lighting): three, five under
  half health, their noses four to six tiles off, to the player's sides within 0.95 rad of
  level, each in water the body fits with an open line to the player. One is the squid. They
  are the squid, arms and all, washed out to a cold pale (`FishView.ghost`), and follow the player for
  1.5 s; for the last 0.45 the lines are locked and the real one resolves — its colours, its
  arms, the tell's ring. Then it lunges from there down its line at sixteen tiles a second,
  as far as the player was and three tiles beyond, and the decoys go. A room fits fewer
  ghosts than that where the pillars cut the lines; never none, since the squid comes out
  where it went in. It had a grab before: arms round the player, a struggle, an arm torn off
  at each escape. Nobody could tell which way to pull, and at its full size it filled the
  room; it is drawn at six tenths now (`Species.drawn`).

**Each boss has a set piece of its own, and a way the room turns on it.** The move is
`Creature.move`; the room's answer is `Creature.stuck` — held fast where it is (`pinX`,
`pinY`) and exposed as long — or a long daze. Each is published once as `World.cue` for a
first-time toast that names the answer (`Impacts`).

- **Mantis shrimp: wedged, and the urchin.** Its boss room is its own, `nursery-den`: two flats
  of rock with a *cleft* down each (`|` in a template), a crack 0.62 of a tile across that the
  larva fits and the shrimp's hull does not. A punch that ends with water straight ahead of
  its nose and rock either side of it within its depth (`Bosses.pinched`), or with its club on
  rock after a larva in a narrow place — the mouth of a cleft, where the lips flare too wide
  to pinch — jams its head in: 3.5 s stuck, no burst. In a cleft the larva stands on its tail
  facing up the crack (`PlayerController.nook`, `Creature.upright`, which lifts `drawnAngle`'s
  pitch cap for the drawing, the hitbox and the mouth alike): it backs in and out facing out,
  fires up it on the up arrow, lies down again for a sideways aim, and tucks itself in on the
  way (`FishView.nestle`). The den runs on a timer: a larva that slips into a cleft the
  shrimp has not jammed in is gone after at once — to the spot where its nose, pointed down,
  is over the mouth (a body pointed down is drawn at a capped pitch, so that is well behind
  the mouth), holding its facing over the last two tiles (`Creature.strafe`) since turning
  there flipped it to and fro across the mouth — and gets one headbutt down it, from the spot
  or after 4 s. Jammed or not, it swims back to the middle of the room and lobs its urchin
  from there; the rain reaches into the cleft, which is what moves the larva on to the other
  one, and round again. It does not punch down the cleft it last jammed in (`Creature.cave`)
  until it has jammed in the other: a larva that stays is rained on from the middle every
  2.5 s. The urchin is dug up through a 1 s tell and thrown (`World.lob`, a shot
  with `heavy`) to the top of an arc a tile under whatever roofs the player's column; there
  it bursts into nine spines, 1.5 tiles apart with one over the player, that sink at up to 3
  tiles a second. It lobs only along an open arc, and an urchin that meets rock before its
  apex breaks there and rains nothing, so a ledge is a roof. Two urchins under half health.
  It also lobs after every second rest, and at a player out of its reach for five seconds.
  Between the set pieces it spits: every 4–7 s at random (3–5 under half health), counted
  through the open fight and fired at its next free moment, it swells still for 0.6 s and
  spits a ring of eight at 3.5 tiles a second, turned at random — over two tiles between
  spokes three tiles out.
- **Great White: dazed, and the breach.** A rush that ends on rock leaves it dazed for 3.4 s,
  where a miss in the open leaves it 1.2 s. After every second charge — every one under half
  health — with the player five tiles over the floor, it dives to the sand under the player,
  lurks there for 1.5 s tracking the player's x with bubbles streaming off its back, turns
  nose-up for the last 0.5 s under the charge bar (`lockOf`), and rushes straight up. The
  roof, an arch or a coral head dazes it.
- **Giant Squid: snagged.** A lunge that meets rock — a pillar stood behind through the
  tell — wraps its arms round the rock (`FishView.grab` on the point) and holds it 3 s; a miss
  in open water leaves it spent 1.2 s. Its set piece is the ink itself.

`Flow` walks the target's own pocket of narrow water out to the open (up to 20 cells), so a
larva in a cleft draws its hunters to the cleft's mouth rather than the rock nearest it.

**The Great White goes by water it fits.** Its `Flow` counts a cell open only with water as
deep as the shark either way up and down, and as wide either side as it reaches at its
steepest drawn pitch (`MAX_PITCH`), which is what going down a shaft takes (`Bosses.flowFor`).
On a fish's flow it was led into the channel over the reef's arch and nose down into the gap
between the arch and the wall, and held there by the rock on every heading for good; the
painted cone of a head had slid through, the sprite's fuller head did not. The other two
keep a fish's: their fights send them to the mouths of clefts and between pillars on
purpose. **A boss is placed** where its whole hull has water round it, else where it has
water as long as it is and as deep, lying level, else where its middle fits
(`Spawner.boss`): without the middle test the shark was put in that same channel, the
farthest water its middle fitted.

**Culling is round the room.** `World.cull` drops anything more than twice the room's half
diagonal from its middle. It was the camera's centre, and just after a slide the camera is
still panning off the last room: a boss put at the far side of its room was culled, alive,
on the frame it arrived, and the room cleared with nothing in it.
