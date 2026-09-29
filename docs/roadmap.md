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

## 1. The room frame

One hand-authored room, and swimming and biting in it feels good.

- A room is a tile grid on the pixel grid: rock, substrate, open water. Terrain collision
  for every creature, which the simulation has never had (today it clamps x only).
- A fixed camera framing the room; the zoom is per tank, not per body size.
- WASD steering through `drive`; arrows fire the primary (a bite lunge in that direction,
  through the existing wind-up, strike and recover); no boost.
- Out: the column, `DEPTH_MAX`-sized spawning, bands, thermoclines, gates, the descent
  limit, the shallows clock, the pocket, the squeeze, depth labels. Out of the HUD with
  them: the depth readout and the gate hint.
- Board: a Rooms group drawing the template and its tiles.

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

- Decoration per tank: coral, macro-algae, sea grass and anemones in the reef; the wreck
  as the reef's centrepiece; the deep tank's own. Side-on rooms get bottom-heavy, so
  templates carry things that block higher up — overhangs, arches, stalactites, a wreck on
  its side, a chain, a net.
- Ambient fauna in every room: things to eat and things that flee.
- Board: every tank's decoration set.

## Later

Bomb fish and secret rooms; tanks four and five (the sperm whale, the colossal squid, the
Leviathan in the basement tank); an ending cutscene.
