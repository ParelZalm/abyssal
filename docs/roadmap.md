# Roadmap: the tank rework

Decided September 2026, on `rework/gameloop`: the open water column becomes a chain of
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
- **Controls.** WASD swims, no boost. Arrows attack in four directions; the body stays
  level for up and down. Space fires the active mutation, E the held item.
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
  shadow away from the water. A room is ~50 hatchling lengths across and ~6.5 s to swim; speed is a stat now, so tune the base with the stat column (stage 5).
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
first time, their hostiles behind shut doors, cleared when those are dead, and a 0.35 s slide
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
shells, keys and the pocket, used on E; a cleared room's drop (two in five); doors that take
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
leaning toward damage. The cards say damage, not bite; the Siphon Jet speeds shots too. The
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

## Later

Bomb fish and secret rooms; tanks four and five (the sperm whale, the colossal squid, the
Leviathan in the basement tank); an ending cutscene.
