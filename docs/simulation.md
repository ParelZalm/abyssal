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

`spawnAround(cx, cy, viewR, target, allowApex)` tops the list up to `target` creatures,
rolling species by `weight` and by whether the depth falls in their band. `cull` drops
anything outside the radius. Two shaping rules live in `species.ts`/`world.ts`:

- The **shallows tutorial**: above 1000 m plankton spawn in blooms of 6–11 and hunters
  and ambushers are thinned to ~40%, both fading out by 1000 m.
- **Apex** species (the Leviathan) only spawn once `allowApex` is set, which `main` ties
  to having reached the Abyss tier.

Population target itself falls with depth (`POP_SHALLOW` 105 → `POP_DEEP` 46 in
`main.ts`) because deep creatures are far larger.

## Bounds

`WORLD_HALF_W` clamps x. `world.descentLimit`, set every frame by `main` from
`tiers.descentLimit(size)`, clamps the player's y and sets `world.blocked` on the frame
they press against it — that flag is what raises the "too small" toast.
