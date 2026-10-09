# Roadmap: the tank rework

Decided September 2026 and worked on `rework/gameloop` until it was merged into `main` as
0.2.0 (October 2026; stages since are branches off `main`, [releasing.md](releasing.md)): the open water column becomes a chain of
tanks made of rooms, played like *The Binding of Isaac*. Why, and what it replaces, is in
[adr/0003](adr/0003-tanks-of-rooms-replace-the-column.md); the words are in
[`CONTEXT.md`](../CONTEXT.md). The fun pass that came before is finished and lives in the
history (`git show a2d4349:docs/roadmap.md`).

Each stage is committed on its own and leaves the game playable. **A stage is not done
until what it draws is on the design board** (`/design.html`, `src/design/catalog.ts`):
every room template, tile, obstacle, role, pickup and boss gets a cell over its tank's
water, the way every body plan already has one. Mark a stage done here in the same commit
that finishes it.

## The shape of version 1

- **Three tanks.** The nursery (boss: a mantis shrimp), the reef tank (the Great White),
  the deep tank (the Giant Squid). Beating the squid is a win: "released".
- **6–8 rooms a tank**, one screen each, side-on, a fixed camera that slides between
  rooms. One start, one treasure, one shop, one boss, at least three fights; a deal room
  may open after the boss. The minimap is drawn inside the tank's outline.
