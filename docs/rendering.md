# Rendering

## Art direction

Two reference frames set the look of the tank rework: `docs/media/reference/tank-room.webp`
(an Isaac room in a tank, framed and doored) and `docs/media/reference/cave-room.webp` (the
same room as a cave). What they agree on, and what every stage should build toward:

- **Dark, cool water and dark stone.** Navy water; rock a desaturated blue-grey, pebbled,
  with a lighter cap on every face that looks up. Very little is bright.
- **Colour lives on the rock, not in it.** Red tube sponges, violet anemones, dark kelp,
  coral heads, bioluminescent tips — decoration growing off the surfaces is where a room's
  colour comes from.
- **Light pools around what glows.** The pale larval player is the brightest thing on
  screen, with a pool of light around it; lures, jellies, photophores and glowing growth
  are the rest. The frame is dark and they make it (*Lighting*, below).
- **Rooms are furnished.** Crates, cages, pipes, a grate in the floor, a lit hatch: the
  aquarium shows through the reef.
- **Isaac's HUD.** Hearts, then currency, bombs and keys under them at top left; the
  minimap at top right.

Single animals get a reference sheet of their own beside the two frames: the animal in game,
flat, taken apart and its palette, side-on and facing right. Nothing is traced from one —
the bake paints every body from its genome — so a sheet is matched by the plan's row in
`PLAN_ART` and its species' colours. `angler.webp` is the first: a navy body under violet
fins (`finHue`), a jaw held open on cold fangs (`maw`), a comb of spines (`crest`), a fan
tail (`fan`), scales, a sparkle for photophores, and the lure, eye and specks in the one
cold colour (`heat: 0` keeps menace from warming it). At the deep tank's zoom an anglerfish
is 10 to 20 texels long, so most of that only shows on the board or on a big window.

The painters could not get closer than that to the sheet (the board's comparison is on
`prototype/angler-art`), so an enemy may instead be **drawn from a sprite**: it never
mutates, and one picture of one animal can be the reference exactly. `content/sprites.ts`
holds each sprite's landmarks in its own pixels — snout and tail root span the plan's form,
so the hull lies inside the picture; the axis the swim bends about; the lure's bulb, which
the trap fires from. `render/creature/sprite.ts` loads the frames before anything is drawn
and resamples them to the bake's density through the same cache: a coverage-weighted mean
per texel, snapped back to the sprite's own colours, ringed in its darkest. The player and
every plan it can take stay painted. The anglerfish is the first
(`render/creature/sprites/`), from `docs/media/reference/angler-sprite.webp`, imported with
`npm run sprite`. How a sheet is asked for, imported and checked is
[`sprites.md`](sprites.md).

A sprite's detail needs the pixels to show, and at its own size an anglerfish had 20 to 30
of them, so it is **drawn at twice its size** (`Species.drawn`, `Creature.drawnSize`). The
picture and what meets it scale — hitbox, radius, the lure's trap, where its shots leave the
skin, the water it is spawned into — and the stats do not: its health, bite and senses are
still the genome's size, so the fight is the one it was, against a bigger target.

## The pixel grid

`src/render/pixel.ts`. The whole game is drawn on one coarse grid: the canvas is created
at `1 / PIXEL` resolution (half the CSS size) and the browser scales it back up with
`image-rendering: pixelated`. Everything in a frame shares that grid — scaling each
animal's art by itself would put every animal on a grid of its own, and a skinned or
rotated one would resample its pixels at every bend. There is no MSAA and positions round
to whole pixels (`roundPixels`), or a slow animal shimmers as it crosses them.

`FramePass`, a filter on the stage, then quantises the finished frame to `uLevels` steps
per channel with a 4×4 Bayer dither. It works in square-root space, because the ocean is
nearly all dark and even linear steps would leave the midnight water two colours. Without
it, smooth gradients stay smooth on big pixels and the frame reads as a blurry image
scaled up rather than as pixel art. Anything that dithers on its own (creature art) should
use the same Bayer matrix, so the two agree.

The water is shaded at one texel per art pixel (`SHADE_SCALE = 1 / PIXEL`) into a
nearest-sampled target.

## The water

`src/render/water.ts` is one full-screen `Filter` over a white `Sprite`, with a
hand-written GLSL fragment program. It draws, in order: the depth gradient, two
domain-warped FBM fields for the drifting masses, the band below the next thermocline,
the seal itself, god rays, the player's own bioluminescence, the dread desaturation, a
vignette, and an ordered dither to kill banding.

