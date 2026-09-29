# Architecture

## Shape of the thing

One page, one canvas, no engine. `src/main.ts` only boots; `src/Game.ts` owns the Pixi
`Application`, the loop, and the pieces that live as long as the page — input, the camera,
the water pass, the particles, the codex. On every reset it builds a fresh `Run` and a
fresh set of run systems over it, so no system carries state it has to remember to clear.

```
src/
├── main.ts          boot, and the dev-only link to the design board
├── Game.ts          the loop, reset, and the routing of the world's outbox
├── core/            no pixi, no game knowledge
│   ├── util.ts          Rng, clamp/lerp, colour, angle maths
│   └── noise.ts         CPU value noise, matching the water shader's
├── content/         what things are: tables, and pure queries over them
│   ├── genome.ts        the stat block, and the derived stats read off it
│   ├── species.ts       the roster: what lives in each zone, the guardians, speciesById
│   ├── zones.ts         the five zones and their bands: look, gates, depth labels, the
│   │                    size at which each guardian takes notice; DEPTH_MAX, WORLD_HALF_W
│   ├── form.ts          the spine + width curve every body is made of, and PLAN_ART
│   ├── traits.ts        the mutation pool and the rarity-weighted draft
│   ├── forms.ts         the five transformations and the families that lead to them
│   └── icon.ts          the IconName type, so the tables need nothing from ui/
├── sim/             the simulation — imports content/ and core/, never run/ or ui/
│   ├── world.ts         state, the outbox, and the three update passes
│   ├── creature.ts      one animal, and its swim physics (propel / drive)
│   ├── events.ts        Bite, Blood, Pulse — what the outbox carries
│   ├── spawn.ts         Spawner: the ring, shoals, strays, plankton, pockets, summoning
│   ├── behaviour.ts     think: flee, hunt, smell, school, moods; who notices whom
│   ├── patterns.ts      a guardian's tell, rush, click and opening
│   ├── combat.ts        contacts, bites and blows, grasping, bleeding, booking a death
│   └── organs/          every organ's mechanic, as hooks; see organs/index.ts
├── run/             one run's progress, and the systems that move it
│   ├── Run.ts           the shared record: stage, xp, food, taken, score, combo, lineage
│   ├── Evolution.ts     level-up, the draft and rerolls, taking a trait, transformation
│   ├── Metabolism.ts    eating, healing, burn, and the hunger warning
│   ├── Bands.ts         thermoclines, forcing a seal, the shallows clock, stocking water
│   ├── Ending.ts        the banked score, the cause of death, the lineage silhouettes
│   ├── codex.ts  best.ts  starts.ts  prospects.ts  phase.ts
├── input/
│   ├── Input.ts         keyboard and pointer as state, bound once for the page
│   └── PlayerController.ts  steering, the boost and its cost, the active organ
├── render/
│   ├── Camera.ts        zoom, follow, shake and hit-stop; owns the world-space root
│   ├── Scene.ts         what the player can make out, the nearest gate, the water pass
│   ├── Impacts.ts       the world's outbox made felt: blood, pulses, hits, a guardian's turn
│   ├── Dread.ts         the spike and the hold behind uDread
│   ├── water.ts         full-screen GLSL pass; also owns the depth→colour palette
│   ├── ocean.ts  scenery.ts  fields.ts  props.ts  fx.ts  textures.ts  view.ts
│   └── creature/
│       ├── fishview.ts      one deforming mesh per creature; swims it
│       ├── fishbake.ts      the bake cache, and paint(): the order a body is painted in
│       └── bake/            the painters, one file per region of the body
├── audio/sound.ts   the heartbeat, synthesised
├── design/          the design board (dev only, never imported by the game)
└── ui/              DOM UI — UI.ts facade, hud/*, screens/*, icons.ts
```

