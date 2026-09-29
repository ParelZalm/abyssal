# Rendering

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
- **Hurt.** `Combat.land` calls `view.hurt()`: knocked short, flashed red through `show`'s
  tint, and blinked for its first frames.
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
the HUD is drawn on the canvas, and nothing in the game reads the DOM. The one coupling is
`ui.gateLabel(text, screenY, screenH)`, which `Scene.draw` feeds a screen position computed
from the seal's world depth.

The DOM is not under `FramePass`, so it is put on the grid by hand. The glyphs are path data
stroked once per size onto a grid of 2 px cells and kept or dropped by coverage
(`createIcon`), the stroke never thinner than a cell, and drawn as runs of hard rects in
`currentColor`, so rarity still colours them. The danger vignette is four hard inset bands
and a 2 px checkerboard past the last, where it was a 160 px blur.