Everything is shaded from **world coordinates** reconstructed from `uCam` and `uView`,
which is what lets the next band down be visible before you can reach it.

`waterColor(y)` is the depth→colour palette and is exported: `scenery` and anything else
that needs "what colour is the water there" must use it rather than guessing.
`lightAt(y)` is the light falloff, clamped to a 0.03 floor.

Two shader rules learned the hard way, both commented in the file: the main cloud field
needs four octaves (three turns `smoothstep` into hard-edged slabs), and the deep-water
field's reuse of that noise has to be a *continuous* remap — `fract()` is a sawtooth and
draws its wrap as a seam across the screen.

## Zones and bands

`src/content/zones.ts` gives each band a visual identity (`WaterLook`) and blends it by
depth:

- `waterAt(y)` cross-fades adjacent bands over `BLEND` (620 world units) either side of
  a thermocline, smoothstepped. Use this for anything continuous.
- `bandWater(y)` returns the unblended profile for the band. Use this for anything
  discrete — a half-and-half landmark is not a thing.

The profile drives the shader (`turbid`, `cloudScale`, `cloudEdge`, `rays`, `shimmer`,
`accent`, `ambient`, uploaded as uniforms and eased per frame in `Water.update`) and the
particulate in `ocean.ts` (`mote`: tint, fall, current, sway, size, alpha, twinkle).

Below the twilight the column tint is nearly black, so `ambient` mixes the band's
*accent* into the water rather than the column colour — without that the two deepest
tiers are indistinguishable. Same reason `shimmer` does not scale away with `uLight`.

The particulate is sized and moved in screen terms, divided by the zoom against the
column's hatchling zoom (`REF_ZOOM`, 1.3): sized in world units, motes turned into stars at
a room's zoom, and a tank's zoom changes at every descent.

## Rooms

`render/room.ts` is `RoomView`: a room's `Terrain` baked once into one texture on the pixel
grid, and re-baked only when the art density changes tier. Nothing about the terrain moves.

- **The mask is the terrain's field.** Every pixel asks `Terrain.field` whether it is rock —
  the same smooth, noise-bent shape the collision cells are built from — so the edge is
  drawn to the pixel and is the edge a body meets. `Terrain.kindAt` says what it is made
  of, through a small warp, so the seam between sand and rock wanders like the edge does.
  The first cut drew the template's squares with a noise warp on top and read as blocks.
- **The rock is dark stone**, shaded off the mask as a creature is off its silhouette. It
  is textured at two scales — masses (`MASS`, 1.4 tiles) that give a wall its volume, and
  pebbles (`PEBBLE`, 0.32) over them — both cellular noise warped before it is looked up so
  the seams curve, each cell a dome lit from above-left with a soft crevice to the next and a
  highlight on a pebble's crown. Every face that looks up at open water has a cap
  (`CAP_DEPTH`, 0.22 tiles) of lighter slate over the darker front, which is what makes a
  ledge read as a slab. Light reaches `REACH` (1.8 tiles) into a wall, measured by a chamfer
  distance field from the water, and the rest falls to shadow. Sand is cool and dim, grained
  and lighter at its top. Everything steps through the Bayer screen and is lit by `lightAt`.

  What was tried before it: strata and a flat mottle, which read as a flat cut-out; unwarped
  cells with hard cracks, a cobbled wall; then warm reef limestone crusted pink and violet
  with turf on its tops, which put the colour in the rock. The references put it on the
  rock, as decoration, and keep the stone itself dark.
- **Walls cast into the water.** Water within `SHADOW` (0.7 tiles) of rock is darkened in
  stepped bands, which is what sits the rock in the tank. It is in the room's texture, so
  it falls on a fish swimming along a wall too.
- **The letterbox is more cave.** The camera fits the room and the window is rarely its
  shape, so the view is baked with `MARGIN` (10) tiles of rock around it, sinking to black
  within three tiles of the room's edge.
- **It draws over the bodies**, so a nose pressed into a wall goes into it: the wall circle
  is half the body's radius (`sim/world.ts`, `WALL_R`). A boss's whole hull is held out of
  the rock instead (`collideHull`), since tiles of it would otherwise be drawn under the wall.

