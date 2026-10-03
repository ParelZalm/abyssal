# Enemy sprites: from a reference to the game

How an enemy goes from a picture someone generated to the animal swimming in a tank — what
the person making the art does, what the code side does with it, and where each step has
already gone wrong once. The anglerfish was the first through it (October 2026).

## Why, and for what

Every body in the game used to be painted from its genome (`render/creature/fishbake.ts`),
because a mutation has to show on the body. The painters top out well short of a hand-drawn
reference: the anglerfish was taken as far as they go, and then through an angler-only
painter that lit every part as its own form, and neither got close. The comparison is kept
on the branch `prototype/angler-art` (the board's *PROTOTYPE · Angler art* group). Enemies
never mutate, so an enemy can be **drawn from a sprite** instead: one authored picture of one
animal, which can match its reference exactly.

- **Enemies only.** The player and every plan it can transform into stay painted.
- **Size decides what survives.** A sprite is resampled to the frame's pixel density
  (`render/pixel.ts`), which falls with the tank's zoom and a smaller window. At 20–30 texels
  long, which is an anglerfish at its own size in the deep tank, the reference itself is a
  smudge with two dots. `Species.drawn` draws an animal bigger without touching its stats
  (*Size*, below).

### What a sprite cannot carry yet

Check the animal against this before asking for art; each is code to write first.

| Gap | Who has it | What it would take |
| --- | --- | --- |
| A boss's set-piece parts | the mantis shrimp's club, the Giant Squid's arms torn one at a time | per-part images; not planned |

A moveset's turned look at half health (`woundedGenome` in `sim/roles.ts`: the mackerel
flushed red, the pufferfish's spines up, the nettle glowing, the triggerfish red, the lionfish
flared, the moon jelly flushed) is a pair of frames of its own, *wounded* and *wounded strike*
(*Frames by role*, below).

