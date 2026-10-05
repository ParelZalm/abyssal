# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev      # vite dev server with HMR
npm run build    # tsc --noEmit && vite build  — this is the only gate
npm run preview  # serve dist/
npm run design   # vite, opened on /design.html — the design board
npm run sprite -- <sheet.png> --id <species>   # import an enemy's sprite sheet (docs/sprites.md)
npm run release -- <patch|minor|major>         # build, bump, stamp CHANGELOG.md, tag, push (docs/releasing.md)
```

There is **no test suite and no linter**. `npm run build` type-checks (strict) and is
what "does it pass" means here. `npx tsc --noEmit` alone is the fast inner loop.

Do not start the dev server with `Bash`. `.claude/launch.json` defines an `abyssal`
configuration — use the preview tooling (`preview_start` with `{name: "abyssal"}`) so the
browser pane attaches to it.

## Design mode

`/design.html` (`src/design/`) lays out every drawing the game makes, each over the real
water colour at its own depth. Its sidebar sorts the groups into sections (`DesignSection`
in `catalog.ts`): the tanks (rooms, decoration, water), the animals (creatures, hostile
roles, bosses), the run (health, pedestals, shop and deals), and the body (plans, motion,
morphology, stats, builds, mutations). The column's parallax props and fields sit under an
archived *Column era* section, since the game no longer draws them. A new group goes into
the section it belongs to. The board opens on Body plans and fills a group's cells a slice a
frame, with the count in the header. An item too slow for one frame (a room is ~1 s at play
density) gives `DesignItem.prepare` and keeps what it baked. The rooms bake the grid at a
third of their density (`ROOM_PREVIEW`), and at full density once focused. It imports the shipping drawing code and is never imported by it,
so it cannot drift from the game. Click a cell to focus it with its source file; the URL
carries the whole state, so a link to one cell is a link to one design question. The
*show* options caption the art without touching it: `names`, `notes` (off by default; the
focus panel always has the note), `icons` (a mutation's HUD glyph as the chip the player
sees), and `morph` (every genome field the cell moved off the hatchling, phrased the way the
cards phrase it). ↑/↓ steps through the groups, ←/→ through the cells, and `\` folds the
sidebar away. A cell that draws a genome sets
`genome` on its `DesignItem` and gets the last two for free.

It is a development tool: `design.html` is not a build entry, so it is dev-served only, and
both pages carry a link to the other (`import.meta.env.DEV` in `src/main.ts`).

Reach for it first when a change is about how something looks in isolation. Reach for the
game itself when the question is how it reads in motion, at depth, or against the HUD.

## Art direction

The look of the rework is set by two reference frames in `docs/media/reference/`, and
summarised under *Art direction* in `docs/rendering.md`: dark navy water and dark stone,
colour living on the rock as decoration, light pooled around what glows, Isaac's HUD.
Check new drawing against them.

## Verifying visual work

Almost every change here is visual, and the only real verification is looking at it.

**Start with a launch** (`src/dev/launch.ts`) rather than playing to the thing: the address
starts a run past the title in any tank and room, grown as a descent would grow it —
`/?tank=deep&room=boss&god=1`, `/?room=shop&rich=1`, `/?tank=reef&dropin=1`,
`/?traits=inksac,beak`. The flags are `god` (hearts refill; hits still land), `calm` (fight
rooms deal no hostiles), `rich`, `dropin`; `seed` pins the map, and without it a seed is
found whose tank has the room asked for. *Again* on the end screen replays the launch on the
same seed. `/?lab=1` (`&tank=reef`, `deep`) is the lab (`src/dev/lab.ts`): the treasure
room stocked with the whole pool a shelf at a time, free and restocking, with targets and a
damage-a-second meter — `[`/`]` shelf, `T` targets still/live/off, `R` a new body. In the game the backquote key opens the dev panel (`src/dev/panel.ts`), which
has every launch and some live actions: clear the room,
go to any room (`Game.warp`), go down to the next tank, give a mutation, toggle god.

In dev builds `src/main.ts` also exposes the `Game` instance as `window.game`, which is the
intended way to drive the game from the browser console:

```js
const g = window.game;                           // after a launch: /?god=1&calm=1
g.dev.god = true;                                // nothing kills the player
g.world.spawner.hostiles = () => {};             // and no more hostiles arrive
const key = (k, down = true) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k }));
key('ArrowRight'); for (let i = 0; i < 12; i++) g.frame(1 / 60); key('ArrowRight', false);
```

`run`, `player`, `world`, `room` and the run systems (`evolution`, `belly`,
`controller`) are rebuilt on every reset, so patch them after the run has started, and
again after a restart. The camera holds the room whole, so there is nothing to pin: move
`g.player.x`/`y` to put the body where you want to look.

**Step the frame by hand when testing input.** The Browser pane stops animating while it is
hidden, so a key held with a timeout does nothing; `g.frame(1 / 60)` in a loop (private in
TypeScript, callable from the console) advances the game deterministically, and a
screenshot afterwards shows the result. Key taps from the browser tool are too short to
read as a held key — dispatch `keydown`/`keyup` instead. A code change reloads the page back
to the title.

## Architecture

`src/main.ts` only boots. `src/Game.ts` owns the Pixi application, the loop and the
page-lifetime pieces (input, camera, water, particles, codex), and on every reset builds a
fresh `Run` plus one instance of each run system over it. The folders are layers, and
imports only point down them:

- `core/` — util and noise; no pixi, no game knowledge.
- `content/` — the tables and pure queries over them: genome, species, zones, traits,
  forms, the body form.
- `sim/` — the simulation. `World` holds the state and the outbox and runs three passes:
  `Behaviour.think`, `integrate`, `Combat.resolveContacts`; `Spawner`, `Patterns`,
  `Roles` (a hostile's brain, with `Flow` for the way round the rock), `Bosses` (each
  tank's boss fight) and `sim/organs/` hang off it. It never reaches up into `run/` or `Game`.
- `run/` — one run's record (`Run`) and the systems that move it: `TankMap` (the rooms, the
  doors, the pedestal), `Evolution` (dealing and taking mutations, transformation), `Belly`
  (swallowing, pickups, the last heart), `Ending`.
- `input/` — `Input` (the keyboard, Isaac's layout) and `PlayerController` (the swim, the
  strike or the shot on the arrows, the active mutation on Space and its charges, the stats).
- `render/` — `Camera` (a room held whole), `Scene` (visibility, the water pass), `RoomView`
  (the room's rock), `Impacts` (the outbox made felt), `Dread`, the water shader, and
  `creature/` for the fish art.
- `ui/` — the DOM HUD and screens behind the `UI` facade. `design/` — the design board.
  `dev/` — launches and the in-game dev panel; dev only, like the board.

The simulation publishes what happened as plain fields on `World` (`bites`, `spilled`,
`pulses`, `playerGain`, `collected`, `devoured`, `synergies`, `noticedBy`,
`killedGuardian`, `glanced`, `playerHeld`), and `Game.digest()` routes each to the system it concerns.
A run system gets only what it needs in its constructor — never `Game`; the phase is the
one thing it may set, through `Flow` (`run/phase.ts`). Keep new code in that shape: a
class that owns its own state, in the folder of the layer it belongs to, rather than
another field on `Game`.

Two display roots: a static screen-sized sprite carrying the GLSL water filter, and a
`camera` container holding the ocean particulate, the creature views and the effects.
The water is shaded from world coordinates passed in as uniforms, not from the scene
graph, so anything it draws has no display object to read a position from.

**The game is a chain of tanks made of one-screen rooms** (`docs/adr/0003-*`,
`docs/roadmap.md`, and the words in `CONTEXT.md`); the open column it replaced is the tag
`v0.1.0`. Work the roadmap's stages in order, each on a branch off `main` (`feat/<topic>`,
`fix/…`, `art/…`), merged with `--no-ff` and deleted once done; every merge adds its lines to
`CHANGELOG.md` under *Unreleased*, and `npm run release -- minor` cuts a version. The whole
process is `docs/releasing.md`.

`y` is depth and increases downward (0 → `DEPTH_MAX` 9000). `genome.size` is a body
length in cm used directly as a world length. A tank's rooms are laid out at the world
depth whose water it borrows (`Tank.depth`), on a tile grid (`Tank.tile`) sized to its
animal, and the camera fits the room to the window — so the zoom is set per tank and falls
at each descent. Anything drawn in screen terms has to divide by the zoom to hold its
apparent size; the column's fourfold zoom change killed two background layers that did not.

**Full notes are in [`docs/`](docs/README.md)** — architecture, simulation, progression,
rendering, performance, and a decisions log of what has already been tried and undone.
Read `docs/decisions.md` before rebuilding anything that looks missing.

## Conventions that matter

- **Everything is pixel art on one grid, and creatures are side-on.** The canvas renders at
  `1 / PIXEL` and `FramePass` quantises the frame (`render/pixel.ts`); anything new that
  draws should sit on that grid rather than smooth itself over it.
- **Creature art is baked into a texture once per `rebuild(genome)`; swimming moves mesh
  vertices, never geometry.** Never issue paths per frame. The shape lives in
  `content/form.ts` (a spine and one depth curve; `edgeAt` places parts on it), the painting
  in `render/creature/fishbake.ts` (`paint()` is the order; the painters are in `bake/`,
  per pixel on a `Sheet`), the skinned mesh in `render/creature/fishview.ts`.
- **An enemy may be drawn from a sprite instead** (`content/sprites.ts`,
  `render/creature/sprite.ts`): enemies never mutate, so one authored picture can match a
  reference where the painters cannot. The player is being moved over too, a body at a time
  (`BODIES`): a drawn body is laid into the bake and its eye, fins and mutations are still
  painted over it, placed on its outline (`drawnForm`); the rest of its plans stay painted.
  The whole workflow — the prompts for whoever makes the art, `npm run sprite` to import a
  sheet, the wiring and the checks — is `docs/sprites.md`; which enemies are done and which
  are next is `docs/roadmap-enemies-rework.md`. Until the roster is through, only reworked
  enemies are dealt into fights (`REWORKED_ONLY`), so the nursery's and reef's fights are
  empty for now.
- **Nothing on a creature is stroked.** A contour has a position of its own, so it draws
  twice wherever parts cross. Painters set what a pixel is; `bake/sheet.ts` shades it, and
  the outline and rim are read off the finished silhouette. See `docs/decisions.md`.
- **Organs carry a mechanic and a morphology together.** Adding one to `Genome` means an
  entry in `sim/organs/` (the mechanic, as hooks the simulation calls) and paint in
  `render/creature/bake/`; a stat with no visible consequence is not how this game
  communicates. Nothing outside `sim/organs/` reads an organ field by name — it asks the
  folds in `sim/organs/query.ts`.
- **Use `waterColor(y)` and `lightAt(y)` from `render/water.ts`** for anything that needs to
  know what the water looks like at a depth. `waterAt(y)` (`content/zones.ts`) blends
  across thermoclines; `bandWater(y)` is the unblended profile for anything discrete.
- **New sprites should batch** against the shared textures in `render/textures.ts`, and
  additive things belong in their own container — an interleaved blend-mode change
  breaks the batch.
- Comment the *why*, especially the constraint that made a value what it is. The
  existing comments carry the reasoning for the drag ratio, the octave counts and the
  shader's failure modes; match that, and do not narrate what the code already says.