The design board's *Rooms* group draws every template at the density it plays at on a
1440 × 900 screen, since the board's own tier is a mid-run one for the animals.

## Lighting

The tank is dark and its light sources make the scene (`render/lighting.ts`). Every frame
the lights are drawn additively, under the camera's transform, into a texture at a quarter
of the frame's resolution that starts at a deep-blue ambient (`Lighting.level`); a
screen-sized sprite multiplies the world by it — water, rock, decoration and bodies. Light
is smooth, and `FramePass` steps and dithers it onto the grid with everything else.

- **The lights:** the larva's own pool (`POOL`, eleven body radii, in `Scene`), every body's
  lamps and a real light organ's or a pale body's glow (`FishView.shine`), and the
  decoration's — each anemone's crown, each glow bulb (`DecorView.lights`).
- **The blooms are above the dark.** `Camera.over` is a second world root posed like
  `root` and drawn after the multiply; `World.glow` and the decoration's blooms live there,
  so a lamp is never darkened by its own shadow. A light that only reveals what is near it
  does not read as a light: each decoration light has a bloom in the water too.
- **Hostiles are lit, and the tell is a light.** Each hostile throws a faint cool light of
  its own (`PRESENCE` in `Scene`), so a room's threats can be found outside the larva's
  pool, and it flares warm and wider through a wind-up (`TELL`). The wind-up pose is every
  role's tell, and a pose in the dark is not a tell; the light is what makes it one.
- **A charger's wind-up has a bar.** A pixel bar over the body (`render/tells.ts`, in the
  layer over the dark with the E prompt) fills amber as it winds up and flashes red and
  white while its line is locked. The pose and the light say something is coming; the bar
  says when.
- **A strike is thrown straight.** The wind-up coils the body and curls the tail harder; the
  strike then flattens the swim wave and the turn's bend (`STRAIGHT` in `fishview.ts`) and
  lets them back over its last quarter. A charge drives thrust to its top, so before this the
  dash wriggled harder than the cruise — a gulper's 3.5 R units of wave across the body,
  now 0.4. The contrast with the coil is what makes the dash read as one.
- **A pickup lying loose stands in a beam and turns.** A shaft of its colour falls on it from
  above (`beamTexture`), its light pools round it, and it turns on the spot like Isaac's coin,
  its width stepping through whole art pixels and its back a shade darker (`PickupView`). A
  bloom alone was one more glow in a room full of them, and drops were swum past. A chest
  does not turn.
- **Shots light the room.** Each carries a light and a bloom (`render/shots.ts`), the bolt
  the most since it is light; a shot has to be seen coming in a dark room.
- **Whose shot it is comes before its kind.** The player's shots are the water's cool
  colours; a hostile's are hot red (`HOSTILE_COLOURS`), with a larger bloom that throbs and a
  stronger light, and its muzzle, splash and impact are red too (`Pulse.hostile`). One
  palette per kind made a spitter's spit the larva's own, and half the hits in a fight came
  out of shots that read as the player's.
