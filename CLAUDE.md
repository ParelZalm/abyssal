# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev      # vite dev server with HMR
npm run build    # tsc --noEmit && vite build  — this is the only gate
npm run preview  # serve dist/
npm run design   # vite, opened on /design.html — the design board
```

There is **no test suite and no linter**. `npm run build` type-checks (strict) and is
what "does it pass" means here. `npx tsc --noEmit` alone is the fast inner loop.

Do not start the dev server with `Bash`. `.claude/launch.json` defines an `abyssal`
configuration — use the preview tooling (`preview_start` with `{name: "abyssal"}`) so the
browser pane attaches to it.

## Design mode

`/design.html` (`src/design/`) lays out every drawing the game makes — every body plan,
the morphology and stats that draw, every mutation taken once on the hatchling, all the
species, each motion state, the background props and each band's field, and the water and
biome palettes — each over the real water colour at its own depth. It imports the shipping drawing code and is never imported by it,
so it cannot drift from the game. Click a cell to focus it with its source file; the URL
carries the whole state, so a link to one cell is a link to one design question. The
*show* options caption the art without touching it: `labels`, `icons` (a mutation's HUD
glyph as the chip the player sees), and `morphology` (every genome field the cell moved
off the hatchling, phrased the way the cards phrase it). A cell that draws a genome sets
`genome` on its `DesignItem` and gets the last two for free.

It is a development tool: `design.html` is not a build entry, so it is dev-served only, and
both pages carry a corner link to the other (`import.meta.env.DEV` in `src/main.ts`).

Reach for it first when a change is about how something looks in isolation. Reach for the
game itself when the question is how it reads in motion, at depth, or against the HUD.

## Art direction

The look of the rework is set by two reference frames in `docs/media/reference/`, and
summarised under *Art direction* in `docs/rendering.md`: dark navy water and dark stone,
colour living on the rock as decoration, light pooled around what glows, Isaac's HUD.
Check new drawing against them.

## Verifying visual work

Almost every change here is visual, and the only real verification is looking at it. In
dev builds `src/main.ts` exposes the `Game` instance as `window.game`, which is the
intended way to drive the game from the browser console:

```js
const g = window.game;
[...document.querySelectorAll('button')].find(b => b.textContent === 'Hatch').click();
g.player.invuln = 1e9;                           // nothing lands on the player
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
  `Roles` (a hostile's brain, with `Flow` for the way round the rock) and `sim/organs/`
  hang off it. It never reaches up into `run/` or `Game`.
- `run/` — one run's record (`Run`) and the systems that move it: `Evolution` (level-up,
  traits, transformation), `Belly` (swallowing, pickups, the last heart), `Ending`.
- `input/` — `Input` (the keyboard, Isaac's layout) and `PlayerController` (the swim, the
  strike on the arrows, the active mutation on Space).
- `render/` — `Camera` (a room held whole), `Scene` (visibility, the water pass), `RoomView`
  (the room's rock), `Impacts` (the outbox made felt), `Dread`, the water shader, and
  `creature/` for the fish art.
- `ui/` — the DOM HUD and screens behind the `UI` facade. `design/` — the design board.

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

**The game is mid-rework** on `rework/gameloop`: the open column is becoming a chain of
tanks made of one-screen rooms (`docs/adr/0003-*`, `docs/roadmap.md`, and the words in
`CONTEXT.md`). Work the roadmap's stages in order.

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
