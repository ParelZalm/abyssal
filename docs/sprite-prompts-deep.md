# Sprite prompts: the deep

The prompts for the deep tank's enemies, filled in from [sprites.md](sprites.md#the-art-side).
The anglerfish, gulper eel, barracuda and siphonophore came before these pages and their
prompts are in their entries' history; the vampire squid is here.

**Attach every time:** `docs/media/reference/cave-room.webp` and `tank-room.webp` for the world,
and `angler.webp` and `gulper.webp` for finished animals of the deep. For Stage B, attach the
chosen Stage A sheet as well.

**Fill in the palette** in Stage B from the swatches of the Stage A sheet you choose.

---

## Vampire Squid — spitter: rest, strike (light organs), and one arm — done

A squid's arms are not in its picture: the game draws each as a strip of its own that curls
out from the crown and reaches and grabs (`armRig`, `FishView.poseArms`). So there are **two
Stage B sheets**: the body without its arms, and one arm, which the rig draws eight times
(`SpriteArt.arm`).

**Facing:** as every squid plan in the game, the arms point forward (RIGHT) and the mantle and
fins trail behind (left).

**On green:** it is crimson and near-black, which magenta bleed cannot be told from.

**The strike** is a spitter's tell: the two big light organs behind its fins open and light. The
arm tips glow on the arm sheet. The game adds every glow itself.

### Stage A

```text
STYLE (shared by every image)
Reference sheet for a game creature: a vampire squid, Vampyroteuthis infernalis. Match
the attached sheets: dark navy water, side-on, the look of dark underwater pixel art.
Exactly one creature, nothing else in the frame: no rock, no plants, no bubbles, no
particles, no text except where asked. Strict lateral profile, facing RIGHT: the arms
reach forward to the right, the mantle and fins trail behind to the left, the body
straight and horizontal. The whole animal fits in the frame with a margin around it.
Output as a large lossless PNG, at least 2048 px wide.

ANATOMY (must be accurate)
- Mantle: a soft, rounded, gelatinous body, short and plump, about twice as long as it
  is deep, velvety in texture.
- Fins: one pair of large rounded ear-like fins near the back of the mantle, standing up
  and down from it like flaps.
- Light organs: one large round photophore just behind the base of each fin, with a
  lid of skin over it; small pale photophores scattered over the mantle.
- Head: short, with two very large round eyes, the biggest part of the head, set just
  behind where the arms begin.
- Arms: eight arms of equal length reaching forward, joined for most of their length by
  a dark webbed cloak between them, each arm lined along its inner side with a row of
  soft fleshy spines (cirri); each arm tip bare, ending in a small pale light organ. Two
  thin threadlike filaments tucked among the arms, a little longer than them.
Colours: the mantle and arms a deep velvety crimson-black, the web darkest; the fins the
same with a slightly redder edge; the eyes a clear pale blue with a dark pupil; the
cirri a dull rose; the arm-tip and fin-base light organs a cold pale blue-white.

IMAGE 1 — "in game"
The animal fully rendered in the attached sheets' style, on a flat solid background of
the deep tank's water (#0b1530), the arms reaching forward slightly spread so each one
reads. Any light on it is small and tight, no halo.

IMAGE 2 — "flat"
The same animal, same pose, same outline, flat colour only: no shading, no highlights,
no glow, no outline stroke, no texture. Each region one solid colour. Flat white
background.

IMAGE 3 — "parts"
The same animal taken apart, like a technical exploded diagram: each part drawn
separately with a clear gap, in its original position and orientation, pulled slightly
outward, each with a small plain label (mantle, fins, fin light organs, head, eyes, arm
crown, arms, web, cirri, arm-tip lights, filaments). Flat white background.

IMAGE 4 — "body and one arm"
Two things on the same water, side by side: the body with every arm removed, cut flush
at the arm crown just in front of the eyes, so it ends in a short rounded stump where
the arms leave; and one single arm laid out straight and level, its root on the left,
its tip on the right, with its strip of web along one edge, its row of cirri along the
other and its light organ at the tip.

IMAGE 5 — "palette"
A single row of 6–8 large square colour swatches taken from image 1, each with its hex
code under it: outline, deep shadow, body crimson, body highlight, web, cirri, eye,
light organ.

AVOID
Three-quarter or front views, a bell-shaped octopus pose, arms curling over the mantle,
curved or bent bodies, several animals, a scene, smooth gradients, big soft bloom or
halos, depth of field, watermarks, frames, borders, a bright red cartoon squid, suckers
on the arms.
```

### Stage B, sheet 1: the body