- **A carcass glows red.** One texel of red just outside its silhouette (the skin's `uRim`),
  a red bloom and a red light, coming up once the roll is done. Tinted dim and floating among
  the rock, a kill left to be eaten was lost in the room. The bake's crop keeps a texel of
  water past the outline for the rim to be drawn on (`cropOf`).
- The water shader still adds the player's colour to the water around it (`uPool`), now at
  the body's world position rather than the screen's centre, since the camera holds the
  room and no longer follows.

## The drop-in and the drain

The drop-in (`render/dropin.ts`) is the one view of a tank from outside the glass, drawn in
screen space over everything and on the pixel grid with the frame: a brick gallery wall the
tank's light falls on, a lamp hung low over the water, a riveted frame, glare on the glass,
an air line bubbling, and the stand the tank sits on.

Inside the glass is the tank's own art, not a drawing of it. `DIORAMA` (`content/tanks.ts`)
is a rockscape template — open water to the top, rock banked against both panes, a bommie on
the sand, mirrored in every other tank — painted by `RoomView` (with no margin: the tank
ends at its glass) and by `DecorView` from the tank's decoration set, at one texel to a
frame pixel for the tank's width. Over it goes a baked water with the lamp's cone and rays
stepped through the Bayer screen, a shade that darkens toward the sand the way a room falls
off from what glows, and the lamp's light added over the rock. Terrain off its grid is rock,
so the template's top edge grows a rim half a tile deep; the waterline is drawn below it
(`RIM`) and the rim is masked off.

The bake is some 50–200 ms depending on the window, so it is done ahead: over the title for
the first tank, and 2 ms a frame of play for the next one. A drop-in asked for before its
tank is baked holds black until it is. The animal is its own `FishView` at the room's scale,
carrying its pool of light; it falls from above the screen in a fixed time, splashes (square
drops, a wavelet running out each way, the air it took down), and levels as it sinks. The
view pushes in toward it as it fades to black, and fades up on the room.

The drain (`DrainView` in `render/pedestals.ts`) is a pixel-map grate in the boss room's
floor with a pulsing cold light rising out of it: once the boss is dead it is the brightest
thing in the room, which is how it is found.

## Decoration

`render/decor.ts`: what grows on the rock, what has sunk onto it and what hangs from it,
where a room's colour lives. It never blocks, so it is placed and drawn in the render layer
and the simulation does not hear of it.

- **Every face** (`placeDecor`). The room's field is scanned column by column for floors
  (water above rock) and ceilings (rock above water), and row by row for walls. Each face
  notes how much water it faces and whether it is level, and the faces are walked in a
  seeded shuffle placing kinds by weight — floor rock, sand, ceiling and wall each weigh a
  kind differently — with a least gap per kind: `COVER` (1.8) pieces a tile of floor,
  `COVER_CEILING` (0.7) and `COVER_WALL` (0.5), since a room hung as thickly as its floor
  grows read as a cave choked shut. Small kinds take uneven faces; the rest need them level.
- **Each tank grows its own set** (`DECOR_SETS`): the nursery the reference frames' mix; the
  reef coral country — sea fans, brain and branching coral, sponges — with nets snagged on its
  roofs; the deep no weed and no light but its own — tube worms, sea lilies, glass sponges,
  glow bulbs and glow-worm threads hung from every ceiling, which are most of what a deep room
  is seen by. One **centrepiece** a room at most, on the widest flat floor: the nursery's
  crate, and the reef's wreck, the bow of a small boat half in the sand with its lamp still lit.
- **Kinds:** tube sponges (and glass sponges), anemones with glowing tips, kelp, branching
  coral, brain coral, sea grass, glow bulbs, a crate, sea fans, the wreck, tube worms, sea
  lilies, hanging weed, chains, nets, glow-worm threads and barnacles. Each is painted per
  pixel (`PAINTERS`) at the art density, upright and lit from above-left, then outlined and
  rimmed off its own silhouette, stepped through the Bayer screen and lit by the tank's light.
  Emissive pixels (a tip, an orb, a bead) are left bright.
- **Growing any way** (`Piece.grow`): a standing piece is turned from upright to hang from a
  ceiling or stand out of a wall, its base sunk back into the face; a swaying one is a
  `MeshRope` laid out from its holdfast the way it grows, so weed and threads hang and sway at
  their tips. A chain barely swings. Nothing rotates as a whole in motion.
- Pieces stand behind the bodies and under the rock's layer, so the rock covers each base
  and its shadow falls on what grows beside it; the centrepiece stands furthest back.

The board has a *Decoration* group — three seeds of each kind, what hangs shown hanging, and
the tanks each grows in — and the *Rooms* cells are decorated with their own tank's set.
Neither is lit: the board shows the art, the game shows it in the dark.

## Creatures

`src/content/form.ts` (shape), `src/render/creature/fishbake.ts` and its `bake/` painters
(art), `src/render/creature/fishview.ts` (the view).
One `FishView extends Container` per creature, holding one `MeshSimple`. Its three additive
Sprites (`aura`, `halo`, `core`) are **not** children of it: they live in `view.glow`, which
`World` parents into a single `world.glow` container under all the bodies. A blend-mode
change between the meshes would break the sprite batch once per animal on screen, so the
blooms are gathered instead and every one of them draws in a single batch off the shared
glow texture. The cost is that the view has to move and dim two display objects rather than
one: `place()` and `show()` on `FishView` are the only supported way to do it, and `main`
calls `show(seen, alpha, tint)` where it used to set `visible`, `alpha` and `tint` directly.

**The invariant: the art is painted once into a texture, and swimming moves vertices, not
geometry.** `animate(dt, thrust, beat, bank)` writes `2 x cols` floats and nothing else. The
sway is scaled by `SIDE_ON`: a fish flexes side to side, which from the side is mostly into
the screen, and the full lateral amplitude drawn as a vertical wave reads as a dolphin kick. No
path is re-issued and no `Graphics` is touched. Anything that changes how a creature looks
has to go through `rebuild(genome)`, which happens on mutation, not per frame.

### The shape is a spine and one depth curve

Creatures are seen side-on. A body in profile is a line from nose to tail plus a depth at
each point along it, split about the spine by `Form.up` (a humped back over a flat belly)
and bowed by `Form.arch`. `halfWidth(t, form)` — the name is from the view from above, and
it is now the half-depth — is a beta curve, `t^fore * (1-t)^aft`, normalised so its peak is
always 1 and always lands at `fore/(fore+aft)`. That normalisation is what makes the
parameters honest — the deepest point moves on its own instead of being a third number to
keep in sync. `edgeAt(t, form, k)` gives the top (`k = -1`), spine (0) and belly (+1) at any
point, and every painter places its part with it. `PLAN_FORMS` holds one `Form` per plan
and `formFor(genome, plan)` bends it with the genome, so a mutation that changes how an
animal feeds changes its profile too.

A plan is three records and nothing else: its `Form` in `PLAN_FORMS`, its swim signature
in `MOTION` (`fishview.ts`), and its art in `PLAN_ART` — arms, spines, gills, cilia, pale
eyes, caudal scale, smoke, and the three that carry a guardian's silhouette: `tail`
(`caudal` fork, whale `fluke`, or squid `mantle`), `blunt` for the sperm whale's box head
the depth curve cannot produce, and `dorsalFin`, the shark's. All are `Record<Plan, …>`,
so adding a plan is a data edit the compiler walks you through.

Plans with `grasp` rig their arms instead of painting them: `fishbake` bakes one arm
texture (`Baked.arm`) and leaves the arms out of the body, and `FishView` skins it onto a
strip per arm, rooted at the head under the body. Each arm is walked out as a chain whose
heading drifts on a travelling wave, so it curls; the outermost pair are the feeding
tentacles, blended from that coil toward a straight line onto `grab(target)` when the
simulation latches on.

Guardians are the exception to plans being shared: each has a body nothing else wears,
because a guardian is the animal the player is meant to recognise on sight.

### Facing

A side-on animal pitches toward its heading and turns back by flipping. `Creature.drive`
mirrors the heading and the facing in one step (see `simulation.md`); `faceFor`
(`content/form.ts`) catches a body whose heading drifts past vertical without asking, with a
hysteresis band so one swimming straight up does not flip back and forth. `drawnAngle` eases
the drawn pitch toward 55°, because at vertical the two facings are the same animal mirrored
about its spine and a fish standing on its tail has no profile left to read.

`FishView` mirrors the strip in the frame the facing changes — the body's origin is at x 0 on
the strip, so the mirror is `x × facing` for every column, lamp and arm — and `FLIP_TIME`
(0.2 s) of recoil is the whole of the turn: the body bunched along its length and deeper
across it, and `uFlip` in `living.ts` nubbing the entire outline, back and belly as well as
fins, re-rolled every few frames as it thins out. `Creature.face` is state of the body, not
the view, because the lure's strike point (`sim/organs/body.ts`) has to agree with where the
bulb is drawn. The design board's *Motion* group loops the flip for three species.

Every animated turn was undone — a roll about the spine, then a yaw folding the strip nose to
tail — see `decisions.md`.

Every strip is drawn with `render/creature/living.ts`: sub-pixel sampling (four
taps blended across one screen pixel, so a fractional move shows as in-between colours) and a
displacement on the grid: single texels moved by whole texels, decided per texel and held for
a frame — a one-texel nub running back along each fin's outline, the tail's tip stepping a
texel on the beat, a lone nub now and then. A smooth sine field read as the art wobbling, and
shifting whole fin columns by a texel read as rough: only the outline moves, and only outward.
The cost is the batch: a mesh with its own shader is a draw call per body.

### Motion states

`Creature.pose()` says what a body is doing beyond swimming, and `FishView.animate` owns how
each looks — the Motion group on the design board loops every one of them:

- **Idle.** Under a third of full effort the body hangs and breathes: a slow rise and fall
  (`bob`) and the nose nodding (`sway`), both fading out as it swims.
- **Wind-up.** Drawn back along its own axis and bunched, with the tail wave strengthened;
  the jaw opens a third of the way in.
- **Strike.** Stretched long and narrow, easing back as it is spent; jaw open. A boost and a
  guardian's rush use the same pose.
- **Bite.** The existing chomp squash, with the jaw snapped shut for it.
- **Hurt.** `Combat.land` calls `view.hurt(dx, dy)` with the way the blow was going: the
  drawn body is knocked along it and back, bunched, white for its first ~80 ms (the skin's
  `uFlash` — a tint only multiplies, and red on a dark animal in a dark room barely showed),
  then red through `show`'s tint, fading. It no longer blinks, which hid the body in the
  frames meant to show the hit. `Impacts` lights it: every hit the player lands throws a
  short warm light on the body (`Fx.flash`, drawn by the lighting pass), a kill a bigger one
  and a second ring, a shot's impact sprays its colour back off the body (`Fx.spray`), and a
  hit on the player lights it red and startles the frame.
- **Death.** `World.remove` hands a body that died on screen to `die()` instead of
  destroying it, and plays it out in `playDeaths`: swallowed whole (`Creature.eatenBy`) it
  is drawn into the swallower's mouth, shrinking; otherwise it rolls belly-up, drifts to a
  stop, sinks and fades, its lights going out first.

The jaw is a second texture: every body is baked twice on identical sheets, mouth shut and
mouth open for the strike (`head(…, attack)`), cropped to their union so the mesh can swap
`baked.open` in without moving. The player's jaw opens when there is prey at its mouth.

### Pixel art, and nothing is stroked

`fishbake.ts` paints on a `Sheet` (`bake/sheet.ts`): a material per pixel, at the frame's
own density, so one texel of art is one pixel of the frame. Painters say what a pixel *is*
— body, fin, gauze, mouth, tooth, filament — and `shade` colours it afterwards:

1. **A ramp.** Six hue-shifted values, outline to rim (`bake/palette.ts`); the darks lean
   toward indigo and the lights toward cyan, so a step down the ramp is a change of colour
   as well as of value.
2. **Light from above.** Lit toward the top of each column and rounded by the distance to
   the edge, pushed through the palette's pigment — a dark back over a pale belly, which is
   countershading seen from the side — and speckled with the water's own noise.
3. **Dither.** The same 4×4 Bayer matrix as `FramePass`, where two ramp steps meet.
4. **A derived outline and rim.** Open water touching the animal is the darkest step; the
   first body pixel under open water is the brightest. A fin laid over the body gets an inner
   edge where it leaves it.

The rule against stroking still holds, for the reason it was made: a contour with a position
of its own draws twice wherever two parts cross. The outline here has no position of its
own — it is read off the finished silhouette — so it cannot double.

Detail has a budget. Below 6 texels of body length an animal is a body and nothing else;
below 12 it gets its lights but no eye, fins or mouth. At its real size a krill is four
texels long, and an eye on it is the whole animal.

Colours that are not lit by the water — eyes, light organs, venom — go on as decals, and
every light organ also records an emitter (`Baked.lights`). `FishView` hangs a small bloom
on each, in `glow` with the rest so they batch. That layer is not rotated or mirrored with
the body, so `place` carries each lamp through the body's transform by hand — which is why
the design board stacks `glow` beside the body rather than inside it. A lamp is sized in
pixels of the frame, not in body lengths, or a leviathan's photophores are searchlights.

The swim wave and the turn bend are scaled by `Baked.depth`, the body's own half-depth,
not by the strip: side-on the strip also holds the dorsal, the lure and the barbels.

### Skinning

The baked texture is mapped onto a triangle strip of `cols` columns, whose centre line is a
travelling wave. Vertex normals come from each column's neighbours, so the body keeps its
width perpendicular to the curve instead of shearing.

The sway amplitude rides `quintic(s)` — Perlin's `6t^5 - 15t^4 + 10t^3`, whose first *and
second* derivatives vanish at both ends. The wave has to arrive at the skull with no slope
and no curvature or there is a crease there, and a crease reads as exactly the joint this
approach exists to remove. A linear or cubic envelope is not enough.

Watch the UVs: the columns run nose to tail (decreasing x) while the texture's u increases
to the right. Reading the column index straight into u renders every creature mirrored, and
it renders perfectly happily that way.

Thirteen plans — microbe, darter, shark, eel, jelly, squid, angler, leviathan, the four
guardian bodies (greatshark, whale, longsquid, broadsquid), and `wraith`,
which only the player wears — each with a `MOTION` record (columns, waves along the body,
sway amplitude, bell pulse). `PLAN_FORMS` is the list; the design board reads its keys, so
a plan cannot be added to the game without appearing there.

### Baking

`bakeFish` caches by a deliberately coarse key: two genomes that differ by less than a hue
step are the same picture, so a school of forty krill is one texture. The cache is capped at
160 entries. Painting is on the CPU into a canvas; no renderer is needed.

The density follows the camera (`artDensity` in `render/pixel.ts`, `zoom / PIXEL` texels per
world unit) in tiers of a quarter octave, with hysteresis. A tier change bumps
`artVersion`, and each view re-bakes the next time it animates: 97 creatures cold is about
10 ms, and from the cache about 3. The resolution is then quantised in sixth-octave steps
per animal, which keeps a species' individuals on a few shared textures.

The sheet is sized generously and cropped to what was painted, held symmetric about the
spine, so no part can be clipped by a bounds estimate.

`menace` is read inside the view, so the same genome always produces the same animal.

## Fields

Not in play since the tank rework (roadmap stage 1): the fields and the parallax planes
were the column's background, and are kept for the board until stage 8 decides what a
room's decoration takes from them.

`render/fields.ts` gives each band one or two things adrift in its water, on a plane of its
own at parallax 0.45 between the two back planes: a clump of sargassum with fronds hanging
under it and a knot of fry (Open Water), a sea fan torn off the reef and tumbling (Reef
Shelf), a siphonophore with snow falling past (Twilight), a ring of pulsing sparks over a
bell (Midnight), a column of embers rising from a vent too far below to see (Abyss), and a
ribcage sinking through the dark (Trenches). Nothing is rooted: the column has no floor, so a
mound, a chimney or a whale fall on the bottom read as scenery from a sea bed the player
never sees. Parts of one object have no wander of their own; the whole field drifts and
rocks, so the object holds together and only its fronds and threads move on it.

- **Placement.** Rows per band, a field in every other cell along a row (`CELL_W`), placed
  every frame from the zoom, since the plane holds its apparent size like the others.
- **Pixels.** Parts are painted smooth and brought down with `pixelArt` at one texel per
  2.4 plane units, per size bucket; only far parts are blurred.
- **Blend.** Each field has a `shade` layer (multiplied in lit water, added in the dark) and
  a `shine` layer (added), so a silhouette darkens the water behind it by a share and a
  flake brightens it. See `decisions.md` for why a flat tint could not work.
- The design board's *Fields* group shows each band's field alone, through `Fields.patch`.

## HUD

`src/ui/` is all DOM over the canvas — `UI.ts` is the game-facing facade, `hud/`
holds the in-play chrome, `screens/` the overlays, and `icons.ts` the glyph set. Nothing in
the HUD is drawn on the canvas, and nothing in the game reads the DOM.

Isaac's layout: the status panel top left (hearts, belly, shells), the stat column under it
(`StatColumn`), the minimap top right, the active slot bottom centre with a pip a room of
charge, and, beside a pedestal, the mutation's card at the top (`OfferCard`), clear of the
floor the pedestal stands on.

**The pedestal** (`render/pedestal.ts`) is drawn in the world: a plinth of the rock's own
stone, a tile across, stood on flat floor under the middle of the room (`Terrain.standAt`),
and the mutation over it as its glyph in its rarity's colour, bobbing, with a bloom and a
light — the one lit thing in its room. The glyphs are one raster (`render/glyphs.ts`) for
the HUD's SVG and the world's canvas alike.

The DOM is not under `FramePass`, so it is put on the grid by hand. The glyphs are path data
stroked once per size onto a grid of 2 px cells and kept or dropped by coverage
(`createIcon`), the stroke never thinner than a cell, and drawn as runs of hard rects in
`currentColor`, so rarity still colours them. The danger vignette is four hard inset bands
and a 2 px checkerboard past the last, where it was a 160 px blur.
