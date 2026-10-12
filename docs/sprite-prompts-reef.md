# Sprite prompts: the reef

The prompts for each of the reef's enemies, filled in from
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

## ~~1. Ribbon Eel — charger: rest, strike (jaw)~~ — done

The prompts are in the history: `git show f75cf4f:docs/sprite-prompts-reef.md`.

---

## ~~2. Triggerfish — spitter: rest, strike (mouth)~~ — done

The prompts are in the history: `git show f75cf4f:docs/sprite-prompts-reef.md`.

---

## ~~3. Lionfish — turret: rest, strike (spines up)~~ — done

The prompts are in the history: `git show f75cf4f:docs/sprite-prompts-reef.md`.

---

## ~~4. Moon Jelly — drifter: rest~~ — done

The prompts are in the history: `git show f75cf4f:docs/sprite-prompts-reef.md`.

---

## ~~5. Caribbean Reef Octopus — rest, strike (the flash), and one arm~~ — done

An octopus's arms are not in its picture, as a squid's are not: the game draws each as a strip
of its own, plants it on the rock, walks it, and throws one at the player (`SpriteArt.arm`,
`FishView.poseArms`). So there are **two Stage B sheets**: the body without its arms, and one
arm, which the rig draws eight times.

**Every arm moves on its own.** An octopus's arms are not a fan swept as one: each feels ahead
across the rock with its tip, curls it up into a coil, steps, grips, or reaches out and
explores while the rest hold on. The game bends each arm's strip anywhere along its length and
curls its tip tight, so the one arm picture has to survive every bend:

- **No pose drawn into it.** Straight and level, and the same thickness profile on both sides of
  its midline, so a bend either way stays even.
- **Suckers on the bottom edge only**, never showing over the top. The bottom is the inside of
  every curl, as on the animal, and the game curls each arm toward it — that edge is what tells
  a coil from a kink.
- **A pattern that shows the bend.** Mottled patches spaced along the arm squeeze together on the
  inside of a curl and spread on the outside, which is what makes a curl read as flesh; one
  long stripe along the arm hides it.
- **A fine tip with little in it.** The last fifth is where it coils tightest, so it is thin and
  simple: the outline, the flesh, and a row of single-pixel suckers.
