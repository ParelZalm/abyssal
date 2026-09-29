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

## Pedestals

The level-up draft is gone (roadmap stage 2); mutations are found on **pedestals**, one in
each tank's treasure room (roadmap stage 5). `traits.ts` holds 55 `Trait` records — id,
rarity, icon, description, an optional home `tank`, and an `apply` that mutates a `Genome`.

- **The pool is the tank's.** A mutation's `tank` is where it belongs — the column's bands
  folded into the three tanks: open water is the nursery, the reef shelf the reef, twilight
  to abyss the deep. It is dealt in its own tank and every deeper one, and leans ×1.6 at
  home; one with no tank is dealt anywhere. `RARITY_CLIMB` makes rare and apex likelier in
  each deeper tank. The nursery's pool is the unbanded cards and the open water's, plus
  Inflation (the pufferfish lives there now) and the two ranged primaries.
- **Dealing.** `dealMutations(rng, tank, taken, count, lean)` draws without replacement,
  weighted by rarity, home and `lean`. The treasure room deals its pedestal the first time
  it is entered (`TankMap.enter` → `Evolution.offer`), from the room's own seed, so what
  it holds reads the build as it is by then.
- **The deal reads the build** (`run/prospects.ts`). `completes(g, owned, form, t)` takes
  the card on a copy of the genome and asks the organ registry which synergies turn live,
  and `formDue` whether it is the third of a family. `leanOf` weights the deal ×1.5 for a
  completing mutation and ×1.15 for one that advances a family already begun. The pedestal's
  card says what taking it would finish (`Evolution.finishes`); an undiscovered synergy is
  announced but not named.
