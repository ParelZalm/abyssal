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
  `mantle`, `lurk`, `electro`, the curses `glare`, `brittle`, `veins` and `lead`, the actives `ink`,
  `discharge` and `inflate`, plus `pen`, `ram`,
  `lifesteal` and `spikes`, which act like organs even though they sit in the other
  groups. Each carries a mechanic *and* a piece of morphology. The mechanic lives in
  `sim/organs/`: one `Organ` record per field, keyed off the genome (NPC species carry
  organs too, so a trait list would lose the crab's spines), with *modifier* hooks
  (armour faced, lure range, boost, burn, swallow heal) and *effect* hooks (`onWound`,
  `onWounded`, `onTick`, and `onFire`, run by `fire(world, c)` after the active organ goes
  off, with the active's id — how a synergy acts on the active without owning it). `Combat.bite`, the `PlayerController` strike and `Belly`
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
  is published on `world.pulses` with a kind, for `Impacts.drain` to draw. The active fires
  from `PlayerController.steer`, before `World.update`, so the outbox is emptied by
  `World.clearOutbox()` at the top of `Game.frame` and not by the update: emptied there, an
  active's pulses and a synergy's first firing were wiped before `digest` read them, and no
  ink cloud, shock ring or swell ever drew. The slot sits
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
  Two NPCs are born with them (`Species.eel`, `Species.lurk`): the Ribbon Eel carries both,
  a reef ambusher that cuts inside anything it lunges at and bites harder for having waited,
  and the Anglerfish carries `lurk`, whose lure trap spends no poise — an angler at rest is
  always at full poise, and a strike that already ignores size would land six and a half
  bites. An NPC's stealth dims it to the player's eyes (`Scene`, `HIDDEN` 0.75), faint at a
  distance and found within a few body lengths; a body felt by the ampullae is not dimmed.
  A synergy is an `Organ` whose `when` tests two fields and that carries a `name`; its
  effect hooks return true on a frame they did something, `World.fired` publishes its id
  once per run on `world.synergies`, and `Game.digest` turns it into the discovery card, so the
  combination is discovered in play rather than read off a card. Fourteen so far:
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
  `Smoke Screen` (jet + ink sac): every boost kick puffs a cloud at the tail — `size × 1.4
  + 90` across, 1.8 s, on `world.inks` — and every hunter within 1.6 of it drops its chase
  and tires for 0.8 s. It does not hide the body, which is already leaving it; it breaks
  the line behind. Once per kick through its own counter (`Creature.inked`). The siphon is
  stained black from its opening forward, with the ink's sheen at the mouth.
  `Moray Jaws` (eel + crushing pharynx): a bite that neither kills nor swallows a body no
  bigger than you holds it — stunned, its bite held, carried at your speed — for 0.7 s,
  about the crusher's slow second snap, so what was bitten stays at the mouth. Hooked
  teeth are raked back in the throat, a pale ridge at the jaw's corner when it is shut.
  `Stonefish` (lie in wait + venom): with poise at half its wind or more (a second held
  still), any hunter whose mouth reaches the body, or that bites it from further, is
  envenomed at three times the barbs' strength (`7.5 × venom` a second), thrown back off
  the body at 0.9 of its cruise and off the hunt for 1.5 s, bite included. Once per
  poisoning, and a green ring marks it (the `venom` pulse). A mackerel nosing a poised 30 cm
  body was stung and thrown from 40 to 90 units. Warts along the back, green-tipped.
  `Porcupine` (inflation + spines): the swell is a blow — everything touching the swollen
  body is hit for `0.4 + 0.3 × spikes` of a bite and shoved off at 1.2 of its cruise, prey
  and hunter alike — and while swollen a biter takes `6 × spikes` on top of the puff's own
  prick. The prickles become quills, three times as long and raked back.
  `Electric Eel` (eel + electric organ): everything inside the shock that the eel could
  swallow is twitched for 1.4 s and pulled to the mouth, turned to face it so the pull runs
  against the forward drag (`3.2 ×` the distance over a drag of 3.1 lands it at the jaw;
  sideways the lateral drag stopped it 60 units short). The shock's own blow and stun on
  everything else are unchanged. The electrocytes run from behind the head to the tail.
  Both act through `onFire`. Recoil can kill:
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

Gone from play with XP in roadmap stage 2; the pool and its rules below are what the
pedestals (stage 5) are built from.

`traits.ts` holds 53 `Trait` records — id, rarity, icon, description, an optional home
`band`, and an `apply` that mutates a `Genome`. `draftTraits(rng, reach, band, taken,
count, lean)` picks without replacement from a rarity-weighted pool.

- `RARITY_WEIGHT` sets the base odds; `RARITY_CLIMB` makes rare and apex more likely as
  `reach` grows.
- **`reach` is the stage.** It was `max(stage, maxBand * 2 + 1)` in the column, so diving
  upgraded the odds as much as feeding; with no bands to reach it is the stage alone until
  the pool moves to pedestals (roadmap stage 5).
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

  Since the band is where you are, levelling in the shallows keeps the pool shallow. (The
  table is the column's; a run is in the nursery's Open Water for now.)
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
  (a defender-side `taken` hook, after armour, ×1.5) crazes the skin with pale slivers;
  `veins` (Open Veins, +3 regeneration: an `onWounded` hook that opens a bleed worth a
  tenth of every wound a second for five, half the bite again) runs dark red veins back
  along the flank. The bleed is a trail hunters follow, and it stops the very regeneration
  the card pays in, since nothing heals while a wound is working; `lead` (Leaden Bones, +6
  armour: a `swim` hook adding `SwimMods.weight`, a pull that never lets up, of 1.2 × cruise,
  and 1.5 × cruise more `sink` with nothing driving) sinks a still body at about 40 u/s at
  the hatchling's speed, drifts a level swim down at 20 and halves a climb — no hovering and
  no ambush that stays where it was set. A keel of grey plates down the belly. One stack each.
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
one family (stacks do not count) transform the player in `Evolution.transform` off
`Evolution.take`: the plan changes to that family's, and the family's grant is applied to
the genome.

A long run gets a **second metamorphosis** (`MAX_FORMS` 2): a family the run has not become,
at `formAt(1)` = four different traits of it, one more than the first took. The plan is
replaced and the grants stack — what the first form earned it keeps — so a Shark that goes
on to be an Angler fishes with a lure and still frenzies. The screen says which form it
remade; the pause sheet lists every form and counts the open families toward the next one;
the draft stops leaning toward a family already become; the end screen reads "Became a
Shark, then an Angler". `Run.forms` holds them, and `Run.form` is the latest, the body's.

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
  smoky shark among real ones. The paint reads either. The player also hatches `pale` (a
  larva's pallor, near white; the palette lifts and desaturates its ramp) with a big eye and
  a lavender cast, and a pale body is less see-through and carries a halo, since it is the
  brightest thing in a dark tank.
- **Grants are organ magnitudes**, so the registry carries them and nothing reads a form
  by name. `frenzy` is the one organ only a form grants; the `damage` hook gained the
  defender for it.
- **The ocean reads the plan.** A hunter drawn on the player's plan takes it for kin and
  does not hunt it while it is above half health (`Creature.spares`, folded into
  `preysOn`, and checked by the NPC anglerfish's lure trap, which ignores size). Below
  half it is a wounded one of their own and fair game — the same line the Shark's frenzy
  bites at. Kin by form: reef sharks for the Shark; barracuda, gulper, hagfish and ribbon
  eel for the Moray; anglerfish and dragonfish for the Angler; the vampire squid for the
  Squid; none for the Bloom, since jellies do not hunt. Guardians have plans of their own
  and are never fooled. Each form's text says so.
- A trait of two families that completes both transforms into the one it lists first.
- `FishView.setPlan` swaps the plan in place; the player's `Species` is a per-run copy of
  `PLAYER_SPECIES`, since the plan lives on it.
- Draft cards show a trait's families, the pause sheet shows progress per family (or the
  form once taken), the end screen names it, and the codex keeps every form reached.

## Tanks and rooms

A run is a chain of **tanks**, each a grid of one-screen **rooms** (`content/tanks.ts`; the
words are in `CONTEXT.md`, the decision in `docs/adr/0003-*`). A `Tank` has a name, the
world depth whose water it borrows, a tile size in world units, its loose fauna, its
hostiles, and how many bodies a room holds. A `RoomTemplate` is 32 × 18 rows of characters —
`#` rock, `=` sand, `o` boulder, `.` water — authored by hand, as Isaac's are, and tagged
with the room types it may be dealt as. The nursery has eight.

**The map** (`content/map.ts`) is dealt from the run's seed: 7–8 rooms grown out from the
start one neighbour at a time, a room added only where it touches exactly one other so the
map branches, and sideways preferred over up and down. The boss goes on the dead end
furthest from the start, the treasure room and the shop on the next two, and the rest are
fights. A map without three dead ends is thrown away and grown again.

**The tank in play** (`run/TankMap.ts`). Each room keeps whether it has been seen,
visited and cleared, and the pickups left in it. Rooms sit edge to edge in the world, a
room's size apart, so a door opens straight into the next room's. Entering a room puts its
terrain in the world and its views in the display slots, gives it back its pickups and its
fauna, and — the first time for a fight room (2–3 hostiles) or the boss room (4, until the
boss of stage 7) — deals its hostiles and shuts its doors. A room clears when its last
hostile is dead, and stays clear. Leaving through a door empties the room (`World.vacate`;
carcasses do not keep), and the camera slides to the next room over 0.35 s while the world
holds still, carrying the player to just inside the facing door.

**Baking ahead.** A room takes about half a second to bake, so the rooms next door bake a
few milliseconds a frame (`RoomView.prepare`, a generator run to a deadline), the one behind
the nearest door first, and whatever is left bakes under the slide. A crossing's worst
frame is about 20 ms. Starting a run bakes the start room at once.

**The minimap** (`ui/hud/Minimap.ts`) draws the rooms seen so far inside the tank's outline —
visited ones solid, the ones seen through a door dim, the current one lit — with a glyph on
the boss, treasure and shop rooms. It redraws when `TankMap.version` moves, which is counted
across every tank the page makes.

The column's systems are gone with it: size gates, the descent limit, the pocket under a
seal, forcing a seal and the shallows clock. They all existed to pace one open column in
which the easiest water was the best place to grow, and a tank of rooms with a boss as its
only exit paces itself. `git show 2bed3f0:docs/progression.md` has how they worked.

`zones.ts` stays, as the water looks and the species' home ranges.

## Run state

Held on `Game`: `stage`, `xp`, `food`, `taken` (id → stacks), `form`, `takenNames` (for the HUD
and pause sheet), `eaten`, `elapsed` and `tank`, the tank the run is in. `reset()`
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
ocean, after any other run it rolls a new one with the same body. **The daily best**
(`Best.daily`, `abyssal.daily` in `localStorage`) is that date's record and only that
date's — the next day is another ocean, so it replaces rather than accumulates. On a daily
the run strip races it (*today*) instead of the all-time best, the end screen says whether
the day was beaten, and the title's Daily button carries it. A daily still counts toward
the all-time best.

**Starting forms** (`run/starts.ts`). One per zone some run has reached —
`Codex.deepest`, backfilled from the kill counts. Nothing writes it since the column went;
the forms become one per tank reached with the descent (roadmap stage 7). They are: the Reef Wrasse hatches with Parrot Beak, the
Lanternfish with Photophores (smaller and quicker), the Angler Larva with Illicium
(slower), the Squid Paralarva with Mantle Pump and Ink Sac. The traits go through the
ordinary taken path, quietly, so they count toward families and synergies. The title
shows the unlocked forms as cards and the rest as what unlocks them, and remembers the
last pick; the end screens offer *Choose a body* to go back to it.

## The codex

The only thing besides the best scores that outlives a run. `run/codex.ts` keeps kills
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

## Hearts and the belly

Since roadmap stage 2 the player's health is **heart containers** in halves (`Run.containers`,
three to start; `Game` sets `hpMax` to twice it every frame), and hunger, XP and the level-up
draft are gone.

- **A hit is half a heart**, a guardian's a whole one, whatever landed it
  (`Creature.takeHit`). Every blow on the player goes through it — a bite or a blow
  (`Combat.hitPlayer`), recoil off spines (`sting`) — and it lands nothing during the grace of
  the last hit (`INVULN`, 0.8 s), which the body blinks through (`Scene`). Armour is a chance
  of shrugging a hit off, 5% a point to at most 40%, with a shorter grace. Venom and bleeding
  take half a heart every 1.5 s they run (`Creature.ail`), through no grace. The player's
  hearts come back from pickups, never from `regen`.
- **The swallow rule.** The player's bite swallows on the bite that would have killed
  (`Combat.swallows`), whatever the size, never a guardian; the player itself is never
  swallowed. Between the animals the old size rule holds, since their ecology runs on it.
  The player strikes at anything (`Creature.attacks`); what the ocean flees still goes by
  `preysOn`, so a larva is not what a mackerel runs from.
- **Carcasses.** A death that is not a swallow leaves one (`World.carcasses`): the body rolls
  belly-up (`FishView.lie`), sinks and settles on what is under it, and stays until the
  player swims into it — within the `gulp` reach, which is what the stat means now — or the
  room holds more than `CARCASS_MAX`.
- **The belly** (`run/Belly.ts`) fills with the centimetres swallowed (`World.playerGain`); at
  `BELLY_FULL` (45, about half a dozen nursery fish) it passes a pickup out behind the body —
  a half heart while there is health to fill, 60% of the time, else a shell. Pickups
  (`World.pickups`) sink, settle, and are taken by touch after half a second; a heart is left
  lying at full health. The heartbeat that warned of hunger now warns of the last heart.
- **Hostiles.** `Creature.hostile` animals take the player as their quarry whenever they are
  not tired, whatever else is in the water, and a tank keeps `hostileCount` of them in a room
  (`Spawner.hostiles`). The mackerel stands in until the roles of stage 4.

The heartbeat is `audio/sound.ts`, two synthesised sine thumps, woken on the first key or
press since a browser will not start audio before one, and muted with M.
