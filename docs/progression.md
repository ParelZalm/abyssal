# Progression

## Genome

`src/game/genome.ts` is one flat interface, `Genome`, and four derived functions:
`maxHp`, `biteDamage`, `senseRadius`, `menace`. Everything else in the game reads those
rather than recomputing.

Three groups of fields, and the split matters:

- **Stats** — `size`, `speed`, `turn`, `bite`, `sense`, `armor`, `regen`, `metabolism`,
  `stealth`, `gulp`, `lifesteal`. Read by the simulation.
- **Organs** — `venom`, `lure`, `claws`, `jet`, `coral`, `frill`. Each carries a
  mechanic *and* a piece of morphology; adding one means touching both `world.ts` and
  `fishview.ts`, which is the point of them.
- **Morphology** — `hue`, `accentHue`, `finSize`, `tailSplit`, `spikes`, `jaw`,
  `eyeSize`, `glow`, `segments`, `translucent`. Purely visual, but every trait nudges at
  least one so a build looks like what it does.

`menace(g)` is derived from jaw, spines, bite and bulk, and drives the art directly —
darker mass, hotter edge, blades along the flanks, the bruised aura. The player crosses
the same thresholds as anything else.

## The draft

`traits.ts` holds 33 `Trait` records — id, rarity, icon, description, and an `apply`
that mutates a `Genome`. `draftTraits(rng, reach, taken, count)` picks without
replacement from a rarity-weighted pool.

- `RARITY_WEIGHT` sets the base odds; `RARITY_CLIMB` makes rare and apex more likely as
  `reach` grows. Roughly 75/25/0 at the start, 48/41/11 by stage 8.
- **`reach` is not the stage.** `main.offerDraft` passes
  `max(stage, maxTier * 2 + 1)`, so diving upgrades the pool as much as feeding does.
- `maxStacks` defaults to 2, so a run specialises without collapsing into one stat.
- `minStage` gates the organs out of the opening draft.

A draft is offered on level-up (`xp >= xpNeed`, which is `45 * 1.5^(stage-1)`) and once
per new tier reached. Both set `phase = 'draft'`; `applyTrait` rebuilds the view,
refills health and returns to `play`.

## Tiers

`tiers.ts` is five `Tier` records with a `top`, `bottom` and a `gate` in centimetres.

- `tierAt(y)` — which tier a depth is in.
- `descentLimit(size)` — the floor of the deepest tier the player has unlocked, minus
  12. `main` feeds it to `world` every frame.
- `nextGate(size)` — the next sealed thermocline, for the HUD hint and the seal label.

Gates are checked against **body size only**. Nothing else unlocks depth, and depth
unlocks nothing except the water below it and a free mutation.

`checkTiers` watches two things: the count of open gates (for the "thermocline parts"
toast) and `tierAt(player.y)` exceeding `maxTier`, which plays the tier card and grants
the free draft.

## Run state

Held on `Game`: `stage`, `xp`, `food`, `taken` (id → stacks), `takenNames` (for the HUD
and pause sheet), `eaten`, `deepest`, `elapsed`, `maxTier`, `gatesOpen`. `reset()`
rebuilds all of it plus the world and the player; there is no save, and a run is seeded
from `Math.random()` into a `Rng` so a seed would reproduce it if one were ever exposed.

Fullness (`food`) drains at `metabolism * (1.2 + size * 0.014)` and hits health at zero
— the cost that stops size-stacking from being free.