- **Controls.** WASD swims, no boost. Arrows attack in four directions, and each points
  the body — nose-down to shoot down; shots lean with the swim. Space fires the active mutation, E takes what the player is beside
  (a pedestal's good, an item lying loose), Q uses the held item.
- **Hits.** Half a heart each, a boss's a whole one, ~0.8 s of invulnerability. Armour is
  a chance to shrug one off, capped near 40%.
- **Swallowing.** A bite that would kill swallows instead; so does reaching a carcass.
  Ranged kills leave a carcass; a boss is never swallowed. Gulp is swallow reach. The
  belly fills with what goes down, and a full belly passes a pickup.
- **Descent.** Size ×~1.8, the next tank authored at that scale, nothing else changes.

## 1. ~~The room frame~~

Done: `content/tanks.ts` (the nursery tank and its first template), `sim/terrain.ts` (the
grid and circle collision, which every body now meets), `render/room.ts` (the rock baked
onto the pixel grid, drawn over the bodies), `Camera.hold`, and Isaac's keys — WASD swims,
the arrows strike four ways, Space fires the active. The column's systems are out: `Bands`,
the descent limit, the pocket, the squeeze, the shallows clock, depth labels, the depth bar
and the gate label. The board has a Rooms group.

What it found, and what it leaves:

- **The lunge had to give way to kiting.** A full lunge at a pursuer threw the body back
  into it; a strike thrown against the swim keeps a quarter of it.
- **The strike took the boost's seam** (`Creature.kick`), so Ballistic, Flash Sense, Smoke
  Screen and the bait-ball scatter fire on a strike instead of dying with the boost.
  Whether that is right for each of them is stage 5's question.
- **World-sized particulate turned to stars** at a room's zoom; it is now sized in screen
  terms. The water shader's clouds are world-sized too and read well enough — look again
  when a tank's zoom falls at the descent.
- **Nothing avoids a wall.** A shoal heading into one presses against it until its wander
  turns it. Stage 4.
- **Rooms grew, and the rock went smooth.** The first cut was 24 × 14 tiles of squares and
  felt cramped and blocky. A template is now 32 × 18, and the rock is the smooth shape the
  tiles imply, collided on quarter-tile cells, and broken into lit stones that sink into
  shadow away from the water. A room is ~50 hatchling lengths across and ~6.5 s to swim (~5 s since `TEMPO`); speed is a stat now, so tune the base with the stat column (stage 5).
- **The rock is reef rock**: knobbed limestone heaped in lumps, pitted, crusted pink and
  violet, turf on its tops.
- **A room bakes in ~0.5 s** on a 1024-wide window, more on a big one. Fine once a run; at
  every door in stage 3 it has to be baked ahead or off the frame (a worker, or a few rows a
  frame), or the slide hitches.
- Still here from the column, for the stages that replace them: the thermocline uniforms
  in the water shader, the level-up draft and hunger (stage 2),
  the starting forms' depth unlock (stage 7), and the parallax scenery (stage 8).

## Art pass (pulled forward)

Done after stage 1, from two reference frames (`docs/media/reference/`, and *Art direction*
in `rendering.md`): the rock is dark pebbled stone with lit caps, the water navy, the
player a pale glowing larva (`Genome.pale`), and the frame dark and made by its lights
(`render/lighting.ts`). A first decoration pass is in (`render/decor.ts`), taken from stage
8: sponges, anemones, kelp, coral, brain coral, sea grass, glow bulbs and a crate, placed
along every upward face.

Left for later: the tank frame of the first reference (rooms stay cave for now), decoration
hanging from ceilings and on walls, a crate that turns up more often, and tuning the dark
by eye.

## 2. ~~Hearts and swallowing~~

Done: heart containers in halves, every hit on the player through `Creature.takeHit` (half a
heart, a guardian's a whole one, 0.8 s of grace it blinks through, armour a shrug chance),
venom and bleeding in half hearts on a clock; the swallow rule (the bite that would kill,
any size, never a guardian); carcasses that sink, settle and are swallowed from `gulp`
reach; the belly (`run/Belly.ts`) passing a half heart or a shell; pickups taken by touch;
the HUD's pixel hearts, belly bar and shell count. Out: hunger, `Metabolism`, XP, the
level-up draft and the reroll. The board has a Health & pickups group.

What it found, and what it leaves:

- **The player has to be able to bite anything.** `preysOn` is a size rule, and the combat
  used it for the player too — a larva could not touch a mackerel. `Creature.attacks` is
  the combat's question now; `preysOn` stays what the ocean flees by.
- **A hunter goes for the nearest meal**, so a mackerel in the room ignored the larva.
  `Creature.hostile` takes the player as quarry whenever it is not tired; two mackerels
  stand in as the room's hostiles until stage 4. Idle, a larva lasts about six seconds
  against them; six strikes swallow one.
- **Nothing gives mutations now** until the pedestals (stage 5), so a run is a fight in
  one room: the draft, `prospects.ts` and `MutationScreen` wait for it. `regen`, `lifesteal`
  and the Veins curse have little to act on with hearts; stage 5 rewrites those cards.
- Heart drops are random (`Math.random`), not the seed — fine until rooms clear (stage 3).

## 3. ~~The tank and its map~~

Done: `content/map.ts` deals a 7–8 room map from the seed with the types on dead ends;
`run/TankMap.ts` runs it — rooms edge to edge in the world, entered with their fauna and, the
first time, their hostiles behind shut doors, cleared when those are dead, and a 0.25 s slide
between rooms with the world held still. Doors are carved through the middle of each side
with a neighbour and shut as a solid gate band with a grate drawn across. The minimap sits
top right, in the tank's outline. Six more nursery templates, eight in all, each tagged with
the room types it may be. The board draws every template doored and gated, and a minimap.

What it found, and what it leaves:

- **A room bake is the cost of a door.** Half a second, so the rooms next door bake a few
  milliseconds a frame, nearest door first, and the rest under the slide; a crossing's
  worst frame is ~20 ms. Starting a run still bakes its first room at once.
- **The HUD outlives a run**, so the minimap's version has to be counted across tanks, or a
  new run's first map matched the last run's and never drew.
- Treasure, shop and boss rooms are rooms of their type with nothing of it in them yet
  (stages 5, 6 and 7); the boss room holds four mackerels. A cleared room drops nothing
  until the economy (stage 6).
- Fauna is topped up in every room, cleared or not, which keeps the tank alive between
  fights.

## 4. ~~Hostile roles~~

Done: `sim/roles.ts` is a hostile's brain — charger, spitter, turret and drifter, each a
wind-up, strike and recovery on `Creature.attack`, in tiles and tiles a second so they hold
across tanks. Shots (`World.shots`, `render/shots.ts`): a jet of water, a spine, a blob of
light, each lit. Any hostile's touch is a hit. `Flow` takes hostiles round the rock between
them and the player, and every body turns off rock ahead (`clearHeading`). The nursery's
hostiles are the mackerel, the archerfish, the pufferfish and the sea nettle; the reef's
(ribbon eel, triggerfish, lionfish, moon jelly) and the deep's (barracuda, gulper, vampire
squid, anglerfish, siphonophore) have their roles for when those tanks arrive (stage 7). A
fight room is three or four, two at most of a role. The board has a Hostile roles group:
each in motion on the sim's timings, and each shot.

What it found, and what it leaves:

- **A pose in the dark is not a tell.** Outside the larva's pool a mackerel winding up could
  not be seen at all. Every hostile now throws a faint light of its own, which flares warm
  through a wind-up: the lighting is the tell, which is the art direction's own terms.
- **The danger frame closed on everything.** It warned of what could swallow the player,
  and a room is full of hostiles; it now closes only on a hostile's body nearly on the
  player's, by half.
- Idle in a room of a mackerel, an archerfish and two pufferfish, a larva lasts about eight
  seconds, half to bites and half to shots.
- The old hunt is still what non-hostile hunters run, and `Creature.quarry` is the fallback
  for a hostile with no role. Knockback on a struck hostile, and a charger's dash ending on a
  wall rather than pressing into it, are left for tuning. The death screen still says
  EATEN (stage 7's end screens).

## 5. ~~Pedestals and power~~

Done: the treasure room's pedestal — a plinth on flat floor under the middle of the room
with the mutation lit over it, its card read at the top of the screen, taken by swimming
into it. The pool is the tank's (`Trait.tank`, `dealMutations`), leaning home and toward the
build. The actives charge by rooms cleared (Ink 2, Electric 1, Inflation 2), drawn as pips
on Space. The stat column. Archer Spit and Spine Volley replace the bite for good, each
painted on the body; the player's shots are `World.shots` and leave carcasses. Ballistic,
Flash Sense and Smoke Screen fire on the strike. The board has a Pedestals & power group.

What it found, and what it leaves:

- **Every role ran at double speed** since stage 4: the ecology's strike clock ran on
  hostiles beside the role's own, and a recovery ended with no cooldown. A spitter fired
  about every second and a half, not every three. Fixed; an idle larva now lasts about nine
  seconds in a room of four.
- **A third of the cards fed a cut system**, and are rewritten rather than cut: metabolism
  became the belly's size, regeneration a mend as a room clears, lifesteal half hearts, the
  boost the strike, Ram's cost the belly draining, stealth a slow, inaccurate hostile. The
  draft screen is gone; its card is the pedestal's.
- **Inflation on the player turns every hit aside** while swollen: a third of a hit cannot
  come off a heart.
- A body leaving a room from the edge of a door arrived in the rock beside the next one;
  arrivals are held to the opening now.
- Range, shot speed and the shots' own speed are constants on the stat column until
  mutations move them — the stage 6 items and the deal mutations are where they would.

## 6. ~~The economy~~

Done: pickups for keys, chests and three items (`content/items.ts`); `run/Pockets.ts` for
shells, keys and the pocket, used on Q; a cleared room's drop (two in five); doors that take
a key (the shop's, and past the nursery the treasure room's) and the deal room's seal, both
`Terrain.shut`; the shop — three goods at 3–5 shells and a mutation at 15; the deal room in
half of all tanks, sealed beside the boss room until it is cleared, with a deal mutation for
heart containers and a curse for nothing. Pedestals generalised to every room that offers
something, each with its price in the water. The HUD counts keys beside shells and shows the
pocket bottom right. The board has a Shop & deals group.

What it found, and what it leaves:

- **The deal room is known before the boss.** Isaac rolls the devil door after the boss;
  here the room is rolled with the map, so its sealed red door stands in the boss room from
  the first visit. A door carved later would mean rebaking the room mid-fight. Stage 7 may
  hide the seal until the boss dies.
- **The deal room hangs off the boss room**, so a tank's map can have eight or nine rooms;
  a boss room with no free cell beside it simply has no deal.
- Five deal mutations to start: Red Muscle, Stone Hide, Devourer's Jaw, Archer's Eye and
  Quill Storm (a fan of five, the primary read off the genome now). The curse cards still
  speak of guardians, and the deal is paid in containers only.
- Rolling the deal room moved the map's stream: a seed deals a different tank than it did.

## 7. ~~Bosses and the descent~~

Done: `sim/bosses.ts` — the mantis shrimp's punch (a new plan, `mantis`, its club folded
under the head), the Great White's charge and the Giant Squid's grab, its arms torn free
one at a time — each fitted to one screen, with a boss bar. The reef and deep tanks, at 1.8
and 3.24 times the nursery's scale, with their fauna and hostiles, their animals' speed and
health scaled to it; every layout dealt in every tank, mirrored half the time. The drain in
the boss room's floor, the descent (growth ×1.8, the next tank dealt) and the drop-in at the
start and at every descent. The *Released* screen, with the lineage. Starting forms one per
tank reached. The board has a Bosses & the descent group: each boss's tell on a loop, and
the drop-in into each tank.

What it found, and what it leaves:

- **The cull measured from the camera**, which is still on the last room just after a slide:
  a boss put at the far side of its room was dropped, alive, on its first frame, and the room
  cleared empty. It is round the room now. Fight rooms lost far hostiles the same way.
- **A hostile ate its way out of its own tell**: a bite on passing fauna ends a strike, so the
  Great White's charge was cut short by fry. Hostiles fight the player and nothing else, and
  no longer regenerate.
- **Bosses need their own pace.** The tank's full pace put the Great White's rush past what a
  tell can answer; none left the Giant Squid a quarter minute to cross its room. They take
  its root.
- An idle larva lasts about eight seconds against the mantis shrimp: three whole hearts.
- The mantis shrimp is a plain body so far — a green armoured trunk and its club; stalked
  eyes, banding and legs are for the liveliness pass. The reef and deep tanks have no rooms or
  decoration of their own yet (stage 8), and the deal room's seal still shows before the boss.

## 8. ~~Liveliness~~

Done: decoration on every face — floors, ceilings and walls — and a set per tank
(`DECOR_SETS`): the reef's sea fans, coral, snagged nets and its centrepiece, the wreck with
its lamp; the deep's tube worms, sea lilies, glass sponges and glow-worm threads, which light
its rooms; chains, weed and barnacles where they belong. The reef and the deep tank have
their own room layouts, five each, the overhangs, arches, columns and chimneys that block
higher up. The reef's fauna grazes plankton too. The mantis shrimp got its armour bands and
stalked eyes. The board's *Decoration* group has every kind and the tanks it grows in; the
*Rooms* group every layout in its own tank's dress.

What it found, and what it leaves:

- **A room hung as thickly as its floor grows is shut.** Ceilings and walls carry under half
  a floor's cover.
- **The deep is seen by its threads.** With no weed and no lamp but the larva's, a deep room
  was black; hanging glow-worm threads from every ceiling made it a cave you can read.
- Decoration now runs to 110–145 pieces a room; a crossing's worst frame is ~16 ms.
- Not done: a wreck on its side as an obstacle, which wants a tile of its own in the
  templates; bottom-dwellers (crabs, shrimp) that walk the floor; per-tank rock colour.

## Balance: a ranged start and Isaac's curve

Done after stage 8, from playing it: a melee start was the game's hardest matchup, since a
room's every hostile hurts by touch. Every larva now hatches with Archer Spit, at a whole hit
a shot (it was 0.8 of a bite); the bite comes back as the Lunging Bite, a reef card, for twice
a shot and the swallow. Hostile health follows Isaac's curve instead of cancelling the size
difference between tanks (`hostileHp` 0.55, 0.8, 1.1), the bosses' armour is down to two or
three and their health set to match (200, 420, 700), and a boss leaves a mutation by the drain,
leaning toward damage. The cards say damage, not bite; the Siphon Jet speeds shots too. Shots reach 10 tiles, not 6.5: Isaac's number is half his room and was a fifth of ours. The
board's *Pedestals & power* group has the bite beside the two shots, and the larva spitting.

What it found, and what it leaves:

- **Flat armour broke the bosses.** A Great White at armour 5 took two thirds off every spit,
  and the fight was ~330 spits, the Giant Squid's ~160; nothing had been tuned against a
  ranged primary.
- **The nursery took two to three times Isaac's shots.** A mackerel was ten spits or eight
  bites; it is five spits now, an archerfish three.
- Gill Rakers' 40% now reads on every shot, which makes it a trap for a ranged body; the
  grazer card wants rethinking. There is still no card that raises the attack rate — Isaac's
  most common kind — and one would want a body part to show it.

## Hitboxes and hits

Done next, from playing it: hitboxes are the body as drawn (`sim/hull.ts`), not a circle a
third of a size across at its middle — a mackerel is now hit from nose to tail root, where it
was hit across a third of its length — and while a room is locked the player's shots and bite
pass through its fauna. A hit whitens the body, knocks it along the blow, lights it and sprays
the shot back off it; a kill lights the room round it. An idle larva still lasts about nine and
a half seconds in a room of four, so contact on the whole body did not make a room deadlier.

## Floating dead, and a closer ring

The dead float belly-up where they died instead of sinking to the floor, where they were lost
among the rock and decoration (`HANG` in `sim/world.ts`, a slow bob in `FishView.lie`). The
ring round the larva is drawn at three of its radii, not four and a half, and fainter.

## Boss fights: the room as a weapon

Done next, from playing it: each boss has a set piece of its own and a way to be beaten with
the room, each told the first time by a toast that names its answer (`World.cue`). The mantis
shrimp is fought in its own den (`nursery-den`), whose clefts — a new tile, `|`, narrow enough
for the larva and not for it — jam its head in a punch thrown after the larva, and it digs up
urchins that burst under the roof into a sinking fan of spines, which a ledge keeps off. The
Great White is dazed long by rock and briefly by a miss, and breaches from the floor under
the player after its bubbles and the charge bar. The Giant Squid snags its arms on a pillar
ducked behind through its tell, and draws the player in down an open line before it lashes
(since replaced by its ink, below).
The board has each move in *Bosses & the descent*.

What it found, and what it leaves:

- **A hostile hunting a larva in a cleft pressed against the rock nearest it.** `Flow` only
  walks open water, so the cleft was off the map and the way ran out; it now walks the
  target's own pocket out to the open.
- **Parked on the mouth of a cleft, the wary shrimp trapped the larva under its own rain.** It
  stands off a larva in a narrow place now.
- **An urchin thrown from under a shelf broke on it**; the shrimp only lobs along an open arc.
- The nursery and deep boss rooms are fixed layouts now (the den, the pillars); the reef's
  are still the arch or the channel, both of which have rock to lure a rush into. A larva that
  grew past about 18 cm in the nursery no longer fits the clefts. The snagged squid's resting
  arms still reach past the pillar they are wrapped round; its size makes that hard to hide.

## ~~Hostile movesets: the nursery~~

Done next, from playing it: the bosses were fights and the rooms between them were not,
since every species of a role ran the same brain. A role is now the skeleton and a moveset
(`Species.moves`) how one species plays it, with a turn at half health — a stagger, a ring,
the body rebuilt to show it — at most two hostiles winding up at once, and deaths that leave
something (`Roles.died`). The mackerel come in pairs, circle, and dash one at a time,
chaining a second dash once turned; the archerfish fires bursts of three and, turned, shoots
from cover; the pufferfish puffs braced up close, bounces off the walls throwing fans once
turned, and pops into a ring; the sea nettle pulses, trails stings that hang in the water,
and buds into two ephyrae. The board's *Hostile roles* group has each moveset beside its
turned body, and the sting.

What it found, and what it leaves:

- **The accent is not a phase.** A mackerel turned by its accent hue looked the same: on a
  darter the accent is a few dots. The frenzy flushes the whole body.
- **Cover looked for afresh never settled**: from wherever the archerfish was, the nearest
  cover was always a little further on. It keeps a spot while the player cannot see into it.
- An idle larva lasts about nine seconds against two mackerel and an archerfish, and fifteen
  against a pufferfish, an archerfish and a nettle.
- The dev panel's *clear the room* kills the ephyrae as they bud, which is what it is for.

## Shot organs

Done next, asked for: eight mutations that change what the shots do rather than what fires
them, stacked on any primary and on each other, as Isaac's tear effects are — Cavitation
bursts, Vent Gland burns and spreads from the dead, Surface Halo calls a shaft of light,
Galvanic Cells arcs on, Needle Jet passes through, Hunting Nares bends, Brood Pouch breaks
into fry, Brine Gland chills and shatters (`sim/organs/shots.ts`, *Shot organs* in
`progression.md`). Each marks its shot's shape or colour and is painted on the body. The
board has a *Shot organs* group.

What it found, and what it leaves:

- **Fire cannot be orange.** The player's shots keep off the hostiles' hot colours, so the
  burn is a vent's sulphur and the light a pale gold; a red flame would read as incoming.
- With all four of the reef and deep damage cards, a room of three reef hostiles fell to ten
  spits in three seconds, where the numbers say about eighteen without them. Nothing is tuned yet
  against a full stack; no synergies pair them yet (a burst that scalds, a chill that arcs).

## ~~Hostile movesets: the reef~~

Done: the reef's four play their roles their own way (*Movesets* in `simulation.md`). The ribbon
eel waits in a hole in the rock with its head out, lunges along the line out of it, swims to the
nearest hole and backs in tail first, and turned hunts in the open; the triggerfish's jet throws
the player along its line, and it works round to blow the player into the others, and turned it
goes red and charges; the lionfish herds with a fan of five at the player, and turned flares into
fan and ring together; the moon jelly fades out of the room, untouchable and quicker, and back,
and turned stays and buds an ephyra every few seconds. The triggerfish, lionfish and moon jelly
have their turned looks as wounded frames recoloured from their sheets (`--wounded-palette`). The
board's *Hostile roles* group has each whole and turned, the eel in a block of rock.

What it found, and what it leaves:

- **An eel's body swings in the rock.** Its head follows the player by turning the body about
  the mouth, and a hole checked only straight in showed the tail swung up over a ledge a tile
  thick. A hole now has rock for the body at either edge of the cone, which puts most of them in
  the room's outer walls, floor and ceiling.
- **An ambusher can be sat out.** Two eels left in their holes never lunged at a larva off their
  lines. An eel now moves, after five seconds of nothing on its line, to a hole that has the
  player on it; idle against two, a larva takes a hit about every seven seconds.
- **The jet fired as soon as it could**, from wherever it was, and blew the player anywhere. It
  holds its jet until it is behind the player from the others, for a second and a half at most.
- Ephyrae and their mother converge on the player by the same water and stack on it; nothing
  keeps hostiles apart. The deep's movesets are next.

## ~~The Giant Squid's ink~~

Done next, from playing it: the squid's grab could not be read — which way to pull to tear
free — and at full size, arms out, it took the room. It inks now and is gone, shows as
ghosts round the player (three, five under half health), and on the lock the real one
resolves, colours, arms and the tell's ring, and lunges down its line; the rest go. A lunge
into rock snags it on the pillars. Drawn at six tenths; the grab, the draw and the torn arms
are gone (*A boss does not hold the player* in `decisions.md`). The board's *Bosses & the
descent* has the ink.

What it found, and what it leaves:

- **A tint cannot make a red animal pale.** It only multiplies, and a red squid tinted pale is
  a darker red. The ghosts went out first as the body washed out through the skin's flash,
  which left them without arms — the arms are plain meshes the flash does not reach — and they
  read as missing their tentacles. Their noses are four to six tiles off, so their arms reach
  for the player without meeting over it.
- **Ghosts alternated sides by how many had been found**, so a side walled off by a pillar
  was tried for good and a room showed one. By the try now: three whole, three or four hurt.
- Five ghosts rarely fit the pillar room round a larva near a wall; it shows what fits.
- **A filter cut the ghosts' arms off in a box.** Pixi draws a filter only inside the bounds it
  finds for what the filter covers, and takes them from the meshes rather than from any area
  set by hand, so neither a filter per view nor one over all of them with `boundsArea` held
  the arms. There is no filter now: a ghost's body is washed out through the skin's flash and
  each arm drawn from a pale copy of its picture, at half alpha, since eight of them lap over
  each other (`FishView.ghost`).
- **The boss intro showed the squid's mantle alone**: its portrait was the bake, which is the
  body without the rigged arms. A rigged body's portrait lays them out from the crown, fanned
  a little (`FishView.portrait`), and a portrait taller than the intro's slot is shown at a
  whole divisor rather than overflowing it.
- **The board's boss cells drew every boss painted**, never having been handed the species
  since the sprites went in; they draw the sprites now.

## ~~Items: Isaac's stats, multishot and the brood~~

Done next, asked for: the pool reworked toward Isaac's stats — speed, damage, tears, shot
speed, range, the amount a strike throws and the effect its shots carry — with the synergy
between them left to the systems, as his is (*The stats and the pool* in `progression.md`).
Tears, range and shot speed are genome stats (`tears`, `reach`, `velocity`), and a dozen cards
that moved turning, sense or the belly move them now. Every card has Isaac's word for it
(`Trait.tagline`) and its numbers computed on this body as before → after (`traitDiff`), on
its card and as a strip of arrows over its pedestal. Multishot — the Parietal Eye (Inner Eye),
Twin Spout (20/20), Four-Eyed Fish (Mutant Spider) — and the Mouthbrooder, a primary of homing
fry that latch and bite (C-Section); one synergy, Shoal Hunt, for the two together. Every
mutation has a drawing of its organ (`render/itemart.ts`), and the pedestal is an altar with a
lit niche, a shaft of light and the good's shadow. The board has a *Mutation art* group, and
the brood and the multishot on each primary in *Pedestals & power*.

What it found, and what it leaves:

- **A card's own percentages drifted from the body.** Siphon Jet said "40% faster" of a shot
  speed the column showed, and Gill Rakers' 40% on every hit showed nowhere. Computing the
  card from the genome is what keeps it honest; the `desc` says only what no number can.
- **Two multishot taxes multiplied left a body firing once a second**, so only the worst is
  paid, as in Isaac. Twin Spout pays none and doubles a spit's damage on one target; it is a
  reef rare for that, and the first to look at if the reef gets easy.
- **Three fry on the nearest body wasted two**, which is what Shoal Hunt is for; without it a
  fan of fry is still three fry, just less clever about it.
- The drawings are painted in code, from shapes and a light, which reads at 20 pixels; a
  generated sheet could replace any of them through the same `ITEM_ART` seam. Belly, sight and
  stealth cards are still in the pool as utility, each with its numbers on the card.

## ~~Hostile movesets: the deep~~

Done: the deep's five play their roles their own way (*Movesets* in `simulation.md`). The
barracuda hangs across from the player, creeps into its row and crosses the room the moment
the player is on its line, stunned against the rock it stops on, and turned ricochets three
dashes off the walls; the gulper eel opens its jaw and draws the player and the player's shots
in, swallowing the shots, hangs its jaw exposed after a gulp that took nothing, and turned
spits back a fan for what it swallowed; the vampire squid's bolts bend after the player, and
turned it balls up inside out when the player comes close — its arms swept back over the
mantle, braced — then bursts into a cloud of stinging motes and jets away; the anglerfish's lure
flares and lets three to five violet sparks out of it (`lumen`) to hang beside it on a fan,
taking aim, and fire at the player one after another, and turned it lunges; the siphonophore breaks in two where the blow that turned it landed, each piece a
stretch of its picture (`cutSprite`), and a long piece breaks again. The board's *Hostile roles*
group has each whole and turned, the siphonophore in its two pieces.

What it found, and what it leaves:

- **The deep's pace is already in its speeds.** A dash multiplier for the line and the lunge
  put the barracuda at 57 tiles a second and the anglerfish's lunge across half the room; a
  charger's own dash at their speeds is the room in a second.
- **A door is open water to a dash.** The barracuda's first line ran out of the room through
  a door on its row. The room's edge is rock to it.
- **The gulper's jaw is in tiles, not in its head's depth**, which was half a tile and let a
  player drawn to a tile off the lips go free; and a touch ended the draw as it ends a dash,
  so the turned gulper never spat. The draw goes on to its snap.
- **A ring let go wherever its spin had it hit nothing.** The anglerfish first hung six bolts on
  a turning ring round its lure and let them go along their spokes, which left a still player
  between two nearly every time. Its bolts now hang still on a fan and each fires at the player
  as it goes: still, a hit five volleys in six; moving, two in twenty seconds.
- **The vampire squid's ball is its rigged arms**, swept back over the mantle (`FishView.cloak`),
  not a picture: a frame of the animal inside out could replace it. None of the deep's turned
  looks are drawn; each turns in what it does.
- An idle larva lasts 9 to 15 seconds against three of the deep's, about the nursery's; the
  siphonophore's pieces and the gulper's draw land most of it.

## ~~The player fish rework~~

Done but for Twin Spout's second sac, which is still painted. Decided October 2026: the larva and every plan it can become are still painted from the
genome (`render/creature/fishbake.ts`, the painters in `bake/`), and since the enemies went to
authored sprites (`docs/sprites.md`) and the mutations to drawn items (`render/itemart.ts`,
[sprite-prompts-items.md](sprite-prompts-items.md)), the player is the roughest thing on the
screen. Its look is reworked to their standard, and it stays a body that mutations visibly change
— the reason it was never a sprite.

**Every mutation's mark on the body is in it**, the ones the items rework added with the rest,
and each reads as the organ its item draws, so a pedestal's good and the body that took it are
one picture:

- the multishot and the brood: the Parietal Eye's lit third eye on the crown, the Twin Spout's
  second water sac, the Four-Eyed Fish's second eye over the first, the Mouthbrooder's throat
  pouch with the fry looking out (`bake/shotorgans.ts`, `bake/head.ts`);
- the stat cards' morphology, which says tears, range and shot speed now: the fins of the
  Pectorals, the tail of the Caudal Fin, the lateral line, the bladder, the barbels, the
  pressure gland's jaw;
- everything already painted: the primaries' sacs and quills, the shot organs, the actives,
  the reef and deep organs, the curses, and the named synergies.

Decided as it started: **drawn bodies and drawn parts.** Each body the player can be — the
larva and the five forms — is a picture, bare, and every mark a mutation makes is a picture of
its own part, placed on the body by `edgeAt` (the plans' spines and depth curves kept, the
painting replaced). The painters taken further was the other way, and the enemies showed how
far a painter gets from a reference. Reference images first, the larva's before anything is
built: the prompts are [sprite-prompts-player.md](sprite-prompts-player.md). The board's
*Mutations* and *Builds* groups are where the result is judged, every mark on the body beside
its item.

**The larva is in** (`BODIES`): its bare body and its own parts — the eye, the fin folds, the
tail, the pectoral — drawn, and laid into the bake, each part stretched as its painter would
grow it, so the Pectorals and a sharper eye still show. The head's and the tail's
mutations are drawn too (`SpriteArt.marks`): the Tapetum's eye and the Forked Caudal Fin's tails
in the round ones' places, the jaws, the beak, the lures, the second and third eyes, the halo,
the nares, the pores, the pouch, the barbels, the needle, the siphon and the bloom, each placed
where its painter put its painted one (`Sheet.mark`). The rest is still painted, placed on the
drawn outline and shaded in the drawn swatches. The back, the belly and the flank are drawn too
(`docs/sprite-prompts-player.md`), each part placed at every point its painter paints one and never
shrunk past half its drawing (`Placed.least`), the coats clipped to the body. The last of
the painted marks — the Gill Rakers' comb and slits, the Crushing Pharynx's jowl and plates, the
Moray Jaws' second jaw, the Urchin's thorns and the Whale Shark's spots — are drawn too; Twin
Spout's second sac is the one still painted. All five forms are drawn: the Shark, the Squid, the Moray and
the Angler each with jaws and lures of its own, and the Bloom, a bell whose strike is a pulse,
wearing the larva's jaws and lures on a mouth at its bell's front.

## ~~Bomb fish and secret rooms~~

Done: Isaac's bombs and secret rooms (*The economy* in `progression.md`). F releases a bomb fish
where the body is; it hangs, sinking slowly, swells over 2.5 s and bursts over a door's width,
hitting every hostile in reach for eighteen of the player's hits, the player for a whole heart,
and breaking pots — Isaac's numbers: any ordinary hostile ended, a quarter off a boss. Until it bursts it moves as Isaac's does: shoved by the body, knocked by a shot
or a strike, slowed by the water. A run starts with one, and they drop as keys do and sell for
five shells. Every tank has one secret room, in the free cell touching the most rooms but
never the boss's or the deal's, its doors cracked rock that a bomb fish breaks, with a hoard
inside. The board has the bomb fish loose and lit (*Shop & deals*) and a room with a cracked
door (*Rooms*).

What it found:

- **The crack was invisible.** A dark seam on the rock vanished in the wall's own shadow; it
  is a dark line lit pale on both sides now, and the door casts a faint light of its own, so a
  player who looks finds it and one who does not, does not.
- **At a pickup's size the lit bomb fish read as a glow**, its warm bloom swallowing the fish.
  Lit, it is drawn at twice the size, pale, and lights itself; only its spine sparks.
- **A bomb laid under the body would shove at once.** It does not touch the body until the
  body has swum off it, as Isaac walks off his; and an open door is a gap in the rock, so one
  knocked through it is held in the room rather than bursting off the screen.
- Terrain is not destroyed: the cracked door is carved like any door and shut, and its rock is
  a plug baked once with the room and hidden when the door opens. Rock that breaks anywhere
  would mean re-baking a room, which costs half a second.

## Later

Tanks four and five (the sperm whale, the colossal squid, the
Leviathan in the basement tank); an ending cutscene.