- **Taking one.** Beside the pedestal the mutation's card is shown at the top of the screen
  (`ui/hud/OfferCard.ts`, the draft's card in `ui/hud/cards.ts`); swimming into the mutation
  takes it (`Evolution.take`). There is no screen and no pause: Isaac's pedestal is walked
  onto.
- **Every apex card costs something**, and its text says so; **cursed cards** carry a
  `curse`, the price in red on its own line (the mechanics in `sim/organs/adaptations.ts`),
  and are offered only in the deal room, beside the deal mutations (*The economy*).
  `maxStacks` defaults to 2.
- **Near misses**: the end screen lists up to three things the run was one card short of
  (`nearMisses`).

**Cards rewritten for what was cut.** Hunger, XP and the boost are gone, and so is health in
points; a card whose effect fed one of them now says what it does instead:

- **Metabolism is the belly.** `Belly.full` is `BELLY_FULL × metabolism`: a hungrier body
  needs more to pass a pickup, so every apex card that cost metabolism costs pickups, and the
  cards that saved it (Efficient Gills, Swim Bladder, Fusiform Body, Ram) fill the belly sooner.
- **Regeneration is paid as a room clears** (`mendPerRoom`): half a heart per 1.6 above the
  hatchling's own, so Regenerative Tissue and Symbiotic Algae mend half a heart, Open Veins a
  heart and Abyssal Heart a heart and a half. A heart that fills by itself mid-fight is not
  Isaac's.
- **Healing in points goes through `Creature.heal`**, which pays the player a half heart per
  four points (Cnidocyte Graft's lifesteal, Nematocyst).
- **Siphon Jet** lunges harder, the boost's old kick now being the strike's. **Ballistic,
  Flash Sense and Smoke Screen** fire on the strike's kick. **Ram Ventilation**'s cost was
  hunger; now a still ram ventilator's belly empties, 6 cm a second (`burn`).
- **Stealth** against a hostile makes it slow to find the player — its first attack waits
  `STEALTH_DELAY` a point longer — and a spitter's shot go wide by `STEALTH_AIM`. A hostile
  always knows the player is in its room.
- **Gulp** is how far a carcass is swallowed from, and its cards say so.

## The economy

Roadmap stage 6: shells, keys and items, the shop and the deal room (`run/Pockets.ts`,
`run/TankMap.ts`, `content/items.ts`).

- **Pickups** are `World.pickups`: a half heart, a shell, a key, a chest, or an item. The
  player takes one by touch, if `World.takes` lets it — `Pockets.takes`, which holds a chest
  back until there is a key for it. `Pockets.collect` does the rest: shells and keys counted
  on the run, a chest opened for a key and spilling two or three pickups, an item put in the
  pocket (one already there is dropped, and lies 1.5 s before it can be taken back).
- **A cleared room drops** two times in five (`CLEAR_DROP`, in `Game`), where the fight was:
  shells 45, a half heart 22, a key 15, an item 12, a chest 6. The roll is the room's own
  seed.
- **Items** are one in the pocket, used on E (`Pockets.use`): the Food Pellet mends a heart,
  the Air Stone bursts (`World.burst`: everything within four tiles shoved out and stunned,
  every hostile shot inside broken), the Nerite Snail cures venom and bleeding. One that
  would do nothing is kept, and says so.
- **Keys.** A run starts with one. A shop's door takes one, and past the nursery a treasure
  room's does too; a chest takes one. A locked door is its gate band shut on its own
  (`Terrain.shut`, `'key'`), on both sides of the door, drawn as a brass grate; pressed
  against with a key it opens (`TankMap.open`).
- **The shop** stands three goods and a mutation on pedestals across its floor: three of a
  half heart (3 shells), the snail (3), the pellet (4), the air stone (5) and a key (5), and
  a mutation from the tank's pool for 15. Swimming into one pays and takes it; one that
  cannot be paid says its price.
- **The deal room.** Half of all tanks have one (`DEAL_CHANCE`, rolled with the map): a room
  off the boss room in a cell that touches nothing else, its door sealed (`'seal'`, a red
  grate) until the boss room is cleared, and not on the minimap until then. It stands a
  **deal mutation** for heart containers — Red Muscle, Stone Hide (1), Devourer's Jaw,
  Archer's Eye, Quill Storm (2): each an ordinary card pushed past its rarity — and a
  **curse** for nothing (Blood Lamp, Brittle Frame, Open Veins, Leaden Bones). A deal always
  leaves one container. Deals and curses are never dealt anywhere else.
- **Pedestals** in general (`TankMap.stock`): flat floor from the middle of the room out,
  3.2 tiles apart, the good hanging over each and a price tag between (`render/pedestals.ts`).
  The HUD's card says the price and how to pay it.

## Actives and charges

The one active slot fires on Space and recharges by **rooms cleared**, not by time — Isaac's
charges (`Organ.active.charge`): the Electric Organ every room, Ink Sac and Inflation every
other. A new active arrives charged. `PlayerController` holds the charge, `TankMap`'s
`cleared` hook gives it one, and the HUD draws a pip a room (`ActiveSlot`). Against a room's
hostiles: ink hides the player, so they abandon a wind-up and hold their fire while it
lasts; the shock stuns them; and Inflation, on the player, turns every hit aside while
swollen (`Organ.guard`) — a third of a hit cannot be taken off hearts.

## Primaries

The strike on the arrows is the **primary**, one slot like the active. With none it is the
bite. **Archer Spit** fires one jet of water for 0.8 of a bite; **Spine Volley** a fan of
three spines a quarter radian apart, 0.45 each (`Organ.primary`, `sim/organs/body.ts`). Each
is the nursery's own hostile's weapon, and each replaces the other and the bite for good. A
shot flies 7 tiles a second — faster than any hostile's — for 6.5 tiles (`SHOT_SPEED`,
`SHOT_RANGE` in `PlayerController`), and lands as a blow (`Combat.hit`), never a swallow, so
what it kills is left as a carcass for the mouth. The strike's kick still opens its window,
so the organs that answer a strike answer a shot. The body paints it: a water sac under the
jaw for the spit, a rack of loose quills for the volley (`bake/organs.ts`).

## The stat column

Isaac's left edge, under the status panel (`ui/hud/StatColumn.ts`, from
`PlayerController.stats`), in the room's own units: damage a hit, attacks a second, range in
tiles (the bite's reach, or a shot's), shot speed in tiles a second (a dash for the bite),
cruise speed in tiles a second, and armour as its chance to shrug a hit off.

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
with the room types it may be dealt as. Each tank deals its own: the nursery's eight, the
reef's five (coral heads, an arch, a lagoon, shelves, a boulder channel) and the deep's five
(a tall hall, a shaft, columns, a grotto, vent chimneys), every room mirrored half the time.

