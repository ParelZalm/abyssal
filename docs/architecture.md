# Architecture

## Shape of the thing

One page, one canvas, no engine. `src/main.ts` only boots; `src/Game.ts` owns the Pixi
`Application`, the loop, and the pieces that live as long as the page — input, the camera,
the water pass, the particles, the codex. On every reset it builds a fresh `Run` and a
fresh set of run systems over it, so no system carries state it has to remember to clear.

```
src/
├── main.ts          boot; in dev, a launch from the address bar and the dev panel
├── Game.ts          the loop, reset, and the routing of the world's outbox
├── core/            no pixi, no game knowledge
│   ├── util.ts          Rng, clamp/lerp, colour, angle maths
│   └── noise.ts         CPU value noise, matching the water shader's
├── content/         what things are: tables, and pure queries over them
│   ├── genome.ts        the stat block, and the derived stats read off it
│   ├── species.ts       the roster: what lives in each zone, the guardians, speciesById
│   ├── tanks.ts         the tanks of a run and the room templates they are built from
│   ├── map.ts           dealing a tank's map: rooms grown from the start, types on dead ends
│   ├── zones.ts         the column's strata, kept as water looks and species homes, and
│   │                    the size at which each guardian takes notice; DEPTH_MAX
│   ├── form.ts          the spine + width curve every body is made of, and PLAN_ART
│   ├── traits.ts        the mutation pool and the rarity-weighted draft
│   ├── forms.ts         the five transformations and the families that lead to them
│   └── icon.ts          the IconName type, so the tables need nothing from ui/
├── sim/             the simulation — imports content/ and core/, never run/ or ui/
│   ├── world.ts         state, the outbox, and the three update passes
│   ├── creature.ts      one animal, and its swim physics (propel / drive)
│   ├── events.ts        Bite, Blood, Pulse — what the outbox carries
│   ├── terrain.ts       one room's solid ground, and pushing bodies back out of it
│   ├── spawn.ts         Spawner: stocking a room with its tank's fauna
│   ├── behaviour.ts     think: flee, hunt, smell, school, moods; who notices whom
│   ├── patterns.ts      a guardian's tell, rush, click and opening
│   ├── combat.ts        contacts, bites and blows, grasping, bleeding, booking a death
│   └── organs/          every organ's mechanic, as hooks; see organs/index.ts
├── run/             one run's progress, and the systems that move it
│   ├── Run.ts           the shared record: stage, xp, food, taken, score, combo, lineage
│   ├── Evolution.ts     level-up, the draft and rerolls, taking a trait, transformation
│   ├── TankMap.ts       the tank as a run meets it: rooms, doors, clearing, the slide
│   ├── Belly.ts         swallowing, what a full belly passes, pickups, the last-heart warning
│   ├── Ending.ts        the banked score, the cause of death, the lineage silhouettes
│   ├── codex.ts  best.ts  starts.ts  prospects.ts  phase.ts
├── input/
│   ├── Input.ts         the keyboard as state, Isaac's layout, bound once for the page
│   └── PlayerController.ts  the swim, the strike on the arrows, the active mutation
├── render/
│   ├── Camera.ts        a room held whole on screen, shake and hit-stop; the world root
│   ├── Scene.ts         what the player can make out, and the water pass
│   ├── room.ts          RoomView: a room's rock and sand baked onto the pixel grid
│   ├── Impacts.ts       the world's outbox made felt: blood, pulses, hits, a guardian's turn
│   ├── Dread.ts         the spike and the hold behind uDread
│   ├── water.ts         full-screen GLSL pass; also owns the depth→colour palette
│   ├── lighting.ts      the light map the world is multiplied by; `Camera.over` above it
│   ├── decor.ts         what grows on the rock: placement, painters, swaying ropes
│   ├── pickups.ts       hearts and shells, in the water and as the HUD's pixel maps
│   ├── ocean.ts  fx.ts  textures.ts  view.ts
│   └── creature/
│       ├── fishview.ts      one deforming mesh per creature; swims it
│       ├── fishbake.ts      the bake cache, and paint(): the order a body is painted in
│       └── bake/            the painters, one file per region of the body
├── audio/          sound.ts the heartbeat, synthesised; music.ts a track a tank, crossfaded
├── dev/             dev only: launches (`launch.ts`, a run started in any tank and room)
│                    and the in-game dev panel (`panel.ts`)
├── design/          the design board (dev only, never imported by the game)
└── ui/              DOM UI — UI.ts facade, hud/*, screens/*, icons.ts
```

