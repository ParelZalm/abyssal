# Progression

## Genome

`src/content/genome.ts` is one flat interface, `Genome`, and four derived functions:
`maxHp`, `biteDamage`, `armourOf`, `menace`. Everything else in the game reads those
rather than recomputing — in particular nothing reads `g.armor` raw, because plate is
armour too.

Three groups of fields, and the split matters:

- **Stats** — `size`, `speed`, `turn`, `bite`, `sense`, `armor`, `regen`, `metabolism`,
  `stealth`, `gulp`, `lifesteal`, `pen`, `ram`. Read by the simulation.
- **Organs** — `venom`, `lure`, `claws`, `jet`, `coral`, `frill`, `filter`, `crush`, `eel`,
  `mantle`, `lurk`, `electro`, the curses `glare` and `brittle`, the actives `ink`,
  `discharge` and `inflate`, plus `pen`, `ram`,
  `lifesteal` and `spikes`, which act like organs even though they sit in the other
  groups. Each carries a mechanic *and* a piece of morphology. The mechanic lives in
  `sim/organs/`: one `Organ` record per field, keyed off the genome (NPC species carry
  organs too, so a trait list would lose the crab's spines), with *modifier* hooks
  (armour faced, lure range, boost, burn, swallow heal) and *effect* hooks (`onWound`,
  `onWounded`, `onTick`). `Combat.bite`, the `PlayerController` boost and `Metabolism`
  call the folds in `sim/organs/query.ts` and never read an organ field by name.
  Every `Creature` caches its active organs and `refreshOrgans()` beside `view.rebuild`.
  The one exception is `coral`: it is plate, so `armourOf(g)` adds it as a derived stat.
  The two **diet** organs are the first that make a body worse at something on purpose, so
  the build decides what the run hunts. `filter` (Gill Rakers) multiplies the gulp reach
  on anything small enough to go down whole by `1.8 + 0.7 × filter`, and cuts every bite
  that has to tear to 40% — a sweep through a krill cloud, and a retreat from anything its
  own size. `crush` (Crushing Pharynx, a reef card) faces no armour and takes no recoil, and
  pays with a bite cooldown of 0.72 s instead of 0.4. They act through four modifier hooks
  added for them — `gulp`, `damage`, `biteRate`, `recoil` — and recoil goes through
  `sting()` in `sim/organs/effects.ts`, so spines, frill and Urchin all ask the attacker's organs how
  much of it lands.
  The **sense** organ, `electro` (Ampullae of Lorenzini), is a second way of perceiving
  beside the eye. Eyes are `sense` through `sightOf(g, light)`: 2.55 × sense in the
  sunlit water, 0.9 × in the Abyss (at sense 520: 1255 and 469 units, against the 620 the
  deep used to allow), and a light-gathering eye — `eyeAdapt`, which Tapetum Lucidum now
  raises by 0.5 — wins it back to 670. The ampullae act through a `feel` hook: within
  `2.5 × size + 240 × electro` everything is shown whatever the light, and a wounded body
  (below half health, bleeding, poisoned or dazzled) from twice that. A body found by feel
  and not by sight is drawn in a cold cast (`FELT_TINT`) so the two read differently.
  Pores pepper the snout.
  The three **active** organs fill one slot the player fires by hand — E or the right
  button — on a cooldown kept by `PlayerController.fireActive`. An `active` record on the organ gives
  its name, HUD glyph, cooldown and `fire(c, world)`, and `activeOf` takes the first; the
  cards clear the other two fields when taken, so the slot is always one. A press is
  consumed whether or not it fired. `Ink Sac` (12 s) leaves a cloud of `3 × size + 200` on
  `world.inks` for 3.5 s, inside which `Behaviour.nearest` does not return the player, and
  drops the chase of every hunter already on it. `Electric Organ` (9 s) hits everything
  within `3 × size + 160` through `World.hit` for 0.7 of a bite and stuns it for 0.7 s (a
  guardian 0.25). `Inflation` (11 s) swells the body 1.4× for 3 s (`FishView.swell`): a
  mouth needs 2.5 times its usual gape to swallow it (a reef shark that took a 30 cm body
  whole tore 22 instead), bites land at 0.35 through the `taken` hook, biters are pricked
  for `3 + 0.12 × size`, and the swim bleeds speed. Everything organs throw into the water
  is published on `world.pulses` with a kind, for `Impacts.drain` to draw. The slot sits
  bottom centre with a fill that climbs back as it recovers.
  The three **locomotion** organs are parameter shapes on the one swim model, through a
  `swim` hook that folds into `SwimMods` — cached on the creature beside its organs and
  read by `Creature.propel` and `agility`. `eel` (Anguilliform Body) keeps full turning at
  any speed (`hold` 1 against 0.55) and has no glide (`coast` × 3.5 when not driving).
  `mantle` (Mantle Pump) cuts the steady stroke to 0.3 and fires a kick of one cruise
  speed every 0.85 s, with the beat locked to the pulse so the bell contracts as it fires;
  tuned so a held throttle averages the plain cruise (122 against 119) while swinging from
  74 to 218. `lurk` (Lie in Wait) banks *poise* while not driving, up to 2 s, which adds up
  to 0.35 stealth (through the `stealth` hook, which `Behaviour.think` and `notices` now read
  instead of the raw field) and multiplies the next bite by `1 + 0.8 × poise`; the bite
  spends it, and it sinks at 60 u/s² while idle. `Game` rings the body once when poise
  tops out, since nothing else says the strike is wound. All three bend the silhouette in
  `formFor` and the swim wave in `motionFor` (`fishview.ts`) as well as the paint.
  A synergy is an `Organ` whose `when` tests two fields and that carries a `name`; its
  effect hooks return true on a frame they did something, `World.fired` publishes its id
  once per run on `world.synergies`, and `Game.digest` turns it into the discovery card, so the
  combination is discovered in play rather than read off a card. Nine so far:
  `Toxic Lure` (lure + venom: prey that reaches the light is poisoned before the bite),
  `Ghost Light` (lure + stealth ≥ 0.4: lured prey is not panicked by its shoal's alarm),
  `Urchin` (spikes + armour ≥ 11: recoil of 0.8 × armour on every bite taken — 11 sits
  one above the Leviathan, which would otherwise qualify) and `Nematocyst` (venom +
  lifesteal: bodies the player has poisoned heal the player while they tick; player only,
  since a wound records *whether* the player poisoned it, not who) and `Ballistic` (jet +
  claws: inside a boost kick's surge and at 0.9 of cruise or faster, whatever the head
  meets is struck for `0.6 + 0.5 × speed/cruise` of a bite, once per body per boost, bigger
  animals included). Ballistic reads `Creature.boosting`, the seam `Game` opens with
  `kick(0.4)` on every boost, and strikes through `World.hit` — a blow with no cooldown
  and no swallow that shares `land` with the bite, so armour, organs and the kill are
  booked the same way. The claws fold forward along the head into clubs.
  `Vivisect` (claws + `serrate`): a bite that does not kill opens a bleed of
  `(0.2 + 0.05 × serrate) × bite` per second for 5 s. A bleed is status on the wounded body
  like venom, ticked in `Combat.bleedOut` and kept apart from poison so Nematocyst does not
  feed on it; what it adds is the trail — every 0.35 s it leaves a drop of blood (`Blood`
  at 0.6 of the body's length, 3 s) where the animal is now, so `smell` leads hunters along
  its path rather than to where it was bitten. A drop carries `from`, and a body cannot
  smell its own. `serrate` is a morphology field Serrated Teeth now sets, because a synergy
  keyed off `bite` could not tell the saw from any other card that raised it.
  `Drifting Bloom` (frill + translucent ≥ 0.5, which Glass Body alone reaches): the fringe
  trails `BLOOM_TRAIL` (0.85) body lengths past the tail, and a hunter whose mouth reaches
  that segment — or that bites the body anywhere — is envenomed at `2 + 2 × frill`, slowed
  to 0.35, and neither chases nor bites for 2.5 s; once per poisoning. Chased from behind
  by a reef shark it cannot swallow, a pinned player took 0 bites in 2.5 s against 4
  without it; bitten from the front, 1 against 5. Swallowed whole, nothing helps.
  `Whale Shark` (ram + size ≥ 96, the Midnight gate): while cruising at 0.6 of top speed
  or faster, burn × 0.8, and anything under a quarter of the body's length in a cone ahead
  within `7 × size` is drawn to the mouth. Seven because the whole-swallow gulp already
  reaches about `3.8 × size` on a body that big; a wake inside it measured as nothing.
  `Flash Sense` (electro + glow ≥ 0.6, the Photophores card's): every boost kick fires a
  flash over 1.5 × the feel range, published on `world.flashes` for `Game` to draw, and
  every body inside it with `eyeOf` ≥ 1.35 is dazzled for 1.6 s (a guardian for a third
  of that) — `Creature.stun` stops its steering and holds its bite. The light-gathering
  eyes of the deep and the two biggest sunlit hunters qualify; the trench's blind animals
  do not. `Creature.kicks` counts boosts so the flash fires once per kick. A bright row
  of outward lights runs along each flank.
  Recoil can kill:
  `Combat.land` books an attacker whose health the defender's organs took below zero. The
  paint asks `hasSynergy(g, id)` from the same file, so a combination shows on the body
  through the predicate that makes it act, and `synergiesOf(g)` is in the bake cache key
  because a synergy's threshold can fall inside one quantised bucket of the fields it
  tests. Every synergy gets a cell on the design board's Builds row, and a `desc` — the
  line the codex shows once it has been found.
- **Morphology** — `hue`, `accentHue`, `finSize`, `tailSplit`, `spikes`, `serrate`, `jaw`,
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

`traits.ts` holds 53 `Trait` records — id, rarity, icon, description, an optional home
`band`, and an `apply` that mutates a `Genome`. `draftTraits(rng, reach, band, taken,
count, lean)` picks without replacement from a rarity-weighted pool.

- `RARITY_WEIGHT` sets the base odds; `RARITY_CLIMB` makes rare and apex more likely as
  `reach` grows.
- **`reach` is not the stage.** `Evolution.offerDraft` passes
  `max(stage, maxBand * 2 + 1)`, so diving upgrades the odds as much as feeding does.
- **Zone pools.** A trait's `band` is the water it belongs to: it is only offered when the
  draft happens in that band or deeper — the band the player is *in*, `bandAt(player.y)`,
  not the deepest reached — and it leans ×1.6 in the band itself. This replaced
  `minStage`: reef organs (beak, coral, venom, claws, siphon, frill, lure, serrate, the
  eel and ambush bodies, the pharynx) are found on the reef, the luminous and glass cards in
  the twilight, and the apex cards from the twilight down. Cards with no band are offered
  anywhere. The card names its band beside its family. Measured over the live pool with
  a typical reach for each band:

  | Band (reach) | Cards | Common / rare / apex | Home cards |
  | --- | --- | --- | --- |
  | Open Water (1) | 19 | 76 / 24 / 0 | 19% |
  | Reef Shelf (3) | 32 | 56 / 44 / 0 | 43% |
  | Twilight (5) | 41 | 43 / 55 / 2 | 23% |
  | Midnight (7) | 47 | 39 / 51 / 10 | 8% |
  | Abyss (9) | 50 | 35 / 53 / 12 | 4% |

  Since the band is where you are, levelling in the shallows keeps the pool shallow, and a
  thermocline reward — drafted as you arrive — is the new water's own cards.
- **Every apex card costs something**, and its text says so: the jaws turn worse (Apex
  Predator −18%, Titan Jaws −15%), plate and toxin and fast muscle burn more (Carapace,
  Neurotoxin, White Muscle Burst, Ampullae, Leviathan Blood), and the heavy organs swim
  slower (Abyssal Heart, Deep Lantern, Mantis Strike). Ram's cost was already its own
  mechanic. Without a price the draft was "take the rarest".
- **Cursed cards** carry a `curse`, the price in red on its own line beside a *cursed*
  mark. The gift is bigger than the rarity gives (Blood Lamp +90% bite, Brittle Frame +35%
  speed and +25% turning), and the curse is an organ with paint, not a stat going down:
  `glare` (a `glare` hook, read in `Behaviour.nearest`, which shrinks the player's distance by
  `1 + 0.6 × glare` so hunters and prey both find it from 60% further, and in `notices`,
  which lets guardians register it smaller) paints three coals down the back; `brittle`
  (a defender-side `taken` hook, after armour, ×1.5) crazes the skin with pale slivers.
  One stack each.
- `maxStacks` defaults to 2, so a run specialises without collapsing into one stat.

- **The draft reads the build** (`run/prospects.ts`). `completes(g, owned, form, t)` takes
  the card on a copy of the genome and asks the organ registry which synergies turn live,
  and `formDue` whether it is the third of a family — so a threshold synergy like Urchin
  is read exactly, and nothing in the file knows which traits pair. A card that completes
  something wears a second, green outline light beside its rarity light and says what it
  finishes; an undiscovered synergy is announced but not named. `leanOf` weights the draw
  ×1.5 for a completing card and ×1.15 for one that advances a family already begun,
  passed to `draftTraits` as `lean` (0 excludes a card from that draw).
- **Reroll**: 15 fullness, then 30, then 45 within one draft, never allowed to take the
  last of the bar, and the new hand leaves out the one it replaces.
- **Near misses**: the end screen lists up to three things the run was one card short of
  (`nearMisses`), counting only cards it could still have been offered.

A draft is offered on level-up (`xp >= xpNeed`, which is `45 * 1.5^(stage-1)`) and once
per new band reached. Both set `phase = 'draft'`; `Evolution.take` rebuilds the view,
refills health and returns to `play`.

## Transformations

`content/forms.ts`. Every trait carries one or two `families` — predator, sprinter, lurker,
luminous, grazer; plate and the plain stat cards carry none. Three *different* traits of
one family (stacks do not count) transform the player, once per run, in `Evolution.transform`
off `Evolution.take`: the plan changes to that family's, and the family's grant is applied to
the genome.

| Family | Form | Plan | Grant |
| --- | --- | --- | --- |
| predator | Shark | `shark` | `frenzy` +1 (bites on bodies below half health × 1.4), +10% speed |
| sprinter | Squid | `squid` | `mantle` = 1 and `jet` +1 |
| lurker | Moray | `eel` | `lurk` = 1, +0.2 stealth |
| luminous | Angler | `angler` | `lure` +1, `gape` +0.4 |
| grazer | Bloom | `jelly` | `filter` +1, `frill` +1 |

- **Only plans the roster already draws, never a guardian's**, which is why there is no
  armoured form: every plated plan belongs to a guardian, and wearing one would spend the
  silhouette the player is meant to recognise on sight.
- **The smoke stays.** The wraith's see-through body is `Genome.smoke` (set on the player
  in `reset`), not only the wraith plan's `smoke` art flag, so a transformed player is a
  smoky shark among real ones. The paint reads either.
- **Grants are organ magnitudes**, so the registry carries them and nothing reads a form
  by name. `frenzy` is the one organ only a form grants; the `damage` hook gained the
  defender for it.
- A trait of two families that completes both transforms into the one it lists first.
- `FishView.setPlan` swaps the plan in place; the player's `Species` is a per-run copy of
  `PLAYER_SPECIES`, since the plan lives on it.
- Draft cards show a trait's families, the pause sheet shows progress per family (or the
  form once taken), the end screen names it, and the codex keeps every form reached.

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

Gates are checked against **body size only**, with one exception the player pays for.
Depth unlocks the water below it, its own draft pool (see *Zone pools*) and a free
mutation.

**The pocket under a seal.** While a gate is shut and the player is in the band above it,
within about a view of the shear, `Bands.tendPocket` has `Spawner.pocket` keep 14 bodies of
the band's `pocket` species — reef fish, lanternfish, bristlemouths, dumbos, snailfish —
in the first 70–320 units under the thermocline. They are placed in frame and fade in out
of the shadow (an off-screen arrival swam about at the edge and was never seen), and they
carry `Creature.hold`, a depth range that replaces their species' own in `think`, since
the ordinary band hold pushes anything 220 units down from its band's top. The pocket is
the reason to look down through a seal: the withheld water is visibly richer.

**Forcing a seal.** A body at 70% of a gate or more can boost into it: `Bands.squeeze`
counts time held at the shear (`world.blocked`) with the boost down, easing off twice as
fast as it builds, and at 1 s puts the body through for 30% of its maximum health. That
band is `squeezed` — open to its own floor and drawn open by the shader — and until the
body grows to the gate or climbs back out, it loses 1.5% of maximum health a second and
regenerates nothing. A forced entry is a raid on the pocket and the new band's cards
(its thermocline reward is drafted on arrival as usual), not a way to live there early.
The seal label and the blocked toast both say so once the body is big enough.

`Bands.check` watches two things: the count of open gates (for the "thermocline parts"
toast) and `bandAt(player.y)` exceeding `maxBand`, which plays the band card and grants
the free draft.

`Bands.spendWater` is the shallows clock, the answer to size-only gates making the easiest water
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

Held on `Game`: `stage`, `xp`, `food`, `taken` (id → stacks), `form`, `takenNames` (for the HUD
and pause sheet), `eaten`, `deepest`, `elapsed`, `maxBand`, `gatesOpen`, `overstay` and `risen` (the
shallows clock). `reset()`
rebuilds all of it plus the world and the player, from a `RunChoice` — a starting form
and, optionally, a seed.

**Seeds.** Every run has one: `Run.seed`, random unless given, shown on the end screen as
`Seed n` (or `Daily yyyy-mm-dd`), and a `?seed=n` in the address starts that ocean from
Hatch. The world and the ocean draw from `rng`; the draft draws from its own `draftRng`
(the seed xor a constant), so the same seed and the same picks deal the same hands however
differently the two runs swam — the world stream is spent on every spawn and would not.
Much of the motion still runs on `Math.random`, so a seed is the same ocean and the same
draft, not a replay. **The daily** (`dailySeed`, FNV-1a of the UTC date) is always the
hatchling, so it is one run for everyone; *Spawn again* after a daily retries the same
ocean, after any other run it rolls a new one with the same body.

**Starting forms** (`run/starts.ts`). One per zone some run has reached —
`Codex.deepest`, written the moment a band is first entered and backfilled from the kill
counts of codices older than it: the Reef Wrasse hatches with Parrot Beak, the
Lanternfish with Photophores (smaller and quicker), the Angler Larva with Illicium
(slower), the Squid Paralarva with Mantle Pump and Ink Sac. The traits go through the
ordinary taken path, quietly, so they count toward families and synergies. The title
shows the unlocked forms as cards and the rest as what unlocks them, and remembers the
last pick; the end screens offer *Choose a body* to go back to it.

## The codex

The only thing besides the best score that outlives a run. `run/codex.ts` keeps kills
per species id, stacks per trait id, the synergy ids that have fired, the families whose
form has been reached and a run count, in
`localStorage` under `abyssal.codex`. Ids rather than names, so a rename does not orphan
a find; a load keeps ids the game no longer has, and a corrupt store reads as empty.

- **Where it is fed.** `Combat.slay` pushes the species id of every kill the player
  books onto `world.devoured` (an event, cleared each `update`); `Game.digest` records
  it, and records the synergy ids off `world.synergies`. `Evolution.take` records the trait.
- **When it is written.** On a first — a species, trait or synergy never seen in any
  run, which also toasts and goes on the end screen's *New in the codex* line — at the
  end of a run, and when the page is hidden. Kill counts ride along with those, so the
  store is not rewritten on every kill.
- **Where it is read.** The Codex screen, off the title and both end screens, lists
  every species by zone, the whole trait pool as HUD chips, and the synergies; anything
  unfound keeps its slot as `???`, since what is left to find is the point. A draft card
  for a trait never taken carries a *new* mark beside its rarity.

**Hunger is said before it kills** (`Metabolism.warn`): a toast under a quarter and at
empty, the bar pulsing red, and a heartbeat every 1.15 s quickening to 0.5 s as fullness
runs out — `audio/sound.ts`, two synthesised sine thumps, woken on the first key or press
since a browser will not start audio before one, and muted with M.

Fullness (`food`) drains at `metabolism * (1.2 + size * 0.014)` and hits health at zero
— the cost that stops size-stacking from being free.
