# Progression

## Genome

`src/game/genome.ts` is one flat interface, `Genome`, and four derived functions:
`maxHp`, `biteDamage`, `armourOf`, `menace`. Everything else in the game reads those
rather than recomputing — in particular nothing reads `g.armor` raw, because plate is
armour too.

Three groups of fields, and the split matters:

- **Stats** — `size`, `speed`, `turn`, `bite`, `sense`, `armor`, `regen`, `metabolism`,
  `stealth`, `gulp`, `lifesteal`, `pen`, `ram`. Read by the simulation.
- **Organs** — `venom`, `lure`, `claws`, `jet`, `coral`, `frill`, plus `pen`, `ram`,
  `lifesteal` and `spikes`, which act like organs even though they sit in the other
  groups. Each carries a mechanic *and* a piece of morphology. The mechanic lives in
  `organs.ts`: one `Organ` record per field, keyed off the genome (NPC species carry
  organs too, so a trait list would lose the crab's spines), with *modifier* hooks
  (armour faced, lure range, boost, burn, swallow heal) and *effect* hooks (`onWound`,
  `onWounded`, `onTick`). `World.bite` and the boost, burn and digest code in `main`
  call the helpers at the bottom of that file and never read an organ field by name.
  Every `Creature` caches its active organs and `refreshOrgans()` beside `view.rebuild`.
  The one exception is `coral`: it is plate, so `armourOf(g)` adds it as a derived stat.
  A synergy is an `Organ` whose `when` tests two fields and that carries a `name`; its
  effect hooks return true on a frame they did something, `World.fired` publishes its id
  once per run on `world.synergies`, and `Game.digest` turns it into the toast, so the
  combination is discovered in play rather than read off a card. Four so far:
  `Toxic Lure` (lure + venom: prey that reaches the light is poisoned before the bite),
  `Ghost Light` (lure + stealth ≥ 0.4: lured prey is not panicked by its shoal's alarm),
  `Urchin` (spikes + armour ≥ 11: recoil of 0.8 × armour on every bite taken — 11 sits
  one above the Leviathan, which would otherwise qualify) and `Nematocyst` (venom +
  lifesteal: bodies the player has poisoned heal the player while they tick; player only,
  since a wound records *whether* the player poisoned it, not who). Recoil can kill:
  `World.bite` books an attacker whose health the defender's organs took below zero. The
  paint asks `hasSynergy(g, id)` from the same file, so a combination shows on the body
  through the predicate that makes it act, and `synergiesOf(g)` is in the bake cache key
  because a synergy's threshold can fall inside one quantised bucket of the fields it
  tests. Every synergy gets a cell on the design board's Builds row, and a `desc` — the
  line the codex shows once it has been found.
- **Morphology** — `hue`, `accentHue`, `finSize`, `tailSplit`, `spikes`, `jaw`,
  `eyeSize`, `glow`, `segments`, `translucent`, plus the deep-water set: `photophores`,
  `eyeAdapt`, `gape`, `veil`, `bulk`, `barbels`. Purely visual, but every trait nudges at
  least one so a build looks like what it does. The deep-water six exist because hue
  cannot tell a trench animal from a reef one — everything below the twilight is drawn
  against black water, so the difference has to be in the body.

### Stats that draw, and the ones that do not

Four stats reach the picture, each through a derived accessor rather than by the paint
reading a raw field — the rule `armourOf` already followed:

- `sense` → eye size, via `eyeOf(g)`. Logarithmic, because sense climbs
  multiplicatively and a linear term puts an eye the size of the head on a late build.
- `stealth` → two ways at once. `fadeOf(g)` thins the body; `photophoreOf(g)` lights the
  belly, because below the twilight hiding means matching the glow above you rather than
  going dark against it.
- `speed` → fluke out, peduncle in, via `formFor`.
- `metabolism` → gill cover and trunk width, via `formFor`.

They are chosen because each is also a depth adaptation, so drawing the stat and drawing
the zone are the same job. `gulp`, `lifesteal`, `pen`, `ram` and `regen` are **unwired on
purpose**: they are combat maths with no natural morphology, and inventing one for them
would be decoration that lies about the build. This is a known gap, not an oversight.

Both sets are on the design board — `/design.html?g=morph` and `?g=stats` — each
parameter swept across its range over the water of the depth it belongs to.

`menace(g)` is derived from jaw, spines, bite and bulk, and drives the art directly —
darker mass, hotter edge, blades along the flanks, the bruised aura. The player crosses
the same thresholds as anything else.

## The draft

`traits.ts` holds 43 `Trait` records — id, rarity, icon, description, and an `apply`
that mutates a `Genome`. `draftTraits(rng, reach, taken, count)` picks without
replacement from a rarity-weighted pool.

- `RARITY_WEIGHT` sets the base odds; `RARITY_CLIMB` makes rare and apex more likely as
  `reach` grows. Measured over the live pool (14 common, 18 rare, 11 apex): 70/30/0 at
  stage 1, 44/45/12 by stage 8 — rare overtakes common, which is the intent.
- **`reach` is not the stage.** `main.offerDraft` passes
  `max(stage, maxBand * 2 + 1)`, so diving upgrades the pool as much as feeding does.
- `maxStacks` defaults to 2, so a run specialises without collapsing into one stat.
- `minStage` gates the organs out of the opening draft.

A draft is offered on level-up (`xp >= xpNeed`, which is `45 * 1.5^(stage-1)`) and once
per new band reached. Both set `phase = 'draft'`; `applyTrait` rebuilds the view,
refills health and returns to `play`.

## Zones, bands and gates

`zones.ts` is five `Zone` records — the places the player names, each owning a guardian
— over six `Band` records, which are the contiguous slices of water the column is
actually made of. Only the Sunlit Zone is subdivided, into Open Water and the Reef
Shelf. A band carries the `top`, `bottom`, `gate` in centimetres, `WaterLook`, and the
`metres` label at its top.

- `bandAt(y)` / `zoneAt(y)` — which band or zone a depth is in.
- `depthLabel(y)` — world depth as metres of real ocean, piecewise-linear through one
  control point per band boundary. Presentation only; nothing in the simulation reads
  it. See `docs/adr/0001-depth-labels-decoupled-from-world-depth.md`.
- `descentLimit(size)` — the floor of the deepest band the player has unlocked, minus
  12. `main` feeds it to `world` every frame.
- `nextGate(size)` — the next sealed thermocline, for the HUD hint and the seal label.

Gates are checked against **body size only**. Nothing else unlocks depth, and depth
unlocks nothing except the water below it and a free mutation.

`checkBands` watches two things: the count of open gates (for the "thermocline parts"
toast) and `bandAt(player.y)` exceeding `maxBand`, which plays the band card and grants
the free draft.

`spendWater` is the shallows clock, the answer to size-only gates making the easiest water
the best place to grow. It runs only in a band whose gate below is already open — a player
too small to leave is never pushed — and counts `overstay` seconds per band. After
`SPEND_GRACE` (40 s) the band's `world.spent` climbs to 1 over `SPEND_RAMP` (100 s):
`weightAt` cuts schools and plankton to 35% and raises non-guardian hunters to 2.2×, and
the population target falls by 30%. Halfway, `riserFor(depth, size)` picks the least
local hunter that can swallow the player at the top of its range and `World.summon`
sends it in on `quarry`: it travels in without spending stamina until it could have
sensed the player itself, then chases as any hunter does, and drops the quarry when it
tires. Below the Reef nothing that is not a guardian is big enough, so deep bands get
the thinning only. Spent water stays spent for the run.

## Run state

Held on `Game`: `stage`, `xp`, `food`, `taken` (id → stacks), `takenNames` (for the HUD
and pause sheet), `eaten`, `deepest`, `elapsed`, `maxBand`, `gatesOpen`, `overstay` and `risen` (the
shallows clock). `reset()`
rebuilds all of it plus the world and the player. A run is seeded from `Math.random()`
into a `Rng`, so a seed would reproduce it if one were ever exposed.

## The codex

The only thing besides the best score that outlives a run. `game/codex.ts` keeps kills
per species id, stacks per trait id, the synergy ids that have fired and a run count, in
`localStorage` under `abyssal.codex`. Ids rather than names, so a rename does not orphan
a find; a load keeps ids the game no longer has, and a corrupt store reads as empty.

- **Where it is fed.** `World.slay` pushes the species id of every kill the player
  books onto `world.devoured` (an event, cleared each `update`); `Game.digest` records
  it, and records the synergy ids off `world.synergies`. `applyTrait` records the trait.
- **When it is written.** On a first — a species, trait or synergy never seen in any
  run, which also toasts and goes on the end screen's *New in the codex* line — at the
  end of a run, and when the page is hidden. Kill counts ride along with those, so the
  store is not rewritten on every kill.
- **Where it is read.** The Codex screen, off the title and both end screens, lists
  every species by zone, the whole trait pool as HUD chips, and the synergies; anything
  unfound keeps its slot as `???`, since what is left to find is the point. A draft card
  for a trait never taken carries a *new* mark beside its rarity.

Fullness (`food`) drains at `metabolism * (1.2 + size * 0.014)` and hits health at zero
— the cost that stops size-stacking from being free.