**Three tanks** (`TANKS`, `TANK_ORDER`): the Nursery at a 23-unit tile, its boss the mantis
shrimp; the Reef at 41, the Great White; the Deep at 74, the Giant Squid. Each tile is the
last times the descent's growth, 1.8, so a room is the same number of body lengths across in
every tank. What swims in a tank takes its `pace` — the tile's ratio to the nursery's — on its
species' speed, so a room takes as long to cross; its hostiles take `hostileHp` on their
health, since health rides size by a power over one and the larva's bite does not; a boss
takes the root of the pace and its own health (`Species.bossHp`).

**The descent** (`Game.descend`). The boss room's clear opens a drain in its floor
(`TankMap.clear`, drawn by `DrainView`); swimming into it takes the next tank: the body and
its swim ×`GROWTH` (1.8), the view rebuilt, a new map dealt, the lineage given a frame, the
codex's `tanks` raised, and the drop-in played. Past the last tank there is no next: the run
is won, on the *Released* screen, with the lineage.

**The drop-in** (`render/dropin.ts`) plays at the start of every run and at every descent,
3.6 s, any key skipping to its end: a dark gallery, the tank lit from a lamp in the water it
holds, gravel and rock heaped along its floor, the animal falling from above into a splash,
sinking and swimming down, and the view going into the glass. The phase is `dropin` while
it runs; the HUD is hidden and the tank's name is captioned over it.

**Starting forms** (`run/starts.ts`) are one per tank reached (`Codex.tanks`): the Hatchling,
the Reef Wrasse once a run has reached the reef, the Squid Paralarva once one has reached the
deep.

**The map** (`content/map.ts`) is dealt from the run's seed: 7–8 rooms grown out from the
start one neighbour at a time, a room added only where it touches exactly one other so the
map branches, and sideways preferred over up and down. The boss goes on the dead end
furthest from the start, the treasure room and the shop on the next two, and the rest are
fights. A map without three dead ends is thrown away and grown again. Half the time a deal
room is hung off the boss room (*The economy*).

**The tank in play** (`run/TankMap.ts`). Each room keeps whether it has been seen,
visited and cleared, and the pickups left in it. Rooms sit edge to edge in the world, a
room's size apart, so a door opens straight into the next room's. Entering a room puts its
terrain in the world and its views in the display slots, gives it back its pickups and its
fauna, and — the first time for a fight room (3–4 hostiles) or the boss room (its boss,
`Spawner.boss`, at the far side of the room) — deals its hostiles and shuts its doors. A room clears when its last
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
  unfound keeps its slot as `???`, since what is left to find is the point. A pedestal's
  card for a mutation never taken carries a *new* mark beside its rarity.

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
  hearts come back from pickups, and from regeneration only as a room clears (*Pedestals*).
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
  `BELLY_FULL` (45, about half a dozen nursery fish) times the body's metabolism it passes a
  pickup out behind the body —
  a half heart while there is health to fill, 60% of the time, else a shell. Pickups
  (`World.pickups`) sink, settle, and are taken by touch after half a second; a heart is left
  lying at full health. The heartbeat that warned of hunger now warns of the last heart.
- **Hostiles** fight by their role (`sim/roles.ts`, and *Hostile roles* in `simulation.md`).

The heartbeat is `audio/sound.ts`, two synthesised sine thumps, woken on the first key or
press since a browser will not start audio before one, and muted with M.