`render/scenery.ts` draws soft organic props on parallax planes — *planes*, because
*band* now means a slice of the water column. See
[decisions.md](decisions.md) for why the art is primitives rather than creature
silhouettes. `render/fields.ts` stands one structure per band on a plane of its own between
the two back ones: a clump of weed, a torn sea fan, a siphonophore in snow, a ring of
sparks, a column of embers, a sinking ribcage (see *Fields* in `rendering.md`).

## Dependency direction

`core` ← `content` ← `sim` ← `run` / `render` / `input` ← `Game`. Nothing points back
up the chain, with one exception kept on purpose: a `Creature` builds its own `FishView`,
because the view is created and destroyed with the body and threading a factory through
every spawn bought nothing.

`sim` never reaches up into `run` or `Game`. It exposes what happened last frame as plain
fields on `World` — `bites`, `spilled`, `pulses`, `playerGain`, `playerHeal`, `devoured`,
`synergies`, `noticedBy`, `tellBy`, `killedGuardian`, `blocked` — and `Game.digest()`
routes each to the system it concerns: the visual ones to `Impacts`, food to
`Metabolism`, discoveries to the codex, a guardian's death to `Ending`. Keep it that way:
the simulation should stay runnable without the presentation.

The run systems see only what they are handed in their constructor — never `Game`
itself. The one piece of `Game` they may touch is the phase, through the `Flow` interface
in `run/phase.ts`.

`fishview`, `form` and `fishbake` know about `genome` and nothing else. They never
read world state.

## The frame

`Game.frame(dt)`, with `dt` clamped to 1/20 s:

1. **Hit-stop.** `camera.slow(dt)`: a landed bite holds a few frames at 0.3 speed.
2. **`fx.update`** always runs, so particles keep moving while paused or drafting.
3. **If `phase === 'play'`:** `controller.steer` → `bands.descentLimit()` →
   `world.update(dt)` → `digest()` → `metabolism.update` → the camera's shake, the combo
   and the dread decay → `bands.check` → `bands.spendWater`.
4. **`render(dt)`** always runs: `camera.follow`, ocean and scenery, `scene.draw`
   (per-creature visibility and tint, the gate, the water uniforms, the gate label),
   `bands.stock` (spawn and cull), and the HUD.

Phase is one of `title | play | draft | paused | over`. Only `play` advances the
simulation; `render` runs in all of them, which is why the title screen still has live
water behind it.

`world.update(dt)` is three passes over the creature list: `Behaviour.think` (set desired
heading and throttle), `integrate` (physics, bounds, wounds, organ ticks, view sync), then
`Combat.resolveContacts` (overlap, strikes, swallowing).

## Layers and coordinates

World units are centimetres-ish: `genome.size` is a body length in cm and is used
directly as a world length. **`y` is depth and increases downward**, from 0 at the
surface to `DEPTH_MAX` (9000) at the floor. `WORLD_HALF_W` (7000) bounds x.

The display is two things stacked on the stage:

```
app.stage
├── water.layer    a screen-sized Sprite with the GLSL filter — shaded from world
│                  coordinates passed in as uniforms, so it never moves or scales
└── camera.root    a Container, scaled by zoom and translated by the camera position
    ├── scenery.back   far parallax props, the fields between them
    ├── ocean.world
    ├── scene.focus  the ring drawn around the player
    ├── world.glow   every creature's additive bloom, in one container so it batches
    ├── world.layer  every creature's FishView
    ├── fx.layer
    └── scenery.front  near parallax props (out of focus the other way)
```

Because the water is a filter over a static sprite rather than a child of the camera,
anything it draws — thermoclines, the band below, god rays — has to be computed from
`uCam`/`uView` in the shader. That is why the seal's screen position is recomputed in
`Scene.draw` (through `camera.screenY`) for the HUD label rather than read off a display
object.

Zoom comes from `camera.zoomFor(size)` and falls from about 1.3 to 0.34 over a run, so the view
covers roughly four times more world at the end than at the start. Any new background
system has to hold up across that whole range — that is what killed the first two
attempts at one.
