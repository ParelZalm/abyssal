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
- Everything else looks for the nearest thing that `canEat(c)` inside `genome.sense`
  and flees it, then for prey it can eat and chases that. `stealth` on the player is a
  per-creature roll against being noticed (`rngLike(c)`, a cheap positional hash — not
  the seeded `Rng`, deliberately, so perception never desyncs the run seed).
- `ambush` species sit still until `lunge` expires; `school` species steer toward
  neighbours of the same species.

`canEat` is `swallowSize > other.size * 1.02`, and `swallowSize` grows with `jaw`. It is
the single predicate behind threat, prey, the red danger tint and the dread uniform.

## Contacts

`resolveContacts` pairs overlapping creatures once per frame (`pair(a, b)` dedupes),
then `strike` decides what happens:

- Small enough to swallow → gone in one, credited through `slay`.
- Otherwise a `bite`, on `biteCd`, with `biteDamage(genome)` against `armor`.
- `venom` leaves `poison` on the victim with `poisonByPlayer` recorded, so a kill that
  lands after the mouth has let go is still the player's.
- Every bite pushes a `Bite` record onto `world.bites`; `main.digest` drains it.

The player's own eating is not special-cased here — `playerGain` accumulates nutrition
and `main` converts it into biomass, size and particles.

## Population

`spawnAround(cx, cy, viewR, target)` tops the list up to `target` creatures, rolling
species by `weight` and by whether the depth falls in their range. A species belongs to
exactly one zone (optionally to one band of it) and carries a `bleed` in world units,
which is how far past its home it strays; `rangeOf` precomputes the result at boot. A
vertical migrator is a species with a wide bleed, not a species of two zones. `cull` drops
anything outside the radius. Two shaping rules live in `species.ts`/`world.ts`:

- The **shallows tutorial**: above 1000 m plankton spawn in blooms of 6–11 and hunters,
  ambushers and guardians are thinned to ~40%, all fading out by 1000 m.
- **Guardians** are in the spawn pool like anything else — one is alive in its zone from
  the moment the player first arrives. `World` holds each to a single instance and keeps
  it in `deadGuardians` once killed, so a guardian is gone for the run rather than on a
  respawn timer. Killing the Trenches' guardian (`FINAL_GUARDIAN`) ends the run; the other
  four just grant a very large meal.

## Notice

A guardian ignores anything smaller than `noticeSize(zone)`, which is interpolated between
the gate that opens its zone and the gate that opens the next. It has seen you and does not
care, which is the scene that sells a zone. `World.notices` gates the prey filter;
`noticedBy` publishes the instant one turns toward the player and `hunted` stays true while
any is chasing. `Game` turns those into a spike-and-sustain envelope on the water shader's
`uDread`. Stealth multiplies the threshold up. See
[adr/0002](adr/0002-guardian-notice-is-measured-against-the-zone.md) for why the threshold
is not a share of the guardian's own body, which was tried first and is backwards.

Population target itself falls with depth (`POP_SHALLOW` 105 → `POP_DEEP` 46 in
`main.ts`) because deep creatures are far larger.

## Bounds

`WORLD_HALF_W` clamps x. `world.descentLimit`, set every frame by `main` from
`zones.descentLimit(size)`, clamps the player's y and sets `world.blocked` on the frame
they press against it — that flag is what raises the "too small" toast.