The run is being rebuilt as tanks of rooms — [adr/0003](adr/0003-tanks-of-rooms-replace-the-column.md)
and [roadmap.md](roadmap.md). Until it is finished, a run is the nursery tank's map.

## Dependency direction

`core` ← `content` ← `sim` ← `run` / `render` / `input` ← `Game`. Nothing points back
up the chain, with one exception kept on purpose: a `Creature` builds its own `FishView`,
because the view is created and destroyed with the body and threading a factory through
every spawn bought nothing.

`sim` never reaches up into `run` or `Game`. It exposes what happened last frame as plain
fields on `World` — `bites`, `spilled`, `pulses`, `playerGain`, `playerHeal`, `devoured`,
`synergies`, `noticedBy`, `tellBy`, `killedGuardian`, `glanced`, `playerHeld`, `collected` —
and `Game.digest()`
routes each to the system it concerns: the visual ones to `Impacts`, food to
`Belly`, discoveries to the codex, a guardian's death to `Ending`. Keep it that way:
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
3. **If `phase === 'play'`:** `controller.steer` → `world.update(dt)` → `digest()` →
   `tank.update` (a room clearing, the player leaving through a door) → `belly.update` →
   the camera's shake, the combo and the dread decay → `impacts.hints`. During a slide
   between rooms only `tank.update` runs: the world holds still while the camera pans.
4. **`render(dt)`** always runs: `camera.follow`, the ocean, `tank.draw` (the room's view,
   re-baked on a new art tier, and the next one's during a slide), `scene.draw` (per-creature visibility and tint, the water uniforms),
   culling the dead and topping the room up (`Spawner.stock`), and the HUD.

Phase is one of `title | play | draft | paused | over`. Only `play` advances the
simulation; `render` runs in all of them, which is why the title screen still has live
water behind it.

`world.update(dt)` is three passes over the creature list: `Behaviour.think` (set desired
heading and throttle), `integrate` (physics, the room's walls, wounds, organ ticks, view sync), then
`Combat.resolveContacts` (overlap, strikes, swallowing).

## Layers and coordinates

World units are centimetres-ish: `genome.size` is a body length in cm and is used
directly as a world length. **`y` is depth and increases downward**, from 0 to
`DEPTH_MAX` (9000). A tank is a box of water in a building and has no depth in the
fiction, but its rooms are laid out at a world depth all the same (`Tank.depth`): the water
shader, `lightAt` and every species' home range are keyed on `y`, and borrowing a band's
depth is what gives a tank that band's water. A room is a grid of tiles (`Tank.tile` world
units each) centred on x = 0; its walls are the only bounds a body meets.

The display is two things stacked on the stage:

```
app.stage
├── water.layer    a screen-sized Sprite with the GLSL filter — shaded from world
│                  coordinates passed in as uniforms, so it never moves or scales
└── camera.root    a Container, scaled by zoom and translated by the camera position
    ├── ocean.world
    ├── scene.focus  the ring drawn around the player
    ├── world.fog    darkening clouds, under the bodies
    ├── world.glow   every creature's additive bloom, in one container so it batches
    ├── world.layer  every creature's FishView
    ├── fx.layer
    └── roomView.root  the room's rock, over the bodies, so a nose in a wall goes into it
```

Because the water is a filter over a static sprite rather than a child of the camera,
anything it draws — god rays, clouds — has to be computed from `uCam`/`uView` in the
shader. (It still carries the thermocline's uniforms; `Scene.draw` puts the seal below the
world's floor.)

The camera holds the room whole (`Camera.hold`), refitting the zoom to the window every
frame. A tank's tile is sized to its animal, so the zoom is set by the tank and not by the
body, and falls at each descent as the tanks grow. Anything drawn in screen terms rather
than world terms — the particulate is — divides by the zoom to keep its apparent size, the
lesson the column's fourfold zoom change taught the background planes.
