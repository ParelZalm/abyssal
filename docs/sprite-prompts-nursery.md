# Sprite prompts: the nursery

The two prompts for the nursery's next enemy, filled in from
[sprites.md](sprites.md#the-art-side). The archerfish is the only nursery enemy ready: the
mackerel, the pufferfish and the sea nettle each change their look when wounded, and wait on
a third frame the code does not take yet ([roadmap](roadmap-enemies-rework.md#blocked-on)).
Their prompts come here once it does.

**Attach every time:** `docs/media/reference/cave-room.webp` and `tank-room.webp` for the world,
and `barracuda.webp` and `triggerfish.webp` for finished animals. For Stage B, attach the chosen
Stage A sheet as well.

**This one goes on magenta.** It is gold and blue, with nothing violet, pink or red in it, and
green bled into a gold body would turn it yellow-green.

**Fill in the palette** in Stage B from the swatches of the Stage A sheet you choose.

---

## Archerfish — spitter, volley: rest, strike (mouth)

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
