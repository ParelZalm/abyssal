# Sprite prompts: the reef

The two prompts for each of the reef's four enemies, filled in from
[sprites.md](sprites.md#the-art-side). Work through them in the roadmap's order: ribbon eel,
triggerfish, lionfish, moon jelly.

**Attach every time:** `docs/media/reference/cave-room.webp` and `tank-room.webp` for the world,
and `angler.webp` and `barracuda.webp` for finished animals. For Stage B, attach the animal's
chosen Stage A sheet as well.

**These go on green, not magenta.** The ribbon eel is violet, the moon jelly violet-pink and
the lionfish red, and magenta bled into those colours cannot be told from paint. None of the
four has any green in it, so green bleed is always plain to see and clean out.

**Fill in the palette** in each Stage B from the swatches of the Stage A sheet you choose.

---

## 1. Ribbon Eel — charger: rest, strike (jaw)

### Stage A

```text
STYLE (shared by every image)
Reference sheet for a game creature: a ribbon eel, Rhinomuraena quaesita, the adult
blue phase. Match the attached sheets: dark navy water, side-on, the look of dark
underwater pixel art. Exactly one creature, nothing else in the frame: no rock, no
plants, no bubbles, no particles, no text except where asked. Strict lateral profile,
facing RIGHT, body straight and horizontal, not curved or swimming. Every fin spread
open so its outline reads. The whole animal fits in the frame with a margin around it.
Output as a large lossless PNG, at least 2048 px wide.

ANATOMY (must be accurate)
A very long, very thin, flat-sided eel, a ribbon: about twenty times as long as it is
deep, tapering to a fine point at the tail.
- Head: a narrow pointed snout, the mouth held a little open in a long jaw line, the
  lower jaw slightly longer than the upper. Small sharp teeth. A small round eye just
  behind the corner of the mouth, ringed in yellow.
- At the tip of the snout, the ribbon eel's mark: two tubular nostrils, each flaring
  into a fan-shaped leaf, standing up and forward like small trumpets. Three short
  barbels under the chin.
- One continuous dorsal fin running the whole length of the back, low and even, joined
  round the tail tip to an equally continuous anal fin along the belly.
- No visible pectoral fins.
Colours: the body an electric violet-blue, darker along the back and lighter at the
belly; the dorsal fin, the anal fin, the snout, the lower jaw and the nostril leaves
bright yellow; the fins' edges a pale yellow-white.

IMAGE 1 — "in game"
The animal fully rendered in the attached sheets' style, on a flat solid dark navy
background (#082039). Any light on it is small and tight, no halo.

IMAGE 2 — "flat"
The same animal, same pose, same outline, flat colour only: no shading, no highlights,
no glow, no outline stroke, no texture. Each region one solid colour. Flat white
background.

IMAGE 3 — "parts"
The same animal taken apart, like a technical exploded diagram: each part drawn
separately with a clear gap, in its original position and orientation, pulled slightly
outward, each with a small plain label (head and jaw, nostril leaves, barbels, body,
dorsal fin, anal fin, tail tip). Flat white background.

IMAGE 4 — "palette"
A single row of 6–8 large square colour swatches taken from image 1, each with its hex
code under it: outline, deep shadow, body, body highlight, belly, fin yellow, fin edge,
eye.

AVOID
Three-quarter or front views, a coiled, curved or wavy body, a dynamic swimming pose,
several animals, a scene, smooth gradients, big soft bloom or halos, depth of field,
watermarks, frames, borders, a moray's thick body.
```

### Stage B

```text
GOAL
True pixel-art sprite of the ribbon eel in the attached reference sheet, for a game.
Same design as the reference (shape, fins, jaw, teeth, nostril leaves, eye, colours),
redrawn as clean pixel art on a strict grid. 2 frames of the same animal, side by side,
left to right: "rest", "strike".

THE GRID (most important)
- Each frame is exactly 240 × 56 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block dark outline («outline hex») round the whole silhouette, never thicker.

COMPOSITION
- Strict side view, facing RIGHT, body straight and horizontal. Fins spread.
- From the tail tip to the nostril leaves the animal is 224 art pixels long.
- The body is centred vertically: its midline, tail to snout, lies along the frame's
  horizontal centre line.
- The body is at least 8 art pixels deep for most of its length, plus the fins; the
  nostril leaves and barbels are at least 2 art pixels thick.
- Everything fits inside the frame with at least 4 art pixels of margin.
- Background: flat pure green #00FF00, one colour, nothing else. Do not use green
  anywhere on the animal, and do not let the outline pick up a green tint where it
  meets the background.

PALETTE
Use these colours, plus at most 8 in-between shades of them: «the Stage A palette».
Light comes from above and slightly in front: lit top, darker belly. Each part shaded
as its own rounded form.

LIGHTS
None: the eye is a flat yellow ring, with no glow, bloom or light spill.

FRAME 1 — "rest"
The eel at rest, as in the reference, the mouth a little open.

FRAME 2 — "strike"
Identical to frame 1 in every pixel except the jaws: they gape wide open, the lower
jaw dropped far down, the teeth showing. Same frame size, same position, same
everything else, so the two can be swapped without the animal moving.

AVOID
Three-quarter or front views, any background other than flat #00FF00, soft glows,
painterly texture, noise, sub-pixel detail, text, labels, borders, shadows, a second
animal, a wavy body.
```

---

## 2. Triggerfish — spitter: rest, strike (mouth)

### Stage A

```text
STYLE (shared by every image)
Reference sheet for a game creature: a triggerfish, in the build of a titan or blue
triggerfish (Balistidae). Match the attached sheets: dark navy water, side-on, the look
of dark underwater pixel art. Exactly one creature, nothing else in the frame: no rock,
no plants, no bubbles, no particles, no text except where asked. Strict lateral profile,
facing RIGHT, body straight and horizontal, not curved or swimming. Every fin spread
open so its outline reads. The whole animal fits in the frame with a margin around it.
Output as a large lossless PNG, at least 2048 px wide.

ANATOMY (must be accurate)
A deep, flat-sided, rhomboid body, about half as deep as it is long, with a long
sloping face.
- Head: the eye set high and far back on the head, well away from the mouth; a long
  bare snout sloping down to a small mouth at its tip, with thick lips and a few
  stout, chisel-shaped front teeth.
- Over the eye, the trigger: a first dorsal fin of one thick, stout spine with two
  smaller ones behind it, held half raised.
- Far back, a tall second dorsal fin and a tall anal fin, mirror images of each other
  above and below, shaped like rounded triangles.
- A small rounded pectoral fin just behind a short gill slit, low on the side.
- A rough, plated skin, drawn as a fine pattern of scutes.
- A small tail fin on a narrow stalk, crescent-shaped with pointed tips.
Colours: the body a deep blue, darker on the back, paler blue toward the belly; bright
golden-yellow lines curving back from the mouth over the cheek; the second dorsal,
anal and tail fins blue with gold edges; the trigger spine dark.

IMAGE 1 — "in game"
The animal fully rendered in the attached sheets' style, on a flat solid dark navy
background (#082039). Any light on it is small and tight, no halo.

IMAGE 2 — "flat"
The same animal, same pose, same outline, flat colour only: no shading, no highlights,
no glow, no outline stroke, no texture. Each region one solid colour. Flat white
background.

IMAGE 3 — "parts"
The same animal taken apart, like a technical exploded diagram: each part drawn
separately with a clear gap, in its original position and orientation, pulled slightly
outward, each with a small plain label (head and mouth, trigger spine, body, second
dorsal fin, anal fin, pectoral fin, tail fin). Flat white background.

IMAGE 4 — "palette"
A single row of 6–8 large square colour swatches taken from image 1, each with its hex
code under it: outline, deep shadow, body, body highlight, belly, gold, mouth, eye.

AVOID
Three-quarter or front views, curved or bent bodies, a dynamic swimming pose, several
animals, a scene, smooth gradients, big soft bloom or halos, depth of field, watermarks,
frames, borders, a pufferfish or a round body.
```

### Stage B

```text
GOAL
True pixel-art sprite of the triggerfish in the attached reference sheet, for a game.
Same design as the reference (shape, fins, trigger spine, mouth, teeth, eye, lines,
colours), redrawn as clean pixel art on a strict grid. 2 frames of the same animal,
side by side, left to right: "rest", "strike".

THE GRID (most important)
- Each frame is exactly 160 × 128 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block dark outline («outline hex») round the whole silhouette, never thicker.

COMPOSITION
- Strict side view, facing RIGHT, body straight and horizontal. Fins spread.
- From the tail tip to the mouth the animal is 128 art pixels long.
- The body is centred vertically: its midline, tail stalk to mouth, lies along the
  frame's horizontal centre line.
- Everything fits inside the frame with at least 4 art pixels of margin.
- Background: flat pure green #00FF00, one colour, nothing else. Do not use green
  anywhere on the animal, and do not let the outline pick up a green tint where it
  meets the background.

PALETTE
Use these colours, plus at most 8 in-between shades of them: «the Stage A palette».
Light comes from above and slightly in front: lit top, darker belly. Each part shaded
as its own rounded form.

LIGHTS
None: the eye is flat pixels, with no glow, bloom or light spill.

FRAME 1 — "rest"
The fish at rest, as in the reference, the mouth closed.

FRAME 2 — "strike"
Identical to frame 1 in every pixel except the mouth: the lips pushed forward and
pursed open into a round O, about to blow a jet of water, the front teeth showing. Same
frame size, same position, same everything else, so the two can be swapped without
the animal moving.

AVOID
Three-quarter or front views, any background other than flat #00FF00, soft glows,
painterly texture, noise, sub-pixel detail, text, labels, borders, shadows, a second
animal, any water jet or spray drawn in the frame.
```

---

## 3. Lionfish — turret: rest, strike (spines up)

### Stage A

```text
STYLE (shared by every image)
Reference sheet for a game creature: a red lionfish, Pterois volitans. Match the
attached sheets: dark navy water, side-on, the look of dark underwater pixel art.
Exactly one creature, nothing else in the frame: no rock, no plants, no bubbles, no
particles, no text except where asked. Strict lateral profile, facing RIGHT, body
straight and horizontal, not curved or swimming. Every fin spread open so its outline
reads. The whole animal fits in the frame with a margin around it. Output as a large
lossless PNG, at least 2048 px wide.

ANATOMY (must be accurate)
A compact, deep-headed fish, about a third as deep as it is long, carrying far more fin
than body.
- Head: large, with a big upturned mouth; a short fleshy tentacle standing up over
  each eye and a small one under the chin. A large eye.
- The venomous dorsal spines: about 12 long, separate spines along the back, each
  standing free with a thin strip of membrane trailing it, longest at the front,
  swept back.
- The pectoral fins: two huge fans from behind the head, made of long separate rays
  joined by membrane only near the body, so their outer ends are feathery.
- A soft second dorsal fin and an anal fin behind, small and rounded; a pair of small
  pelvic fins under the chest.
- A rounded tail fin, spotted.
Colours: bold vertical bands over the whole body, head and every fin, alternating deep
rust-red and pale cream; the fin rays banded the same way; the eye red-brown.
Desaturate the red slightly so it sits in dark water: rust, not scarlet.

IMAGE 1 — "in game"
The animal fully rendered in the attached sheets' style, on a flat solid dark navy
background (#082039). Any light on it is small and tight, no halo.

IMAGE 2 — "flat"
The same animal, same pose, same outline, flat colour only: no shading, no highlights,
no glow, no outline stroke, no texture. Each region one solid colour. Flat white
background.

IMAGE 3 — "parts"
The same animal taken apart, like a technical exploded diagram: each part drawn
separately with a clear gap, in its original position and orientation, pulled slightly
outward, each with a small plain label (head, eye tentacles, dorsal spines, pectoral
fan, second dorsal fin, anal fin, pelvic fin, tail fin). Flat white background.

IMAGE 4 — "palette"
A single row of 6–8 large square colour swatches taken from image 1, each with its hex
code under it: outline, deep shadow, rust, rust highlight, cream, cream shadow, fin
membrane, eye.

AVOID
Three-quarter or front views, curved or bent bodies, a dynamic swimming pose, several
animals, a scene, smooth gradients, big soft bloom or halos, depth of field, watermarks,
frames, borders, fins drawn as solid sails without separate rays.
```

### Stage B

```text
GOAL
True pixel-art sprite of the lionfish in the attached reference sheet, for a game.
Same design as the reference (shape, spines, pectoral fans, bands, head tentacles, eye,
colours), redrawn as clean pixel art on a strict grid. 2 frames of the same animal,
side by side, left to right: "rest", "strike".

THE GRID (most important)
- Each frame is exactly 176 × 160 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block dark outline («outline hex») round the whole silhouette, never thicker.

COMPOSITION
- Strict side view, facing RIGHT, body straight and horizontal.
- From the tail tip to the mouth the animal is 128 art pixels long.
- The body is centred vertically: its midline, tail stalk to mouth, lies along the
  frame's horizontal centre line.
- Every spine and fin ray is at least 2 art pixels thick.
- Everything fits inside the frame with at least 4 art pixels of margin, in both
  frames: leave room above for the raised spines.
- Background: flat pure green #00FF00, one colour, nothing else. Do not use green
  anywhere on the animal, and do not let the outline pick up a green tint where it
  meets the background.

PALETTE
Use these colours, plus at most 8 in-between shades of them: «the Stage A palette».
Light comes from above and slightly in front: lit top, darker belly. Each part shaded
as its own rounded form.

LIGHTS
None: the eye is flat pixels, with no glow, bloom or light spill.

FRAME 1 — "rest"
The fish at rest: the dorsal spines swept back low along the back, the pectoral fans
half folded back along the sides.

FRAME 2 — "strike"
Identical to frame 1 in every pixel except the dorsal spines and the pectoral fans:
the spines raised straight up and fanned apart, each standing on its own; the pectoral
fans spread wide open, forward and out, like a threat display. The body, head and tail
do not move. Same frame size, same position, same everything else, so the two can be
swapped without the animal moving.

AVOID
Three-quarter or front views, any background other than flat #00FF00, soft glows,
painterly texture, noise, sub-pixel detail, text, labels, borders, shadows, a second
animal, any spine or shot drawn flying off the fish.
```

---

## 4. Moon Jelly — drifter: rest

### Stage A

```text
STYLE (shared by every image)
Reference sheet for a game creature: a moon jellyfish, Aurelia aurita. Match the
attached sheets: dark navy water, side-on, the look of dark underwater pixel art.
Exactly one creature, nothing else in the frame: no rock, no plants, no bubbles, no
particles, no text except where asked. Strict side view, the bell turned to swim
RIGHT: its dome points to the right, its rim and opening face left, and everything
that hangs from it trails out to the left, straight and level. The whole animal fits
in the frame with a margin around it. Output as a large lossless PNG, at least 2048 px
wide.

ANATOMY (must be accurate)
- The bell: a wide, shallow saucer dome, much wider across its rim than it is deep,
  clear as glass: dark inside with the water showing through, its outer surface and
  its rim edged in pale light.
- Inside the bell, seen through it: the four horseshoe-shaped gonads, the moon jelly's
  mark, two of them showing side-on as bright violet-pink arcs near the top of the
  dome.
- Round the whole rim, a fringe of many short, fine tentacles, trailing back.
- From the middle of the bell's underside, four frilly oral arms, short and ruffled,
  trailing back past the tentacles.
Colours: the bell glass a cold pale blue-violet over the dark water; the gonads a
bright violet-pink, the brightest colour on it; the tentacles and oral arms pale
violet-white.

IMAGE 1 — "in game"
The animal fully rendered in the attached sheets' style, on a flat solid dark navy
background (#082039). Any light on it is small and tight, no halo.

IMAGE 2 — "flat"
The same animal, same pose, same outline, flat colour only: no shading, no highlights,
no glow, no outline stroke, no texture. Each region one solid colour. Flat white
background.

IMAGE 3 — "parts"
The same animal taken apart, like a technical exploded diagram: each part drawn
separately with a clear gap, in its original position and orientation, pulled slightly
outward, each with a small plain label (bell, gonads, rim tentacles, oral arms). Flat
white background.

IMAGE 4 — "palette"
A single row of 6–8 large square colour swatches taken from image 1, each with its hex
code under it: outline, deep shadow, bell glass, rim light, gonad, gonad highlight,
tentacle, oral arm.

AVOID
Three-quarter, top or bottom views, a bell seen from below as a circle, a tilted or
bobbing pose, several animals, a scene, smooth gradients, big soft bloom or halos,
depth of field, watermarks, frames, borders, long trailing stinging tentacles (those
belong to other jellies).
```

### Stage B

```text
GOAL
True pixel-art sprite of the moon jelly in the attached reference sheet, for a game.
Same design as the reference (bell, gonads, rim tentacles, oral arms, colours), redrawn
as clean pixel art on a strict grid. ONE frame: "rest".

THE GRID (most important)
- The frame is exactly 144 × 112 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block dark outline («outline hex») round the whole silhouette, never thicker.

COMPOSITION
- Strict side view: the dome points RIGHT, the rim and opening face left, the
  tentacles and oral arms trail straight back to the left.
- From the top of the dome to the tips of the oral arms the animal is 112 art pixels
  long.
- The jelly is centred vertically: the line from the top of the dome back through the
  middle of the oral arms lies along the frame's horizontal centre line.
- The rim tentacles are at least 2 art pixels thick where they leave the rim.
- Everything fits inside the frame with at least 4 art pixels of margin.
- Background: flat pure green #00FF00, one colour, nothing else. Do not use green
  anywhere on the animal, and do not let the outline pick up a green tint where it
  meets the background.

PALETTE
Use these colours, plus at most 8 in-between shades of them: «the Stage A palette».
The bell is clear: draw its inside close to the dark navy water (#082039) with only its
surface and rim bright, so it reads as glass on a dark background. Light comes from
above and slightly in front.

LIGHTS
The gonads are flat bright pixels. NO glow halo, bloom or light spill, on the animal or
on the background. The game adds the glow itself.

FRAME 1 — "rest"
The jelly at rest, as in the reference.

AVOID
Three-quarter, top or bottom views, any background other than flat #00FF00, soft
glows, painterly texture, noise, sub-pixel detail, text, labels, borders, shadows, a
second animal, a tilted bell.
```