```text
GOAL
True pixel-art sprite of the vampire squid's body in the attached reference sheet, for
a game, WITHOUT its arms, as in the reference's "body and one arm" image. Same design
(mantle, fins, eyes, light organs, colours), redrawn as clean pixel art on a strict
grid. 2 frames of the same body, side by side, left to right: "rest", "strike".

THE GRID (most important)
- Each frame is exactly 160 × 96 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block dark outline («outline hex») round the whole silhouette, never thicker.

COMPOSITION
- Strict side view, facing RIGHT: the arm crown's stump at the right, the mantle and
  fins to the left. Body straight and horizontal, fins spread up and down.
- From the back of the mantle to the arm crown the body is 128 art pixels long.
- The body is centred vertically: its midline, mantle tip to arm crown, lies along the
  frame's horizontal centre line.
- Everything fits inside the frame with at least 4 art pixels of margin, in both frames.
- Background: flat pure green #00FF00, one colour, nothing else. Do not use green
  anywhere on the animal, and do not let the outline pick up a green tint where it
  meets the background.

PALETTE
Use these colours, plus at most 8 in-between shades of them: «the Stage A palette».
Light comes from above and slightly in front: lit top, darker belly. Each part shaded
as its own rounded form. The body is very dark: keep its edges and the tops of the
mantle and fins lit enough to read against dark water.

LIGHTS
Eyes and light organs are flat bright pixels. NO glow halo, bloom or light spill, on
the animal or on the background. The game adds the glow itself.

FRAME 1 — "rest"
The body at rest, as in the reference, the lids over the two fin-base light organs
half closed so only a sliver of each shows.

FRAME 2 — "strike"
Identical to frame 1 in every pixel except the two light organs behind the fins: the
lids drawn fully back and each organ wide open, a bright round disc of pale
blue-white. Same frame size, same position, same everything else, so the two can be
swapped without the animal moving.

AVOID
Three-quarter or front views, any arms or arm stubs longer than the crown, any
background other than flat #00FF00, soft glows, painterly texture, noise, sub-pixel
detail, text, labels, borders, shadows, a second animal.
```

### Stage B, sheet 2: one arm

```text
GOAL
True pixel-art sprite of ONE arm of the vampire squid in the attached reference sheet,
for a game, as in the reference's "body and one arm" image. Same design and colours,
redrawn as clean pixel art on a strict grid. ONE frame. The game draws this one arm
eight times, bending each.

THE GRID (most important)
- The frame is exactly 160 × 32 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block dark outline («outline hex») round the whole silhouette, never thicker.

COMPOSITION
- The arm laid out perfectly straight and level: its root at the left, cut flat
  where it leaves the crown, its tip at the right.
- From root to tip the arm is 144 art pixels long. At the root it is 12 art pixels
  thick, web included; it tapers evenly to 4 at the tip.
- Its midline lies along the frame's horizontal centre line.
- The web runs as a thin dark flap along its top edge, narrowing toward the tip and
  ending before it; the cirri are a row of short soft spines along its bottom edge,
  each at least 2 art pixels thick; the light organ is a small pale disc at the very
  tip.
- Everything fits inside the frame with at least 4 art pixels of margin.
- Background: flat pure green #00FF00, one colour, nothing else. Do not use green
  anywhere on the arm, and do not let the outline pick up a green tint where it meets
  the background.

PALETTE
The same colours as the body: «the Stage A palette», plus at most 8 in-between shades.
Lit along its top edge, darker below.

LIGHTS
The tip's light organ is flat bright pixels. NO glow halo, bloom or light spill. The
game adds the glow itself.

AVOID
A curled, bent or coiled arm, suckers, several arms, the body, any background other
than flat #00FF00, soft glows, painterly texture, noise, sub-pixel detail, text,
labels, borders, shadows.
```

### Import

```bash
npm run sprite -- docs/media/reference/vampiresquid-sprite.png --id vampiresquid --key green --fringe --keep '47,17,73,39;47,55,73,79'
npm run sprite -- docs/media/reference/vampiresquid-arm-sprite.png --id vampiresquid-arm --key green --fringe --pitch 8.6
```

As it went: the strike's light organs open inside the silhouette, so the outline found nothing
that moved, and each organ is kept in a box of its own (`--keep` takes several, split by `;`):
one box round both swapped the body between them. The arm sheet was drawn at 8.6 image pixels
to the art pixel, which the pitch search missed. The arm's landmarks are set by hand: its root
and tip across, the row its flesh runs along, the crown on the body, how far apart the roots
sit there and how long an arm is drawn (`SpriteArt.arm`).
