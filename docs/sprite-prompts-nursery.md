# Sprite prompts: the nursery

The two prompts for each nursery enemy, filled in from
[sprites.md](sprites.md#the-art-side), the one in hand first. The archerfish is done. The
mackerel, the pufferfish and the sea nettle each change their look when they turn at half
health, and are drawn with a wounded pair beside the rest
([Frames by role](sprites.md#frames-by-role)); their prompts come here as each is picked.

**Attach every time:** `docs/media/reference/cave-room.webp` and `tank-room.webp` for the world,
and `barracuda.webp` and `triggerfish.webp` for finished animals. For Stage B, attach the chosen
Stage A sheet as well.

**Fill in the palette** in Stage B from the swatches of the Stage A sheet you choose.

---

## Mackerel — charger, pack: rest, strike (jaw), wounded, wounded strike

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
