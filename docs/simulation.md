# Simulation

All of it is `src/game/world.ts`, about 420 lines. `Creature` is one animal; `World`
owns the list and the rules between them.

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

`drive(dt, desiredAngle, throttle)` wraps `propel` for anything that thinks in headings:
the AI, and the player in mouse mode.

## Perception and behaviour

`World.think(c, dt, player)` runs per creature, per frame, and is the whole AI:

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
  it to catch. The red danger tint in `main.render` goes through the same predicate, so
  something that cannot actually eat you never glows as though it could.
- Small enough to swallow → gone in one, credited through `slay`.
- Otherwise a `bite`, on `biteCd`, with `biteDamage(genome)` against `armor`.
- `venom` leaves `poison` on the victim with `poisonByPlayer` recorded, so a kill that
  lands after the mouth has let go is still the player's.
- Every bite pushes a `Bite` record onto `world.bites`; `main.digest` drains it.
- Plans with `PLAN_ART.grasp > 0` (the squids) never bite on contact. `World.grasp`
  latches the feeding tentacles on prey up to `size × grasp` past the mouth, in a forward
  cone, then reels it to the crown and bites there — never whole, and only after 0.9 s
  held, so a guardian's grab is a struggle and not an instant death. The catch escapes
  by building `strain`: its `thrust × speed` against the holder's speed scaled by a root
  of the size ratio, plus any outward burst the grip damping has not eaten yet (a boost
  kick). Cruising never breaks free; sprinting does slowly; boosting is the answer.
  Effort is read from `thrust`, not velocity, because the grip damps velocity. A holder
  does not throttle and does not lunge on its bites — either one feeds back through the
  reel and the pair drifts apart with no strain at all. `world.playerHeld` is published
  for the HUD.

The player's own eating is not special-cased here — `playerGain` accumulates nutrition
and `main` converts it into biomass, size and particles.

## Population

`spawnAround(cx, cy, viewR, target, inner?)` tops the list up to `target` creatures,
rolling species by `weight` and by whether the depth falls in their range. A species
belongs to exactly one zone (optionally to one band of it) and carries a `bleed` in world
units, which is how far past its home it strays; `rangeOf` precomputes the result at boot.
A vertical migrator is a species with a wide bleed, not a species of two zones. `cull`
drops anything outside the radius.

**Where a body is placed.** `spot` draws a point in a ring around the camera and
**rejects** anything outside the water rather than clamping it. Clamping y was what
stacked the shallows: every draw that fell above the surface landed on the same depth, and
`weightAt` boosts plankton hardest exactly there, so a third of every fill near the top
arrived as krill and bloom piled onto one line at 40 m. The ring starts just past the
corner of the screen (`RING`), so an arrival swims in rather than appears; apexes come from
further out still (`RING_APEX`), because a guardian standing at the frame's edge merely
exists there. An ambusher is then pulled toward the bottom of its own water. The first fill
of a run passes a small `inner` — there is no frame to protect yet, and an empty opening
screen is worse than a fade.

The anchor is only half of it: a group reaches ±95 around its own anchor, so an anchor just
under the lid used to pile part of its sheet onto y = 40 via `add`'s backstop clamp — the
same stack, one level down. `fold` mirrors a member's offset back into the water instead,
which keeps the density and gives a sheet lying against the surface the one-sided shape it
should have. `add` still clamps, but nothing should now reach it: if bodies ever appear
stacked on one depth again, something has started clamping y instead of re-rolling or
folding it.

**Never at the origin.** `add` places the view and hides it before returning. A fresh
`FishView` is a Container — visible, opaque, at its own origin, which is world (0, 0) — and
`Game.render` tops the population up *after* it has decided what every creature looks like
this frame. Without those two lines every spawn in the game is drawn once, at full alpha,
in the corner of the world, and then snaps to where it really is on the next frame or
vanishes when `show` finally reaches it. The player hatches at (0, 260), so that corner is
a fixed point just above the start: creatures flickered into being and teleported away
there for the whole run.

**Fading in.** Every body carries `fade`, 0 to 1 over `FADE_IN`, exposed as `emergence`
and multiplied into the alpha `main.render` hands `view.show`. Anything spawned off-screen
finishes it unseen; the cases that cannot be — the first fill, and the thin water above you
in the shallows where there is no off-screen to hide in — resolve out of the murk instead.
The player is born whole.

**Groups.** `groupSize` scales the count off the body, so the smaller the animal the larger
the group, capped by the room left under the population target — and deliberately smaller
than that budget could afford, because many small groups populate the whole frame where a
few big ones populate a corner of it. `flock` merges two that drift together, so the big
shoal still happens; it is just not the only thing in the water.

`shoal` places a school as a school: one heading, one lens of bodies stretched along it,
everyone already at cruising speed — a box of independent strangers reads as a spawn.
`patch` places plankton as a layer, far wider than it is tall. Half of all schooling rolls
(`STRAY_CHANCE`) go to `strays` instead: one to three of the species, loose, spread wide
and each going its own way. A schooling species is not a species that is always in a
school, and without the strays the ocean is a row of set pieces with nothing between them.

- The **difficulty ramp** is one straight line over the whole column (`weightAt`), not a
  tutorial shelf and a separate deep ramp with flat water between them — two curves is a
  step you can feel crossing, and the run should get harder the whole way down rather than
  twice. Hunters, ambushers and guardians run 0.15× their weight at the surface to 2.1× at
  the floor; schools and plankton run the other way. Measured over 30 fills: 35 predator
  rolls at 300 m against 597 at 8400 m, with food bodies falling 17.5k to 5.8k.
- **Guardians** are in the spawn pool like anything else — one is alive in its zone from
  the moment the player first arrives. `World` holds each to a single instance and keeps
  it in `deadGuardians` once killed, so a guardian is gone for the run rather than on a
  respawn timer. Killing the Trenches' guardian (`FINAL_GUARDIAN`) ends the run; the other
  four just grant a very large meal.

## Blood

A kill pushes a `Blood` onto `world.blood` — a position, the body length of what died, and
a countdown — and onto `world.spilled`, the per-frame event `Game.digest` drains to draw
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

## Notice

A guardian ignores anything smaller than `noticeSize(zone)`, which is interpolated between
the gate that opens its zone and the gate that opens the next. It has seen you and does not
care, which is the scene that sells a zone. `World.notices` gates the prey filter;
`noticedBy` publishes the instant one turns toward the player and `hunted` stays true while
any is chasing. `Game` turns those into a spike-and-sustain envelope on the water shader's
`uDread`. Stealth multiplies the threshold up. See
[adr/0002](adr/0002-guardian-notice-is-measured-against-the-zone.md) for why the threshold
is not a share of the guardian's own body, which was tried first and is backwards.

Population target itself falls with depth (`POP_SHALLOW` 140 → `POP_DEEP` 46 in
`main.ts`) because deep creatures are far larger, and by up to 30% more in a band the
player has overstayed — see `spendWater` in `progression.md`. `rollSpecies` takes that
band's `world.spent` too, read at the spawn point rather than at the player. The shallow figure went up when groups
went in: the same budget spread evenly reads as crowded, and spent on a handful of big
shoals it buys a frame with one shoal in it and dead water everywhere else. Measured at
420 m: 138 bodies, 95 of them in frame, 115 fps. At 6300 m: 75 bodies, 40 in frame.

## Bounds

`WORLD_HALF_W` clamps x. `world.descentLimit`, set every frame by `main` from
`zones.descentLimit(size)`, clamps the player's y and sets `world.blocked` on the frame
they press against it — that flag is what raises the "too small" toast.
