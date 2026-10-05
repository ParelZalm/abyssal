# Sprite prompts: the nursery

The two prompts for each nursery enemy, filled in from
[sprites.md](sprites.md#the-art-side), the one in hand first. All four are done: the nursery is
through. The last three change their look when they turn at half health, and are drawn with a
wounded frame or pair beside the rest ([Frames by role](sprites.md#frames-by-role)).

**Attach every time:** `docs/media/reference/cave-room.webp` and `tank-room.webp` for the world,
and `barracuda.webp` and `triggerfish.webp` for finished animals. For Stage B, attach the chosen
Stage A sheet as well.

**Fill in the palette** in Stage B from the swatches of the Stage A sheet you choose.

---

## Sea Nettle — drifter, bloom: rest, wounded — done

It swims in pulses, a surge at the player and a coast, and wherever it goes it leaves its
tentacles in the water: a sting every fifth of a second that hangs and sinks. At half health it
glows hotter and pulses faster, and dead it buds into two ephyrae, half its size, which the room
waits on (`bloom` in `sim/roles.ts`). A drifter has no strike, so it is two frames: the rest and
the wounded, the bell lit hot.

**The game moves the parts** as it does the moon jelly's: the bell alone squeezes on the pulse
(`bells`) and a wave runs down what trails behind it (`trail`), each a box across the picture.
So the bell and the tentacles are asked for side by side, the bell's rim a clean line with
everything that hangs from it behind, and the tentacles long and loose rather than tangled. The
glow round it is the game's (`lights`, set on the import); the frames are flat colour.

**This one goes on green** (`--key green`). It is orange, red and maroon, which magenta bleed
cannot be told from.

**Stage A has a fifth image**, the turned bell lit from within, and a second row of swatches
for it, since every colour on it warms.

### Stage A

```text
STYLE (shared by every image)
Reference sheet for a game creature: a Pacific sea nettle, Chrysaora fuscescens. Match
the attached sheets: dark navy water, side-on, the look of dark underwater pixel art.
Exactly one creature, nothing else in the frame: no rock, no plants, no bubbles, no
particles, no text except where asked. Strict side view, the bell turned to swim RIGHT:
its dome points to the right, its rim and opening face left, and everything that hangs
from it trails out to the left, long and loose and nearly level. The whole animal fits
in the frame with a margin around it. Output as a large lossless PNG, at least 2048 px
wide.

ANATOMY (must be accurate)
- The bell: a rounded dome, a little deeper than a moon jelly's, about as deep as it is
  wide, translucent: the water shows dimly through it, its outer surface and its
  scalloped rim edged in light. Sixteen narrow stripes run from the top of the dome down
  to the rim, ending in the rim's scallops.
- From the rim, a fringe of twenty-four long, thin tentacles, trailing back to the left
  two to three times the bell's length, each a separate loose line, gently waving, not
  tangled or knotted.
- From the middle of the bell's underside, four long oral arms, broad ruffled ribbons
  that spiral loosely, trailing back between the tentacles, a little shorter than them.
Colours: the bell glass a warm golden amber over the dark water, its stripes a deep
rust red; the rim's edge pale gold; the tentacles dark maroon; the oral arms a pale
cream-white, the brightest thing on it after the rim.

IMAGE 1 — "in game"
The animal fully rendered in the attached sheets' style, on a flat solid background of
the nursery's water (#071731). Any light on it is small and tight, no halo.

IMAGE 2 — "flat"
The same animal, same pose, same outline, flat colour only: no shading, no highlights,
no glow, no outline stroke, no texture. Each region one solid colour. Flat white
background.

IMAGE 3 — "parts"
The same animal taken apart, like a technical exploded diagram: each part drawn
separately with a clear gap, in its original position and orientation, pulled slightly
outward, each with a small plain label (bell, stripes, rim, tentacles, oral arms). Flat
white background.

IMAGE 4 — "turned"
The same animal, same pose and same outline as image 1, on the same water, glowing hot
from within: the bell's glass a bright fiery orange-gold lit through, the stripes vivid
scarlet, the rim's edge near white-gold; the tentacles a hot red; the oral arms a warm
glowing peach. Lit from inside, not with a halo round it: the water around it stays
dark.

IMAGE 5 — "palette"
Two rows of 6–8 large square colour swatches, each with its hex code under it. The top
row from image 1: outline, deep shadow, bell glass, rim light, stripe, tentacle, oral
arm, oral arm highlight. The bottom row from image 4: the same roles in the hot colours.

AVOID
Three-quarter, top or bottom views, a bell seen from below as a circle, a tilted or
bobbing pose, tentacles curling forward past the bell or tangled into a knot, several
animals, a scene, smooth gradients, big soft bloom or halos, depth of field, watermarks,
frames, borders, a moon jelly's flat saucer, a lion's mane jelly's mass of hair.
```

### Stage B

```text
GOAL
True pixel-art sprite of the sea nettle in the attached reference sheet, for a game.
Same design as the reference (bell, stripes, rim, tentacles, oral arms, colours),
redrawn as clean pixel art on a strict grid. 2 frames of the same animal, side by side,
left to right: "rest", "wounded".

THE GRID (most important)
- Each frame is exactly 176 × 104 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block dark outline («outline hex») round the whole silhouette, never thicker.

COMPOSITION
- Strict side view: the dome points RIGHT, the rim and opening face left, the tentacles
  and oral arms trail back to the left, long and nearly level.
- From the top of the dome to the tips of the tentacles the animal is 152 art pixels
  long; the bell is the right-hand quarter of it.
- The jelly is centred vertically: the line from the top of the dome back through the
  middle of the oral arms lies along the frame's horizontal centre line.
- The bell's rim is a clean line, and nothing that hangs from it reaches forward past
  it: the bell on the right, everything that trails on the left.
- Tentacles are at least 2 art pixels thick along their whole length, each its own line
  with water between them; the oral arms broader.
- Everything fits inside the frame with at least 4 art pixels of margin, in both frames.
- Background: flat pure green #00FF00, one colour, nothing else. Do not use green
  anywhere on the animal, and do not let the outline pick up a green tint where it
  meets the background.

PALETTE
Frame 1: these colours, plus at most 8 in-between shades of them: «the top row of the
Stage A palette». Frame 2: «the bottom row», plus at most 8 in-between shades. The bell
is clear: in frame 1 draw its inside close to the dark navy water (#071731) with only its
surface, stripes and rim bright, so it reads as glass on a dark background; in frame 2 it
is lit through. Light comes from above and slightly in front.

LIGHTS
NO glow halo, bloom or light spill, on the animal or on the background, in either
frame. The game adds the glow itself.

FRAME 1 — "rest"
The jelly at rest, as in the reference.

FRAME 2 — "wounded"
The same jelly glowing hot, as in the reference's "turned" image, in the hot palette.
Identical to frame 1 in outline and in every part's place, the tentacles and oral arms
exactly where they are in frame 1: only the colours change. Same frame size, same
position, so the two can be swapped without the animal moving.

AVOID
Three-quarter, top or bottom views, any background other than flat #00FF00, soft
glows, painterly texture, noise, sub-pixel detail, text, labels, borders, shadows, a
second animal, a tilted bell, tentacles that differ between the frames.
```

### Import

```bash
npm run sprite -- docs/media/reference/nettle-sprite.png --id nettle --key green --fringe --frames rest,wounded
```

The two frames are a drifter's, named, since two frames would otherwise be read as a rest and a
strike. Then set by hand, as the moon jelly's were: `bells` across the bell with no jets (a
nettle rows), `trail` from the rim back to the tentacles' tips, `lights` on the bell, and a
hull of the bell and the top of the trail, since the tentacles are what stings.

As it went: the sheet came with the rest alone. Its wounded is only its colours, so it was made
from the rest, recoloured through the Stage A palette's two rows (`--wounded-palette`), which
cannot drift off the rest as a redrawn frame can. The sheet was drawn at 7.5 image pixels to
the art pixel (`--pitch 7.5`). The tentacles came out maroon, nearly the outline's dark: at the
game's density they read in the rest as a dark veil behind the bell, and red only once it
turns.

---

## Pufferfish — turret, balloon: rest, strike (mouth), wounded, wounded strike — done

It holds its spot and fires a ring of spines on the beat; up close it puffs and is braced
against every blow, then goes slack, which is the opening. At half health it turns: it blows
up for good with its spines raised, leaves its spot and bounces round the room on a diagonal,
throwing a fan of spines off every wall, and dead it pops into a ring (`balloon` in
`sim/roles.ts`).

**The game does the puffing.** A puff is a swell of the whole picture (`FishView.swell`, up to
half again its size), so the rest and the strike are drawn deflated, and the strike is only
the beak opening for the ring. The turned look is drawn blown up, round with every spine
standing: the game swells that too while it bounces, and a slim fish with spines out, scaled
up, did not read as a puffed one.

**The animal is a porcupinefish**, Diodon holocanthus: a spiny pufferfish, whose long spines
lie flat until it inflates, which is the turn exactly. A true puffer has only prickles.

**This one goes on magenta.** It is ochre and brown with nothing violet, pink or red in it, and
green bled into ochre would turn it olive.

**Stage A has a fifth image**, the turned look, blown up. It keeps the animal's colours, so
the palette is one row.

### Stage A

```text
STYLE (shared by every image)
Reference sheet for a game creature: a long-spine porcupinefish, Diodon holocanthus, a
spiny pufferfish. Match the attached sheets: dark navy water, side-on, the look of dark
underwater pixel art. Exactly one creature, nothing else in the frame: no rock, no
plants, no bubbles, no particles, no text except where asked. Strict lateral profile,
facing RIGHT, body straight and horizontal, not curved or swimming. Every fin spread
open so its outline reads. The whole animal fits in the frame with a margin around it.
Output as a large lossless PNG, at least 2048 px wide.

ANATOMY (must be accurate)
Deflated: a blunt, heavy, slightly boxy body about two fifths as deep as it is long,
widest at the head and tapering to a short tail stalk.
- Head: big and rounded, a short blunt snout ending in a small mouth with a fused,
  parrot-like beak, two pale tooth plates showing as a line. A very large round eye set
  high and forward, bulging out of the head's outline.
- Long sharp spines all over the head and body, lying flat against the skin, pointing
  back, each a thin pale line; longest on the forehead and the flanks.
- No fins on the back but a single small rounded dorsal fin set far back, mirrored by a
  small rounded anal fin under it; a broad rounded pectoral fin behind the gill opening;
  no pelvic fins.
- A rounded fan-shaped tail fin.
Colours: the back and flanks warm ochre to tan, the belly cream-white; dark brown blotches
across the back and a band through the eye, and small round brown spots over the flanks
and fins; the spines pale cream with darker tips; the fins translucent amber with brown
spots; the eye a golden ring round a dark pupil.

IMAGE 1 — "in game"
The animal fully rendered in the attached sheets' style, on a flat solid background of
the nursery's water (#071731). Any light on it is small and tight, no halo.

IMAGE 2 — "flat"
The same animal, same pose, same outline, flat colour only: no shading, no highlights,
no glow, no outline stroke, no texture. Each region one solid colour. Flat white
background.

IMAGE 3 — "parts"
The same animal taken apart, like a technical exploded diagram: each part drawn
separately with a clear gap, in its original position and orientation, pulled slightly
outward, each with a small plain label (head and beak, eye, body, spines, blotches,
dorsal fin, anal fin, pectoral fin, tail fin). Flat white background.

IMAGE 4 — "turned"
The same animal fully inflated, on the same water: the body blown up into a near-perfect
ball, the skin stretched so the blotches and spots are spread apart and paler and the
cream belly fills the lower half; every spine standing straight out from the ball,
evenly all round like a burr; the head, eye, beak, fins and tail fin the same size and
in the same places as in image 1, the beak still at the front and the tail fin still
behind, the tail stalk short between the ball and the fan.

IMAGE 5 — "palette"
A single row of 6–8 large square colour swatches taken from image 1, each with its hex
code under it: outline, deep shadow, ochre, ochre highlight, blotch, belly, spine, eye.

AVOID
Three-quarter or front views, curved or bent bodies, a dynamic swimming pose, several
animals, a scene, smooth gradients, big soft bloom or halos, depth of field, watermarks,
frames, borders, a smooth spineless puffer, a boxfish, a cartoon face.
```

### Stage B

```text
GOAL
True pixel-art sprite of the porcupinefish in the attached reference sheet, for a game.
Same design as the reference (shape, spines, beak, eye, blotches, fins, colours),
redrawn as clean pixel art on a strict grid. 4 frames of the same animal, side by side,
left to right: "rest", "strike", "wounded", "wounded strike".

THE GRID (most important)
- Each frame is exactly 144 × 112 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block dark outline («outline hex») round the whole silhouette, never thicker.

COMPOSITION
- Strict side view, facing RIGHT, body straight and horizontal. Fins spread.
- From the tail tip to the snout the animal is 112 art pixels long, in every frame: the
  inflated frames grow up and down, not longer.
- The body is centred vertically: its midline, tail stalk to snout, lies along the
  frame's horizontal centre line, in every frame, the ball of frames 3 and 4 included.
- Spines are at least 2 art pixels thick where they stand out from the body.
- Everything fits inside the frame with at least 4 art pixels of margin, in all four
  frames, the standing spines of frames 3 and 4 included.
- Background: flat pure magenta #FF00FF, one colour, nothing else. Do not use magenta
  anywhere on the animal, and do not let the outline pick up a magenta or violet tint
  where it meets the background.

PALETTE
Use these colours, plus at most 8 in-between shades of them, in every frame: «the Stage A
palette». Light comes from above and slightly in front: lit top, darker belly. Each part
shaded as its own rounded form; the ball of frames 3 and 4 as one sphere.

LIGHTS
None: the eye is flat pixels, with no glow, bloom or light spill.

FRAME 1 — "rest"
The fish deflated, as in the reference, the beak closed, the spines lying flat.

FRAME 2 — "strike"
Identical to frame 1 in every pixel except the beak: the mouth open in a small round O,
the two tooth plates parted, about to spit. Same frame size, same position, same
everything else, so the two can be swapped without the animal moving.

FRAME 3 — "wounded"
The same fish fully inflated, as in the reference's "turned" image: a ball with every
spine standing straight out, the skin stretched paler, the beak closed. The snout, the
eye, the tail fin and the fins in the same places as in frame 1, so the two can be
swapped without the animal moving; only the body between them is blown up.

FRAME 4 — "wounded strike"
Identical to frame 3 in every pixel except the beak, opened exactly as in frame 2.

AVOID
Three-quarter or front views, any background other than flat #FF00FF, soft glows,
painterly texture, noise, sub-pixel detail, text, labels, borders, shadows, a second
animal, the animal longer in the inflated frames, spines drawn as 1-pixel hairs.
```

### Import

```bash
npm run sprite -- docs/media/reference/pufferfish-sprite.png --id pufferfish --fringe
```

The four frames are found in order. The wounded frame is lined up on the rest by its outline,
which a ball shares less of than a flushed body does: check in the preview that the snout and
the tail fin of the two sit in the same places, and that each strike took the beak and nothing
behind the eye; if not, `--keep` the head's box, which holds for both strikes. The hull is the
deflated body, read off the rest, and the swell does not move it; the ball has a hull of its
own (`woundedHull`), set by hand off its skin, or a bounce is hit on the body inside it.

As it went: the sheet was drawn at 3.2 image pixels to the art pixel (`--pitch 3.2`), and the
ball shorter than the fish with its eye further back, so the wounded strike took its beak alone
(`--keep-wounded`).

---

## Mackerel — charger, pack: rest, strike (jaw), wounded, wounded strike — done

They come in pairs, circle the player, and dash at it one at a time; the strike frame is the
jaw open, shown from a third into the wind-up, so it is the dash's tell. At half health the
pack member turns: the whole body flushes red, its fins stand up, and a missed dash is chained
into a second (`pack` in `sim/roles.ts`). The flush is the wounded frame, and the wounded strike
keeps the open jaw as its tell once it has turned.

**This one goes on green** (`--key green`). Its turned frames are red, and magenta bled into red
cannot be told from paint. For the same reason its back is asked for steel blue rather than the
painted mackerel's sea green: green bleed hides in a green back as magenta's does in red.

**Stage A has a fifth image**, the turned look, so the flush and the raised fins are settled
before Stage B draws them, and a second row of swatches for it.

### Stage A

```text
STYLE (shared by every image)
Reference sheet for a game creature: an Atlantic mackerel, Scomber scombrus. Match the
attached sheets: dark navy water, side-on, the look of dark underwater pixel art.
Exactly one creature, nothing else in the frame: no rock, no plants, no bubbles, no
particles, no text except where asked. Strict lateral profile, facing RIGHT, body
straight and horizontal, not curved or swimming. Every fin spread open so its outline
reads. The whole animal fits in the frame with a margin around it. Output as a large
lossless PNG, at least 2048 px wide.

ANATOMY (must be accurate)
A long, torpedo-shaped body, about a fifth as deep as it is long, deepest just behind
the head and tapering to a very slender tail stalk.
- Head: long and pointed, about a quarter of the body; a large mouth reaching back to
  under the eye, the jaws closed in a straight line, the lower jaw a little longer. A
  large round eye, set high and well forward, with a clear fatty eyelid over its edge.
  A smooth gill cover behind it.
- Two dorsal fins set well apart: the first a triangle of thin spines that folds into a
  groove, the second small and soft, opposite the anal fin.
- Behind the second dorsal fin a row of five small separate finlets along the back to
  the tail; the same five finlets along the belly behind the anal fin.
- A short pointed pectoral fin high behind the gill cover; small pelvic fins under it.
- Two small keels on each side of the tail stalk; a deeply forked tail fin, its lobes
  long and narrow.
Colours: the back steel blue, deep and slightly metallic, crossed by 25–30 bold, black,
wavy bars that run down to the lateral line; below the line silver-white, with an
iridescent blue sheen where back and flank meet; the fins dusky blue-grey, the finlets
the same; the eye dark with a silver ring.

IMAGE 1 — "in game"
The animal fully rendered in the attached sheets' style, on a flat solid background of
the nursery's water (#071731). Any light on it is small and tight, no halo.

IMAGE 2 — "flat"
The same animal, same pose, same outline, flat colour only: no shading, no highlights,
no glow, no outline stroke, no texture. Each region one solid colour. Flat white
background.

IMAGE 3 — "parts"
The same animal taken apart, like a technical exploded diagram: each part drawn
separately with a clear gap, in its original position and orientation, pulled slightly
outward, each with a small plain label (head and jaws, eye, body, bars, first dorsal
fin, second dorsal fin, finlets, anal fin, pectoral fin, pelvic fins, tail keels, tail
fin). Flat white background.

IMAGE 4 — "turned"
The same animal enraged, same pose and same outline as image 1 except the fins, on the
same water: the whole body flushed blood red, deep crimson along the back fading to
rose at the belly; the wavy bars black-red, still clear; the fins and finlets dark red;
the first dorsal fin raised fully upright, its spines spread wide; the pectoral and
pelvic fins flared out; the mouth parted a little, a dark gap between the jaws.

IMAGE 5 — "palette"
Two rows of 6–8 large square colour swatches, each with its hex code under it. The top
row from image 1: outline, deep shadow, steel blue, blue highlight, bar, silver belly,
fin, eye. The bottom row from image 4: the same roles in the turned colours.

AVOID
Three-quarter or front views, curved or bent bodies, a dynamic swimming pose, several
animals, a school, a scene, smooth gradients, big soft bloom or halos, depth of field,
watermarks, frames, borders, a green back, a tuna's deep body or yellow finlets.
```

### Stage B

```text
GOAL
True pixel-art sprite of the mackerel in the attached reference sheet, for a game.
Same design as the reference (shape, fins, finlets, jaws, eye, bars, colours), redrawn
as clean pixel art on a strict grid. 4 frames of the same animal, side by side, left to
right: "rest", "strike", "wounded", "wounded strike".

THE GRID (most important)
- Each frame is exactly 160 × 80 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block dark outline («outline hex») round the whole silhouette, never thicker.

COMPOSITION
- Strict side view, facing RIGHT, body straight and horizontal. Fins spread.
- From the tail tip to the snout the animal is 136 art pixels long.
- The body is centred vertically: its midline, tail stalk to snout, lies along the
  frame's horizontal centre line.
- Fin spines, finlets and the tail's lobes are at least 2 art pixels thick; each finlet
  is its own small block with a gap before the next.
- Everything fits inside the frame with at least 4 art pixels of margin, in all four
  frames, the raised dorsal fin of frames 3 and 4 included.
- Background: flat pure green #00FF00, one colour, nothing else. Do not use green
  anywhere on the animal, and do not let the outline pick up a green tint where it
  meets the background.

PALETTE
Frames 1 and 2: these colours, plus at most 8 in-between shades of them: «the top row
of the Stage A palette». Frames 3 and 4: «the bottom row», plus at most 8 in-between
shades. Light comes from above and slightly in front: lit top, darker belly. Each part
shaded as its own rounded form.

LIGHTS
None: the eye is flat pixels, with no glow, bloom or light spill.

FRAME 1 — "rest"
The fish at rest, as in the reference, the jaws closed, the first dorsal fin low.

FRAME 2 — "strike"
Identical to frame 1 in every pixel except the jaws: the mouth wide open for the bite,
the lower jaw dropped well down and the upper jaw pushed forward, the dark inside of the
mouth showing. Same frame size, same position, same everything else, so the two can be
swapped without the animal moving.

FRAME 3 — "wounded"
The same fish turned, as in the reference's "turned" image: the whole body flushed red
in the turned palette, the bars still in their places, the first dorsal fin raised
fully upright and spread, the pectoral and pelvic fins flared, the mouth parted a
little. Same frame size, same position, same outline and pose as frame 1 except the
fins, so the two can be swapped without the animal moving.

FRAME 4 — "wounded strike"
Identical to frame 3 in every pixel except the jaws, opened exactly as in frame 2.

AVOID
Three-quarter or front views, any background other than flat #00FF00, soft glows,
painterly texture, noise, sub-pixel detail, text, labels, borders, shadows, a second
animal, the body bent between frames.
```

### Import

```bash
npm run sprite -- docs/media/reference/mackerel-sprite.png --id mackerel --key green --fringe
```

The four frames are found in order. Check in the preview that the wounded frame was taken
whole and lined up on the rest, and that each strike took the jaws and nothing behind the gill
cover; if not, `--keep` the head's box, which holds for both strikes.

---

## Archerfish — spitter, volley: rest, strike (mouth) — done

**It went on magenta.** It is gold and blue, with nothing violet, pink or red in it, and
green bled into a gold body would turn it yellow-green.

It fires in bursts of three, and its strike frame is held through the whole burst, so the
open mouth is the tell for all three shots.

### Stage A

```text
STYLE (shared by every image)
Reference sheet for a game creature: an archerfish, Toxotes jaculatrix, in a golden
colour form. Match the attached sheets: dark navy water, side-on, the look of dark
underwater pixel art. Exactly one creature, nothing else in the frame: no rock, no
plants, no bubbles, no particles, no water jet, no text except where asked. Strict
lateral profile, facing RIGHT, body straight and horizontal, not curved or swimming.
Every fin spread open so its outline reads. The whole animal fits in the frame with a
margin around it. Output as a large lossless PNG, at least 2048 px wide.

ANATOMY (must be accurate)
A deep, flat-sided body, about half as deep as it is long, its back running almost
dead straight from the snout to the dorsal fin, its belly curved.
- Head: a pointed snout with a large upturned mouth, the lower jaw jutting past the
  upper. A very large eye set high and far forward, close to the snout, so it can look
  along the line it shoots.
- The dorsal fin and the anal fin both set far back, near the tail, the anal fin longer
  at its base; each with a few short spines in front of its soft rays.
- A small pectoral fin low behind the gill cover; a pair of small pelvic fins under the
  chest.
- A tail fin, slightly forked.
Colours: the body gold, deep amber along the back fading to pale gold at the belly, with
a fine scale pattern; four or five bold blackish bars and blotches across the back, from
behind the eye to the tail stalk, not reaching the belly; the dorsal and anal fins dark
at their base and edged in deep blue; the eye a ring of blue round a dark pupil.

IMAGE 1 — "in game"
The animal fully rendered in the attached sheets' style, on a flat solid background of
the nursery's water (#071731). Any light on it is small and tight, no halo.

IMAGE 2 — "flat"
The same animal, same pose, same outline, flat colour only: no shading, no highlights,
no glow, no outline stroke, no texture. Each region one solid colour. Flat white
background.

IMAGE 3 — "parts"
The same animal taken apart, like a technical exploded diagram: each part drawn
separately with a clear gap, in its original position and orientation, pulled slightly
outward, each with a small plain label (head and mouth, eye, body, bars, dorsal fin,
anal fin, pectoral fin, pelvic fins, tail fin). Flat white background.

IMAGE 4 — "palette"
A single row of 6–8 large square colour swatches taken from image 1, each with its hex
code under it: outline, deep shadow, gold, gold highlight, belly, bar, fin blue, eye.

AVOID
Three-quarter or front views, curved or bent bodies, a dynamic swimming pose, several
animals, a scene, smooth gradients, big soft bloom or halos, depth of field, watermarks,
frames, borders, a silver body, a jet of water.
```

### Stage B

```text
GOAL
True pixel-art sprite of the archerfish in the attached reference sheet, for a game.
Same design as the reference (shape, fins, mouth, eye, bars, colours), redrawn as clean
pixel art on a strict grid. 2 frames of the same animal, side by side, left to right:
"rest", "strike".

THE GRID (most important)
- Each frame is exactly 160 × 112 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block dark outline («outline hex») round the whole silhouette, never thicker.

COMPOSITION
- Strict side view, facing RIGHT, body straight and horizontal. Fins spread.
- From the tail tip to the snout the animal is 128 art pixels long.
- The body is centred vertically: its midline, tail stalk to snout, lies along the
  frame's horizontal centre line.
- Fin spines and rays are at least 2 art pixels thick.
- Everything fits inside the frame with at least 4 art pixels of margin, in both frames.
- Background: flat pure magenta #FF00FF, one colour, nothing else. Do not use magenta
  anywhere on the animal, and do not let the outline pick up a magenta or violet tint
  where it meets the background.

PALETTE
Use these colours, plus at most 8 in-between shades of them: «the Stage A palette».
Light comes from above and slightly in front: lit top, darker belly. Each part shaded
as its own rounded form.

LIGHTS
None: the eye is flat pixels, with no glow, bloom or light spill.

FRAME 1 — "rest"
The fish at rest, as in the reference, the mouth closed.

FRAME 2 — "strike"
Identical to frame 1 in every pixel except the mouth: the jaws open into a small round
barrel pointing forward and a little up, the lower jaw dropped and the lips pushed out,
about to shoot. Same frame size, same position, same everything else, so the two can be
swapped without the animal moving.

AVOID
Three-quarter or front views, any background other than flat #FF00FF, soft glows,
painterly texture, noise, sub-pixel detail, text, labels, borders, shadows, a second
animal, any water jet or drop drawn in the frame.
```
