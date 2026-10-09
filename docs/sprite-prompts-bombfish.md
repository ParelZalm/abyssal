# Sprite prompts: the bomb fish

The bomb fish (`CONTEXT.md`) is the one pickup that is an animal, and it is still a 12 × 10
pixel map painted in code (`SPRITES.bomb` in `render/pickups.ts`). Lying loose it passes as a
token; lit in the water and drawn at twice the size, it is a flat slate blob beside the drawn
enemies and the drawn larva. It is redrawn here as one of the game's fish.

**The design, decided before asking:**

- **The player's kin, not the reef's.** It is the player's tool, so it reads as the pale glass
  of the larva (`larva.webp`): cool, clear, lit from inside. It must never be mistaken for the
  reef's hostile pufferfish (`pufferfish.webp`), which is ochre and spotted with brown — so no
  ochre, no brown, no spots.
- **Isaac's bomb in a fish.** Round, small, a dark band or two round it like a bomb's casing,
  and one long spine standing up from its back whose tip is a lit coral spark: the fuse.
- **It blows up over its fuse.** Lit, it is drawn in three frames — calm, half blown, fully blown
  with every spine out — swapped as the fuse burns, where the game now scales one picture.
  The red blinking of its last moments is the game's, a tint over the frames.

**Attach every time:** `docs/media/reference/larva.webp` (the look it belongs to),
`pufferfish.webp` (what it must not look like), `angler.webp` (a finished animal) and
`cave-room.webp` (the world). For Stage B, attach the Stage A images you chose too.

**These go on green, not magenta.** The spark is coral and the game blinks the fish red, and a
magenta fringe on either cannot be told from paint. Nothing on it is green.

---

## Stage A — the reference sheet (design)

Three images, each generated separately, the shared `STYLE` block first.

```text
STYLE (shared by every image)
Reference sheet for a game creature: a small pufferfish that is used as a bomb, in a
pixel-art underwater roguelite in the spirit of The Binding of Isaac.
Match the attached larva sheet: the same family of pale, glassy, cool-coloured fish, lit
softly from inside, with a clean dark outline. It must look NOTHING like the attached
pufferfish sheet: no ochre, no brown, no tan, no spots. Exactly one creature, nothing
else in the frame: no rock, no plants, no bubbles, no particles, no text except where
asked. Strict lateral profile, facing RIGHT, body horizontal. Fins spread so their
outline reads. The whole animal fits in the frame with a margin around it. Output as a
large lossless PNG, at least 2048 px wide.

ANATOMY (must be accurate)
A small, nearly round pufferfish (a sharpnose puffer, Canthigaster, for the build): a
round body barely longer than it is tall, a short tail stalk and a small rounded fan of a
tail; a blunt head with a small beaked mouth; one large round eye, pale ring and black
pupil with a single white glint, like the larva's; a small fan pectoral fin behind the
eye. The body is pale glassy slate-blue to ice-white, lightest on the belly, with two
dark navy bands wrapped round it (one behind the eye, one before the tail), like the
bands on a bomb's casing. From the middle of its back stands ONE long, slightly curved
spine, about half the body's height, much longer than any other: its tip is a small
bright coral-orange spark — a photophore, the fuse. The rest of its spines lie flat and
are only short pale points along the outline.

IMAGE 1 — "calm"
The animal fully rendered in the larva sheet's style, deflated, on a flat solid
background of #071731. The fuse's spark is lit with only a small, tight halo.

IMAGE 2 — "blown"
The same animal fully inflated: a near-perfect ball about one and a half times as tall
as in image 1, every short spine standing straight out all round it, the bands
stretched round the ball, the eye, tail, pectoral and the long fuse spine the same and
in the same places, the spark brighter. Same water.

IMAGE 3 — "palette"
A single row of 7–8 large square colour swatches taken from image 1, each with its hex
code under it: outline, deep shadow, body, highlight, belly, band, spark, eye.

AVOID
Ochre, brown, tan, yellow or any spots (that is the reef's pufferfish), a cartoon bomb
with a rope fuse, three-quarter or front views, a dynamic swimming pose, several
animals, a scene, smooth gradients, big soft bloom or halos, depth of field, watermarks,
frames, borders.
```

---

## Stage B — the sprite sheet (production)

Four frames on one strip: the token it is as a pickup and on the HUD, then the three it is lit.
Every frame is the same size and the fish is centred on the same point in each, so the game
swaps them without the fish moving. Fill in the palette from the Stage A palette you chose.

```text
GOAL
True pixel-art sprite of the bomb-fish pufferfish in the attached reference sheet, for
a game. Same design as the reference (round body, two dark bands, one long spine whose
tip is a coral spark, big eye, small fan tail, colours), redrawn as clean pixel art on a
strict grid. 4 frames of the same animal, side by side, left to right: "token", "calm",
"swelling", "blown".

THE GRID (most important)
- Each frame is exactly 32 × 32 art pixels, with no gap between frames: the strip is
  128 × 32 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block: 1024 × 256 px.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block dark outline («outline hex») round the whole silhouette, never thicker.

COMPOSITION
- Strict side view, facing RIGHT. In every frame the body's centre sits on the frame's
  centre, at art pixel (16, 18), so the frames can be swapped without the fish moving.
- The long fuse spine stands straight up from the middle of the back, 4 art pixels long
  in every frame, and its spark on top of it is 2 × 2 art pixels.
- The other spines are at least 1 art pixel wide and 2 long; the fuse spine is 2 wide.
- Everything fits inside its frame with at least 2 art pixels of margin.
- Background: flat pure green #00FF00, one colour, nothing else. Do not use green
  anywhere on the animal, and do not let the outline pick up a tint of it.

PALETTE
Use these colours, plus at most 6 in-between shades of them: «the Stage A palette».
Light from above and slightly in front: lit top, darker underside, the body shaded as
one rounded form, a single small highlight on the upper front of the body.

LIGHTS
The spark and the eye's glint are flat bright pixels. NO glow halo, bloom or light
spill, on the fish or on the background. The game adds the glow itself.

FRAME 1 — "token"
The fish small, as a pickup and an icon: about 12 art pixels from tail tip to snout and
10 tall including the fuse spine, deflated, drawn with as few pixels as reads — the
round body, one band, the eye, the fan tail, the spine and its spark. Centred like the
others; the rest of the frame is background.

FRAME 2 — "calm"
The fish deflated, as in image 1: about 22 art pixels from tail tip to snout and 14
tall without the fuse spine.

FRAME 3 — "swelling"
The same fish half blown: the body rounder and about 16 tall, the short spines starting
to stand out from the outline, the bands stretched, the eye, tail and fuse the same
size and on the same places of the body.

FRAME 4 — "blown"
The fish fully blown, as in image 2: a ball about 18 across, every short spine standing
2 art pixels straight out all round it (22 across with them), the tail and the pectoral
small against the ball, the fuse spine still standing from the top with its spark.

AVOID
Ochre, brown, tan or spots, a rope fuse, a halo or glow round the spark, a shadow under
the fish, anything else in a frame, frames of different sizes, the fish drifting off
the centre between frames.
```

---

## Once it is back

The strip is cut into its four frames and keyed off green. The token replaces `SPRITES.bomb`
(the pickup lying loose and the HUD's counter); `BombView` draws the lit fish from the other
three in place of `SWELL`'s scaling — calm, then swelling, then blown in the last third of the
fuse — with its red blink still the game's tint. The board's *Shop & deals* has both cells to
judge it by.
