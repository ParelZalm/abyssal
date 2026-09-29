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
  in the water shader, the level-up draft and hunger (stage 2), `Creature.quarry` (stage 4),
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

## 2. Hearts and swallowing

- Hearts in halves, hits and invulnerability, armour as a shrug chance.
- The swallow rule, carcasses that sink and stay, gulp as swallow reach.
- The belly, and the pickup it passes (half heart or shell for now).
- Out: hunger, metabolism's starvation, XP and the level-up draft, the reroll.
- Board: hearts, the belly, pickups, a carcass at rest.

## 3. The tank and its map

- Seeded grid generation of 6–8 rooms from a tank's templates, with the room types
  placed; the daily seed seeds it.
- Exits that lock while a fight room has hostiles; the camera slide between rooms, with
  the next room held still until arrival.
- The minimap, inside the tank's outline, with Isaac's room-type icons.
- Board: every fight template of the nursery; the minimap.

## 4. Hostile roles

- Charger (the existing strike, fitted to rooms), spitter (aimed shots), turret (fixed,
  fires in a ring on a beat), drifter (slow, hurts to touch).
- Spitting and turret species for each tank; the wind-up pose as every role's tell.
- Board: each role in motion, and its shot.

## 5. Pedestals and power

- The treasure room and the pedestal. The trait pool ported as mutations and pooled by
  tank (open water → nursery, reef → reef, twilight to abyss → deep), offered at home or
  deeper with the home lean kept. Cards that only fed a cut system are cut or rewritten.
- Actives on Space, recharged by rooms cleared (Ink 2, Electric 1, Inflation 2), drawn as
  pips.
- The stat column: damage, rate, range, shot speed, speed, armour.
- Ranged primaries: Archer Spit and Spine Volley, replacing the bite for good. Ballistic
  reworked without the boost.
- Board: the pedestal, the stat column, each ranged primary and its shot.

## 6. The economy

- Shells, dropped by cleared rooms (a 40% drop: shells 60, half heart 25, item 15) and
  passed by the belly.
- The shop: three items at 3–5, one mutation at 15.
- Items on E: food pellet (a heart), air stone (a bubble burst that shoves), snail (cures
  poison and bleeding).
- Keys: dropped and found like shells; the treasure room's and shop's doors and a room's
  chests take one. Shown under shells on the HUD, as in the reference.
- The deal room, 50% after a boss: one deal mutation paid in heart containers, one curse
  (Blood Lamp, Brittle Frame, Open Veins, Leaden Bones and whatever joins them).
- Board: the shop, the deal room, every item.

## 7. Bosses and the descent

- The mantis shrimp (new, its punch the tell), the Great White (its charge), the Giant
  Squid (its grab, its arms torn free), each fitted to one screen.
- The descent: growth, the next tank at its scale, the drop-in cutscene.
- The win screen, with the lineage and the codex. Starting forms become one per tank
  reached.
- Board: each boss and its tell; the drop-in.

## 8. Liveliness

- Decoration per tank, on the first pass above: the wreck as the reef's centrepiece, the
  deep tank's own growth, and what hangs from ceilings and clings to walls. Side-on rooms get bottom-heavy, so
  templates carry things that block higher up — overhangs, arches, stalactites, a wreck on
  its side, a chain, a net.
- Ambient fauna in every room: things to eat and things that flee.
- Board: every tank's decoration set.

## Later

Bomb fish and secret rooms; tanks four and five (the sperm whale, the colossal squid, the
Leviathan in the basement tank); an ending cutscene.