A squid's arms are not in its picture: they are one image of one arm, imported from a sheet
of its own and rigged as the painted arms are, eight times over (`SpriteArt.arm`; the vampire
squid's, [sprite-prompts-deep.md](sprite-prompts-deep.md)).

Everything else — the swim, the flip, a hit's whitening and knockback, the belly-up death, the
glow and bloom, the facing mirror — works on a sprite as it does on a painted body, because
they all act on the skinned mesh and its shader, not on the painting.

## The pipeline

1. **Pick the animal** and check the gaps above.
2. **Settle the design** with a reference sheet (optional; *Stage A*). Skip it when the design
   is already decided.
3. **Generate the sprite sheet** (*Stage B*): the art the game uses.
4. **Import it** with `npm run sprite`.
5. **Wire it**: one line in each of two tables, and a drawn size.
6. **Check it** on the design board and in a tank.
7. **Commit** the sheet, the frames and the tables together.

## The art side

The person generating the art does stages A and B and sends the results back. Attach the
earlier sheets as style references every time, so the roster stays one style:
`docs/media/reference/cave-room.webp` for the world and `docs/media/reference/angler.webp`
for a finished animal.

### Stage A — the reference sheet (design)

Four images of one animal, which is where its design gets argued out. It is not used in the
game; it is what Stage B is drawn from. Generate each image separately; most generators lose
consistency across panels. Fill in the `«…»` slots.

```text
STYLE (shared by every image)
Reference sheet for a game creature: «animal, with its Latin name if real».
Match the attached sheets: dark navy water, side-on, the look of dark underwater pixel
art. Exactly one creature, nothing else in the frame: no rock,
no plants, no bubbles, no particles, no text except where asked. Strict lateral
profile, facing RIGHT, body straight and horizontal, not curved or swimming. Every
fin spread open so its outline reads. The whole animal fits in the frame with a
margin around it. Output as a large lossless PNG, at least 2048 px wide.

ANATOMY (must be accurate)
«Body shape. Head and eye. Mouth and teeth. Each fin and where it sits. Lights,
lures, feelers or tentacles. Colours of body, fins, lights.»

IMAGE 1 — "in game"
The animal fully rendered in the attached sheets' style, on a flat solid background of
«the tank's water: nursery #071731, reef #082039, deep #0b1530». Lights glow with only
a small, tight halo.

IMAGE 2 — "flat"
The same animal, same pose, same outline, flat colour only: no shading, no highlights,
no glow, no outline stroke, no texture. Each region one solid colour. Flat white
background.

IMAGE 3 — "parts"
The same animal taken apart, like a technical exploded diagram: each part drawn
separately with a clear gap, in its original position and orientation, pulled slightly
outward, each with a small plain label. Flat white background.

«IMAGE 4 — "turned" (only for a moveset that turns, before the palette)
The same animal «turned: how it looks», same pose and same outline as image 1 except
«what has to change», on the same water.»

IMAGE «4 / 5» — "palette"
A single row of 6–8 large square colour swatches taken from image 1, each with its hex
code under it: outline, deep shadow, body, highlight, fin, mouth, light, eye. «For a
turned animal, a second row under it: the same roles taken from the turned image.»

AVOID
Three-quarter or front views, curved or bent bodies, a dynamic swimming pose, several
animals, a scene, smooth gradients, big soft bloom or halos, depth of field,
watermarks, frames, borders.
```

An animal with a wounded pair (*Frames by role*) gets the turned image, so its turned look is
argued out with the rest of the design rather than invented by Stage B, and the second row of
swatches is the palette its frames 3 and 4 are drawn in.

### Stage B — the sprite sheet (production)

The frames themselves, as true pixel art on a flat key colour. Attach the animal's Stage A
sheet as well as the style sheets. Fill in the `«…»` slots; *Frames by role* below says which
frames. **The key colour** is magenta, or green for an animal that is violet, pink or red:
magenta bled into those cannot be told from paint (the reef's ribbon eel, lionfish and moon
jelly went on green and imported with `--key green`).

```text
GOAL
True pixel-art sprite of the «animal» in the attached reference sheet, for a game.
Same design as the reference (shape, fins, jaw, teeth, eye, lights, colours),
redrawn as clean pixel art on a strict grid. «N» frames of the same animal,
side by side, left to right: «frame names».

THE GRID (most important)
- Each frame is exactly «W» × «H» art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block dark outline («outline hex») round the whole silhouette, never thicker.

COMPOSITION
- Strict side view, facing RIGHT, body straight and horizontal. Fins spread.
- From the tail tip to the snout the animal is «L» art pixels long.
- The body is centred vertically: its midline, tail stalk to snout, lies along the
  frame's horizontal centre line.
- Thin parts (tentacles, spines, feelers, fin rays) are at least 2 art pixels thick: the
  game shrinks the sprite, and a 1-pixel line is the first thing to go.
- Everything fits inside the frame with at least 4 art pixels of margin, in every frame.
- Background: flat pure «magenta #FF00FF / green #00FF00», one colour, nothing else. Do not
  use «magenta / green» anywhere on the animal, and do not let the outline pick up a tint of
  it where it meets the background.

PALETTE
Use these colours, plus at most 8 in-between shades of them: «the Stage A palette».
Light comes from above and slightly in front: lit top, darker belly. Each part shaded
as its own rounded form. «For a clear body (a bell, a jelly): draw its inside close to
the dark water with only its rims bright, so it reads as glass.»

LIGHTS
Eyes, lures and photophores are flat bright pixels. NO glow halo, bloom or light
spill, on the animal or on the background. The game adds the glow itself.

«FRAME 1 — "rest"
The animal at rest, as in the reference.»

«FRAME 2 — "strike"
Identical to frame 1 in every pixel except «what moves»: «how it moves». Same frame
size, same position, same everything else, so the two can be swapped without the
animal moving.»

«FRAME 3 — "wounded"
The same animal turned at half health: «how it looks turned». Same frame size, same
position, same outline and pose as frame 1 except where the change itself needs
more room, so the two can be swapped without the animal moving.»

«FRAME 4 — "wounded strike"
Identical to frame 3 in every pixel except «what moves», moved exactly as in frame 2.»

AVOID
Three-quarter or front views, any background other than the flat key colour, soft glows,
painterly texture, noise, sub-pixel detail, text, labels, borders, shadows, a second
animal.
```

**Sizes.** `«L»` 128 is what the anglerfish was asked for, and enough for it drawn at up to
three or four times its size on a big window; the game shrinks it for anything smaller. A
long animal (an eel) can take more length and less height. `«W»` × `«H»`: the length plus
the tail and anything in front (a lure), by the depth plus the fins and anything above, with
the margin — the anglerfish's was 176 × 112.

### Frames by role

What the game swaps and when. `rest` is always needed. `strike` is the second texture every
body carries (`Baked.open`), shown through a bite or a strike.

| Role (`Species.role`) | Frames | What moves in `strike` |
| --- | --- | --- |
| charger (mackerel, ribbon eel, barracuda, gulper) | rest, strike | the jaw opens for the hit |
| spitter (archerfish, triggerfish) | rest, strike | the mouth opens to fire |
| a squid (vampire squid) | rest, strike; and one arm, on a sheet of its own | the tell: the vampire squid's light organs open. The arm is laid out straight, root left, tip right |
| turret (pufferfish, lionfish, anglerfish) | rest, strike | the jaw; a spined turret can raise its spines instead |
| drifter (jellies, siphonophore) | rest | — (the pulse is the mesh's) |
| a wounded moveset (`pack`, `balloon`, `jet`, `herd`) | rest, strike, wounded, wounded strike | the wounded frame is the turned look whole; its strike moves as the strike does |
| a wounded drifter (`bloom`, `wane`) | rest, wounded | — |

The wounded pair is swapped in for good when the hostile turns at half health (`Roles.turn`),
so a turned animal still shows its tell. Without a wounded strike the wounded frame stands
for both, and the turned animal's tell is its light alone; ask for the fourth frame.

### Before sending it back

- **The grid.** Zoom in: the blocks should be clean squares. A sheet a little off its grid
  is fine (the import finds a drifting grid), but blur or soft edges are not.
- **The frames line up.** Flip between them: only the part named in the prompt should move.
  Generators redraw the whole animal anyway; the import takes only the part that moved, but
  the closer the rest of it is, the cleaner the seam.
- **Magenta is only the background,** and nothing glows.
- **Send the PNG,** not a screenshot of it. Several candidates are welcome; the differences
  between them say which features matter.

## The code side

### 1. Save the sheet

Into `docs/media/reference/«species»-sprite.png` (or `.webp` beside a PNG copy). The import
reads PNG only; a WebP or JPEG converts with macOS's own tool:

```bash
sips -s format png docs/media/reference/gulper-sprite.webp --out /tmp/gulper-sprite.png
```

### 2. Import it

```bash
npm run sprite -- /tmp/gulper-sprite.png --id gulper
```

`scripts/import-sprite.mjs` writes `src/render/creature/sprites/«id».png` (and
`«id»-strike.png`) at one pixel per art pixel, a preview at six times into the system's temp
folder, and prints the landmarks. What it does, and why:

- **Frames** are the wide runs of columns with anything on them, left to right: rest,
  strike, wounded, wounded strike, as many as the sheet has. `--frames` names them when they
  are some other set: a wounded drifter's sheet is `--frames rest,wounded`.
- **The grid is found, not assumed.** The pitch is the period the row edges agree on (the
  anglerfish's was 6.545 image pixels and the gulper's 3.955, not the 8 asked for — a sheet
  drawn finer than asked is fine, since the game shrinks it anyway), and each cell boundary is the
  strongest colour edge within a fifth of a pitch of where the last one says it should be.
  The anglerfish's columns drifted by three art pixels across a frame; a fixed pitch doubled
  and dropped columns.
- **Each cell is its median colour,** over its inside only (a pixel in from every edge), so
  the blur and compression at a cell's border do not pull it toward its neighbours. Both
  frames are then clustered to one palette of 22 (`--colours`).
- **The strike is lined up on the rest** by the back half of the body, and **only the part
  that moved is taken from it**: the box round where the two silhouettes disagree in a
  solid patch, grown by four cells. A generator's second frame is redrawn whole, and swapping
  all of it in made the anglerfish's whole body shimmer on every bite. A strike taller than the rest
  (the lionfish's spines raised) is searched for as far as it is taller, and both frames are
  padded at the top for it; before, the import looked six cells either way and cut off
  whatever stood above the rest frame.
- **The wounded frame is lined up on the rest by its outline and taken whole,** since all of
  its colours change; the wounded strike is lined up on it and reduced to what moved, as the
  strike is on the rest (`--keep` holds for both). The rest and strike share one palette and
  the wounded pair has its own, so a flush red does not take the whole animal's colours, and
  the game snaps each pair to its own. Every frame is padded to hold the others.
- **Landmarks** are guessed from the picture: the tail root is the narrowest column of the
  back third, the axis the middle of it, the snout the last column with body just under the
  axis. A lit blob past the snout is offered as a lure's bulb (delete it if the animal has
  none), and the four biggest lit blobs as light candidates: keep the real organs, drop the
  teeth and photophores that catch the light too.
- **The hitbox** is measured off the silhouette: nine samples snout to tail, each the run of
  body holding the axis at 85% of its depth, so it sits a little inside the picture. Fins
  that join the body count; a lure's rod is a run of its own and does not. The plan's form
  under a sprite is only roughly its shape — the gulper's pouch hung outside it — so a sprite
  is hit where it is drawn.

Open the preview. When something is off:

| Looks like | Fix |
| --- | --- |
| doubled or missing rows or columns, a smeared grid | `--pitch` with the right period, measured off the sheet: the outline climbs a gentle slope in steps one art pixel high |
| the strike's seam cuts through something, or misses part of what moved | `--keep x0,y0,x1,y1`, the box in the rest frame's cells; several split by `;` for parts apart (the vampire squid's two light organs) |
| the wounded strike's head is not where the rest's is, and one box takes the wrong part of it | `--keep-wounded x0,y0,x1,y1` for the wounded strike alone (the pufferfish's ball was drawn shorter than the fish) |
| a sheet drawn much finer than asked, which the pitch search misses (a grid a dozen cells long) | `--pitch`, found by sweeping it: the grid holds still across a range of pitches round the true one (the mackerel's 3.46, the pufferfish's 3.2) |
| banding, colours merged that should not be | `--colours 28` |
| magenta or dark-violet specks round the outline: the background bled into the rim cells, too dark to key out | `--fringe`, unless the animal is magenta itself (it goes by hue; the gulper and the mantis shrimp would lose their outlines) |
| thin parts tinted violet whole, on an animal with no violet in it | `--fringe 240`, which takes bleed from 240° up: bleed into blue lands at 245–270°, under the default's 272° (the siphonophore's tentacles) |
| an animal that is violet, pink or red, which magenta's bleed cannot be told from | have the sheet made on flat green #00FF00 and import it with `--key green` (with `--fringe`, the bleed is green from 75° to 170°) |
| brown or olive specks round a red outline on green: the bleed mixed into the red | `--fringe 30`, on an animal with no yellow or orange in it (the mackerel's flushed frames) |
| a sheet without its wounded frame, for a turn that is only colour | `--wounded-palette` with the Stage A palette's two rows, `#from1,#from2,…/#to1,#to2,…`: the rest (and strike) recoloured, each colour moved by its nearest swatch's step (the sea nettle's) |

### 3. Wire it

- **`render/creature/sprite.ts`**: import the PNGs and add them to `SOURCES` under the
  species id: `rest` and `strike`, and `wounded` and `woundedStrike` for a moveset that turns.
- **`content/sprites.ts`**: add the printed landmarks to `SPRITES`, and look at each on the
  board before trusting it. They are what ties the picture to the simulation: `snout` to
  `tail` spans the plan's form, so the length the simulation uses is the picture's; `axis` is
  the line the swim bends about; `hull` is the hitbox (`sim/hull.ts`); `bulb` is where a
  lure's trap fires; `mouth`, set by hand, is where a spitter's shots leave it, which at the
  body's radius was inside a drawn-bigger head; `lights` are where the view hangs a bloom, in each organ's own colour;
  `woundedHull`, set by hand, is the hitbox once the hostile has turned, for a turned look that is
  not the same body (the pufferfish's ball); `legs`, set by hand, is the box a row of legs hangs in, which the skin walks in a wave from
  the tail to the head (the mantis shrimp's; keep the arms and fins out of it); `bells`, set
  by hand, is a jet-swimmer's swimming bells and their mouths: only they squeeze on the pulse,
  and each squeeze squirts water from the mouths (the siphonophore's); `trail`, set by hand,
  is what hangs behind a drifter's bell, root to tips, which the skin sends a wave down on
  each pulse. A drifter has one
  frame, and `SOURCES` takes it alone.
  Write the import command into the comment above the entry, flags and all, so it can be
  run again.
- **`content/species.ts`**: set `drawn` (*Size*, below).
- **`content/sprites.ts`**: point `NEWEST` at it, so every tank's first fight room holds it
  alone to test, a run's first fight included.

Nothing else changes: `FishView`, `Creature` and the board's cells already pass the species
through, and `bakeFish` takes the sprite path for any species with frames loaded.

### Size

`Species.drawn` (the anglerfish's is 2) draws an animal that many times bigger than its
genome's size, and **only what is seen or touched** takes it: the picture, the hitbox, the
radius, a lure's trap and its reach, where a turret's shots leave the skin, the clearance it
is spawned with, the board's framing (`Creature.drawnSize`). The rock meets a sprite at its
drawn half-depth, read off its hull and blown up by its swell (`wallR` in `sim/hull.ts`),
where a painted body meets it with a circle a third of its length across: a deep sprite sank
into the floor through that, and the pufferfish's ball by a tile. Health, bite, senses, turning,
swallowing and what it is worth eaten keep the genome's size (`maxHp` grows as size^1.35), so
the fight stays the one it was, against a bigger target. Doubling the genome's size instead
would have retuned every one of those.

Pick it by looking: the sprite's detail (teeth, eyes) should still be there in a tank on a
1920-wide window. The anglerfish at 1 was 33 texels long there and its fangs were gone; at 2
they read.

### 4. Check it

- `npm run build`.
- **The board:** `/design.html?g=species&i=«id»` (the cell swims the sprite), the *Motion*
  group if the animal is in it, and *Hostile roles* for its role.
- **A tank:** `/?tank=«tank»&room=fight&god=1` and swim up to it: the strike frame on a bite,
  shots leaving its skin, a lure's trap firing at the bulb you see.
- **The turn,** for a wounded pair: the board's *Hostile roles* group has the animal turned
  beside it whole (`role-«id»-turned`); in a tank, take it under half health from the console
  (`game.world.creatures.find(c => c.hostile).hp = 1`) and step a few frames.
- **The hitbox:** shots should stop on the drawn body, not in the water beside it. If they do
  not, `hull` or `snout`/`tail` is wrong.

### 5. Commit

The sheet in `docs/media/reference/`, the frames in `render/creature/sprites/`, the
`SOURCES` and `SPRITES` entries and `drawn`, in one commit. Mark the species done in
[roadmap-enemies-rework.md](roadmap-enemies-rework.md) in the same commit.

## Converting the current roster

The list — which enemies are done, which are ready, which are blocked and on what, and the
order — is [roadmap-enemies-rework.md](roadmap-enemies-rework.md). While it is under way only
reworked enemies are dealt into fights (`REWORKED_ONLY` in `content/sprites.ts`).