- **No outline across the root.** The root sits inside the head (as the squid's do) and an
  outline across the cut end would show as a seam.

**Facing:** as every squid plan in the game, the arm crown points forward (RIGHT) and the
mantle trails behind (left). The game turns the body to lie along whatever rock it clings to.

**Its colours are its own only when it shows itself.** Settled, the game paints the rock or
coral it sits on over its skin, so the picture is what it looks like as it strikes or flees:
the shading and the skin's bumps are what carry through the camouflage, so draw them clearly.

**On green:** it is a red-brown, which magenta bleed cannot be told from. Keep its sheen blue,
never green.

### Stage A

```text
STYLE (shared by every image)
Reference sheet for a game creature: a Caribbean reef octopus, Octopus briareus. Match
the attached sheets: dark navy water, side-on, the look of dark underwater pixel art.
Exactly one creature, nothing else in the frame: no rock, no plants, no bubbles, no
particles, no text except where asked. Strict lateral profile, facing RIGHT: the arms
reach forward to the right, the mantle trails behind to the left, the body straight
and horizontal, as a squid is drawn. The whole animal fits in the frame with a margin
around it. Output as a large lossless PNG, at least 2048 px wide.

ANATOMY (must be accurate)
- Mantle: a soft, rounded, egg-shaped sac behind the head, about as long as the head
  and eyes together and a little deeper than the head, its skin finely bumpy (papillae)
  with a few larger raised bumps along the top.
- Head: short, with one large eye on the near side, set high, with a horizontal dark
  pupil like a slot, and a small raised flap of skin (a papilla "horn") above it.
- Siphon: a short funnel on the side of the head just behind the eye, pointing back.
- Arm crown: the arms leave the head just in front of and below the eye, from a short
  thick base webbed between the arms.
- Arms: eight long arms, each about three times the length of the mantle, thick at the
  base and tapering to a fine tip, each with two rows of pale round suckers along its
  underside.
Colours: body a warm red-brown, mottled with darker brown patches and finely speckled
paler; an iridescent blue sheen on the top of the mantle and head (a blue, not green);
the suckers cream; the eye a pale gold with a dark slot pupil; the web between the
arms a little darker than the arms.

IMAGE 1 — "in game"
The animal fully rendered in the attached sheets' style, on a flat solid background of
the reef tank's water (#082039), the arms reaching forward slightly spread so each one
reads.

IMAGE 2 — "flat"
The same animal, same pose, same outline, flat colour only: no shading, no highlights,
no glow, no outline stroke, no texture. Each region one solid colour. Flat white
background.

IMAGE 3 — "parts"
The same animal taken apart, like a technical exploded diagram: each part drawn
separately with a clear gap, in its original position and orientation, pulled slightly
outward, each with a small plain label (mantle, head, eye, horn, siphon, arm crown,
web, arms, suckers). Flat white background.

IMAGE 4 — "body and one arm"
Two things on the same water, side by side: the body with every arm removed, cut flush
at the arm crown just in front of the eye, so it ends in a short rounded stump where
the arms leave; and one single arm laid out straight and level, its root on the left,
its tip on the right, its suckers along its bottom edge.

IMAGE 5 — "flash"
The same body as in image 4, same pose and outline, in the octopus's alarm display:
the whole body flushed a deep dark red-brown, the mottling gone, a pale ring round the
eye, the papillae raised so the skin is rougher.

IMAGE 6 — "arms at work"
The same animal, same style and water, settled on a plain dark flat ledge (one flat
colour, no texture, the only thing in the frame besides the animal), mantle raised
behind. Its eight arms each doing something different, as a live reef octopus's do:
two flat along the ledge gripping, suckers down; one reaching forward with its tip
lifted, feeling the ledge ahead; one with its tip curled into a tight spiral; one
lifted and waving loosely in the water in a soft S; one curled back under the body;
one reaching high, tip curled toward the viewer's side; one stretched out behind. The
suckers always on the inside of each curl.

IMAGE 7 — "one arm, bent"
The single arm from image 4, drawn five times in a row on the same water, each the
same arm with the same length and taper, only bent: 1) straight and level; 2) a gentle
S along its length; 3) its tip rolled into a tight spiral of one and a half turns,
suckers on the inside; 4) bent sharply at its middle into a U, suckers on the inside;
5) its root half straight and its tip half curled loosely upward like a hook. The
mottling squeezed together on the inside of each bend and spread on the outside.

IMAGE 8 — "palette"
A single row of 6–8 large square colour swatches taken from image 1, each with its hex
code under it: outline, deep shadow, body, body highlight, sheen, suckers, eye, web.
A second row under it: the same roles taken from image 5.

AVOID
Three-quarter or front views, a top-down octopus, arms curled over the mantle (except
in images 6 and 7), a body standing upright, curved or bent bodies, several animals, a scene, smooth gradients,
big soft bloom or halos, depth of field, watermarks, frames, borders, a cartoon
octopus, any green on the animal.
```

### Stage B, sheet 1: the body

```text
GOAL
True pixel-art sprite of the Caribbean reef octopus's body in the attached reference
sheet, for a game, WITHOUT its arms, as in the reference's "body and one arm" image.
Same design (mantle, head, eye, horn, siphon, skin bumps, colours), redrawn as clean
pixel art on a strict grid. 2 frames of the same body, side by side, left to right:
"rest", "strike".

THE GRID (most important)
- Each frame is exactly 128 × 96 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block dark outline («outline hex») round the whole silhouette, never thicker.

COMPOSITION
- Strict side view, facing RIGHT: the arm crown's stump at the right, the mantle to the
  left. Body straight and horizontal.
- From the back of the mantle to the arm crown the body is 96 art pixels long.
- The body is centred vertically: its midline, mantle tip to arm crown, lies along the
  frame's horizontal centre line.
- Everything fits inside the frame with at least 4 art pixels of margin, in both frames.
- Background: flat pure green #00FF00, one colour, nothing else. Do not use green
  anywhere on the animal, and do not let the outline pick up a green tint where it
  meets the background.

PALETTE
Use these colours, plus at most 8 in-between shades of them: «the Stage A palette».
Light comes from above and slightly in front: lit top, darker belly. The mantle and the
head shaded each as its own rounded form, the skin's bumps each a lit pixel over a dark
one, so the texture reads in any colour.

LIGHTS
The eye is flat pixels. NO glow halo, bloom or light spill, on the animal or on the
background.

FRAME 1 — "rest"
The body at rest, as in the reference, red-brown and mottled.

FRAME 2 — "strike"
The same body in its alarm display, as in the reference's "flash" image: flushed deep
dark red-brown, the mottling gone, a pale ring round the eye, the bumps raised. Same
frame size, same position and same outline as frame 1, so the two can be swapped
without the animal moving.

AVOID
Three-quarter or front views, any arms or arm stubs longer than the crown, any
background other than flat #00FF00, soft glows, painterly texture, noise, sub-pixel
detail, text, labels, borders, shadows, a second animal.
```

### Stage B, sheet 2: one arm

```text
GOAL
True pixel-art sprite of ONE arm of the Caribbean reef octopus in the attached
reference sheet, for a game, as in the reference's "body and one arm" image. Same
design and colours, redrawn as clean pixel art on a strict grid. ONE frame. The game
draws this one arm eight times, bending each.

THE GRID (most important)
- The frame is exactly 176 × 24 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block dark outline («outline hex») round the whole silhouette, never thicker.

COMPOSITION
- The arm laid out perfectly straight and level: its root at the left, cut flat
  where it leaves the crown, its tip at the right.
- From root to tip the arm is 160 art pixels long. At the root it is 12 art pixels
  thick; it tapers evenly and smoothly to 3 at the tip, with no bulge, lump or pinch
  anywhere along it, and symmetrical above and below its midline. The game bends this
  arm anywhere along its length, so nothing in it may assume a pose.
- Its midline lies along the frame's horizontal centre line.
- The suckers are a row of pale round discs along its bottom edge ONLY, each at least
  2 art pixels across, biggest near the root and smaller toward the tip, evenly spaced,
  down to single pixels over the last 30. None show over the top edge.
- The skin is mottled with darker red-brown patches spaced along the arm, each a few
  pixels long, so bending squeezes and spreads them; no stripe running the length of it.
- The last 30 art pixels are the tip: only the outline, the flesh and the single-pixel
  suckers, no mottling, so it stays clean when coiled tight.
- The root end is cut flat and straight up and down, at full thickness, with NO outline
  across the cut: the flesh runs to the very edge there. The outline runs only along the
  top and bottom edges and round the tip.
- Everything fits inside the frame with at least 4 art pixels of margin.
- Background: flat pure green #00FF00, one colour, nothing else. Do not use green
  anywhere on the arm, and do not let the outline pick up a green tint where it meets
  the background.

PALETTE
The same colours as the body's rest frame: «the Stage A palette», plus at most 8
in-between shades. Lit along its top edge, darker below.

AVOID
A curled, bent or coiled arm (the game bends it), a lumpy or uneven taper, suckers on
the top edge, a stripe along the arm, an outline across the root, several arms, the body, any background other than flat
#00FF00, soft glows, painterly texture, noise, sub-pixel detail, text, labels, borders,
shadows.
```

### Import

```bash
npm run sprite -- docs/media/reference/reefoctopus-sprite.png --id reefoctopus --key green --pitch 8 --keep 0,0,128,96
npm run sprite -- docs/media/reference/reefoctopus-arm-sprite.png --id reefoctopus-arm --key green --pitch 8
```

No `--fringe`: it took the blue sheen along the mantle for green bleed. The strike is the whole
body flushed, so it is kept whole.
