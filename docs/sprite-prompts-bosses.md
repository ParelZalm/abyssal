# Sprite prompts: the bosses

The prompts for the two bosses still painted, filled in from [sprites.md](sprites.md#the-art-side):
the Great White (the reef) and the Giant Squid (the deep). The mantis shrimp came before this
page and its prompts are in its entry's history.

**Attach every time:** `docs/media/reference/cave-room.webp` and `tank-room.webp` for the world,
and `angler.webp` and `mantisshrimp.webp` for finished animals, the second a boss. For the
Great White add `barracuda.webp` (a long fish of the same style); for the Giant Squid add
`vampiresquid.webp` and `vampiresquid-arm-sprite.webp` (a squid already split into a body and
an arm). For Stage B, attach the chosen Stage A sheet as well.

**Both go on green, not magenta.** The Great White's open mouth is pink gums and the Giant
Squid is brick red, and magenta bled into either cannot be told from paint. Neither has any
green in it.

**No turned frames.** A boss does not turn at half health the way a hostile's moveset does
(`Roles.turn`): what changes is in its fight (a second charge, every breach; fewer arms), so
each is rest and strike only.

**Fill in the palette** in Stage B from the swatches of the Stage A sheet you choose.

---

## 1. Great White — boss (the reef): rest, strike (the jaws)

Its fight reads the snout and the tells off the body (`sim/bosses.ts`): it circles, turns square
on and holds through the tell with its jaws coming open, rushes the line, and dazes itself on
rock; every other charge it breaches straight up from the floor. The strike frame is shown from
a third of the way into the tell and through the rush, so it is the tell: **the jaws opening is
what the player reads**. Its hitbox's first sample is the snout, so keep it a clean point.

Big on screen (some seven tiles nose to tail in the reef, a fifth of the room), so it is asked
longer than the others.

### Stage A

```text
STYLE (shared by every image)
Reference sheet for a game creature: a great white shark, Carcharodon carcharias, a
large adult. Match the attached sheets: dark navy water, side-on, the look of dark
underwater pixel art. Exactly one creature, nothing else in the frame: no rock, no
plants, no bubbles, no particles, no text except where asked. Strict lateral profile,
facing RIGHT, body straight and horizontal, not curved or swimming. Every fin spread
open so its outline reads. The whole animal fits in the frame with a margin around it.
Output as a large lossless PNG, at least 2048 px wide.

ANATOMY (must be accurate)
- Body: a heavy torpedo, deepest just behind the pectorals (about a quarter of its
  length), tapering to a narrow tail stalk with a flat keel along its side.
- Head: a blunt conical snout; the mouth a wide downturned crescent under it, set back
  behind the eye, closed with only the tips of a few teeth showing; the eye small, round
  and fully black, no white showing.
- Five long gill slits just in front of the pectoral fins.
- Fins: a tall triangular first dorsal over the middle of the back, its rear edge
  concave; a tiny second dorsal and a tiny anal fin near the tail; long sickle-shaped
  pectorals swept back and down from behind the gills; small pelvic fins under the
  belly; a tall crescent tail, the two lobes near equal, the top a little longer.
- Countershading: the back and sides above the midline slate grey, ending in a sharp,
  ragged line against a white belly that runs from under the snout to the tail stalk.
  The pectoral tips dark underneath.
Colours: back a cool slate grey, a little blue; belly an off-white; fin edges and the
pectoral tips a charcoal; the gill slits and the mouth line dark; the eye black.

IMAGE 1 — "in game"
The animal fully rendered in the attached sheets' style, on a flat solid background of
the reef tank's water (#082039). No light of its own on it.

IMAGE 2 — "flat"
The same animal, same pose, same outline, flat colour only: no shading, no highlights,
no glow, no outline stroke, no texture. Each region one solid colour. Flat white
background.

IMAGE 3 — "parts"
The same animal taken apart, like a technical exploded diagram: each part drawn
separately with a clear gap, in its original position and orientation, pulled slightly
outward, each with a small plain label (snout, eye, jaws, teeth, gill slits, first
dorsal, second dorsal, pectoral, pelvic, anal, tail, keel, belly). Flat white
background.

IMAGE 4 — "jaws"
The same animal, same pose and same outline as image 1 except the head, attacking: the
snout lifted, the upper jaw thrust forward out from under it, the lower jaw dropped
wide, both jaws lined with big triangular serrated teeth, pink gums showing, and the
eye rolled back so it is white. On the same water.

IMAGE 5 — "palette"
A single row of 6–8 large square colour swatches taken from images 1 and 4, each with
its hex code under it: outline, deep shadow, back grey, back highlight, belly white,
fin dark, gums, teeth.

AVOID
Three-quarter or front views, curved or bent bodies, a dynamic swimming pose, several
animals, a scene, a cartoon shark with a grin, a bright blue shark, scars, blood,
smooth gradients, big soft bloom or halos, depth of field, watermarks, frames, borders.
```

### Stage B

```text
GOAL
True pixel-art sprite of the great white shark in the attached reference sheet, for a
game. Same design as the reference (shape, fins, jaws, teeth, eye, countershading,
colours), redrawn as clean pixel art on a strict grid. 2 frames of the same animal,
side by side, left to right: "rest", "strike".

THE GRID (most important)
- Each frame is exactly 240 × 128 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block dark outline («outline hex») round the whole silhouette, never thicker.

COMPOSITION
- Strict side view, facing RIGHT, body straight and horizontal. Fins spread: the
  pectoral swept back and down, the tail's two lobes spread.
- From the tail tip to the snout the animal is 208 art pixels long.
- The body is centred vertically: its midline, tail stalk to snout, lies along the
  frame's horizontal centre line.
- The snout ends in a clean blunt point, nothing in front of it.
- Thin parts (the fin tips, the tail's lobes, the gill slits, the teeth) are at least 2
  art pixels thick: the game shrinks the sprite, and a 1-pixel line is the first thing
  to go.
- Everything fits inside the frame with at least 4 art pixels of margin, in both
  frames, the open jaws included.
- Background: flat pure green #00FF00, one colour, nothing else. Do not use green
  anywhere on the animal, and do not let the outline pick up a green tint where it
  meets the background.

PALETTE
Use these colours, plus at most 8 in-between shades of them: «the Stage A palette».
Light comes from above and slightly in front: lit top, darker belly. Each part shaded
as its own rounded form. Keep the line between the grey back and the white belly sharp
and ragged, as in the reference, not blended.

LIGHTS
The eye is flat pixels. NO glow halo, bloom or light spill, on the animal or on the
background.

FRAME 1 — "rest"
The animal at rest, as in the reference's image 1, the mouth closed with only the tips
of a few teeth showing.

FRAME 2 — "strike"
Identical to frame 1 in every pixel except the head in front of the gill slits: the
jaws open as in the reference's image 4 — snout lifted, upper jaw thrust forward, lower
jaw dropped, rows of big triangular teeth, pink gums, the eye rolled back white. Same
frame size, same position, same everything behind the gills, so the two can be swapped
without the animal moving.

AVOID
Three-quarter or front views, any background other than flat #00FF00, soft glows,
painterly texture, noise, sub-pixel detail, text, labels, borders, shadows, blood, a
second animal.
```

### Import

```bash
npm run sprite -- docs/media/reference/greatwhite-sprite.png --id greatwhite --key green --fringe
```

The jaws open inside the head and in front of it, so expect to box the head with `--keep` if
the import takes too little or too much of the strike.

---

## 2. Giant Squid — boss (the deep): rest, strike (the siphon); one arm; one tentacle

As the vampire squid, its arms are not in its picture: the body is one sheet and each arm is
drawn by the rig (`armRig`, `FishView.poseArms`). But a giant squid has two kinds: eight
arms, and two feeding tentacles far longer than them with a club at the tip. The tentacles
are its whole silhouette and its whole fight — they lash out and hold the player, and they are
what is **torn off, one at a time**, when the player pulls free (`Bosses.torn`, `FishView.tear`).
So there are **three Stage B sheets**: the body, one arm (drawn eight times), and one tentacle
(drawn twice).

**Code before it is wired:** the rig takes one arm picture today (`SpriteArt.arm`), and lays
the feeding pair out of the same one. A second picture for the feeding pair (`SOURCES.tentacle`)
is the one thing to write before the import.

**Facing:** as every squid plan in the game, the arms point forward (RIGHT) and the mantle and
fins trail behind (left).

**The strike** is shown through the grab's tell and the siphon draw, when it draws the water
in: the collar of the mantle gapes open behind the head and the funnel flares. The rig's own
spread of the arms is the rest of the tell.

### Stage A

```text
STYLE (shared by every image)
Reference sheet for a game creature: a giant squid, Architeuthis dux, a large adult.
Match the attached sheets: dark navy water, side-on, the look of dark underwater pixel
art. Exactly one creature, nothing else in the frame: no rock, no plants, no bubbles,
no particles, no text except where asked. Strict lateral profile, facing RIGHT: the
arms and the two long tentacles reach forward to the right, the mantle and fins trail
behind to the left, the body straight and horizontal. The whole animal fits in the
frame with a margin around it. Output as a large lossless PNG, at least 2048 px wide.

ANATOMY (must be accurate)
- Mantle: long, slim and muscular, a tapering torpedo about five times as long as it
  is deep, with a smooth collar where it meets the head.
- Fins: a pair of small rhomboid fins together at the very back of the mantle,
  forming a pointed arrowhead tip, short compared with the mantle.
- Head: short, narrower than the mantle; the eye enormous, round, the largest of any
  animal, set in the middle of the head side, pale silvery with a dark pupil; the
  funnel a short tube under the head, opening forward.
- Arms: eight thick muscular arms of about the same length, as long as the head and
  a third of the mantle together, tapering to a point, each lined along its inner
  side with two rows of round suckers ringed with small teeth.
- Tentacles: two feeding tentacles, very long and thin, twice the arms' length and
  more, bare along the stalk, ending in a broader paddle-shaped club covered on its
  inner side with rows of large toothed suckers.
Colours: the mantle, head and arms a deep brick red to rust, mottled with darker
chromatophore spots on the back, paler and pinker on the underside; the fins the same;
the suckers a pale cream ringed darker; the eye silvery blue-grey with a black pupil.

IMAGE 1 — "in game"
The animal fully rendered in the attached sheets' style, on a flat solid background of
the deep tank's water (#0b1530), the arms reaching forward slightly spread so each one
reads, the two tentacles reaching out beyond them. Any light on it is small and tight,
no halo.

IMAGE 2 — "flat"
The same animal, same pose, same outline, flat colour only: no shading, no highlights,
no glow, no outline stroke, no texture. Each region one solid colour. Flat white
background.

IMAGE 3 — "parts"
The same animal taken apart, like a technical exploded diagram: each part drawn
separately with a clear gap, in its original position and orientation, pulled slightly
outward, each with a small plain label (mantle, collar, fins, head, eye, funnel, arm
crown, arms, suckers, tentacle stalks, tentacle clubs). Flat white background.

IMAGE 4 — "body, one arm and one tentacle"
Three things on the same water, apart: the body with every arm and both tentacles
removed, cut flush at the arm crown just in front of the eye, so it ends in a short
rounded stump where they leave; one single arm laid out straight and level, its root on
the left, its tip on the right, its suckers along its bottom edge; and one single
tentacle laid out the same way, straight and level, its long bare stalk on the left and
its club on the right, the club's suckers along its bottom edge.

IMAGE 5 — "siphon"
The body alone as in image 4, same outline, except the collar of the mantle gaping open
behind the head, showing the dark inside of the mantle, and the funnel flared wide. On
the same water.

IMAGE 6 — "palette"
A single row of 6–8 large square colour swatches taken from image 1, each with its hex
code under it: outline, deep shadow, body red, body highlight, underside, chromatophore
spot, sucker, eye.

AVOID
Three-quarter or front views, a bell-shaped octopus pose, arms curling over the mantle,
curved or bent bodies, a kraken, a ship, several animals, a scene, a bright cartoon red,
a vampire squid's black web between the arms, smooth gradients, big soft bloom or
halos, depth of field, watermarks, frames, borders.
```

### Stage B, sheet 1: the body

```text
GOAL
True pixel-art sprite of the giant squid's body in the attached reference sheet, for a
game, WITHOUT its arms or tentacles, as in the reference's "body, one arm and one
tentacle" image. Same design (mantle, collar, fins, eye, funnel, colours), redrawn as
clean pixel art on a strict grid. 2 frames of the same body, side by side, left to
right: "rest", "strike".

THE GRID (most important)
- Each frame is exactly 208 × 80 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block dark outline («outline hex») round the whole silhouette, never thicker.

COMPOSITION
- Strict side view, facing RIGHT: the arm crown's stump at the right, the mantle and
  the fins' arrowhead to the left. Body straight and horizontal, fins spread up and
  down.
- From the tip of the fins to the arm crown the body is 176 art pixels long.
- The body is centred vertically: its midline, fin tip to arm crown, lies along the
  frame's horizontal centre line.
- Everything fits inside the frame with at least 4 art pixels of margin, in both frames.
- Background: flat pure green #00FF00, one colour, nothing else. Do not use green
  anywhere on the animal, and do not let the outline pick up a green tint where it
  meets the background.

PALETTE
Use these colours, plus at most 8 in-between shades of them: «the Stage A palette».
Light comes from above and slightly in front: lit top, darker belly. Each part shaded
as its own rounded form. The deep water is dark: keep the top of the mantle and the
fins' edges lit enough to read against it.

LIGHTS
The eye is flat bright pixels. NO glow halo, bloom or light spill, on the animal or on
the background. The game adds the glow itself.

FRAME 1 — "rest"
The body at rest, as in the reference, the collar closed against the head and the
funnel a short tube.

FRAME 2 — "strike"
Identical to frame 1 in every pixel except the collar and the funnel: the collar
gaping open behind the head, showing the dark inside of the mantle, and the funnel
flared wide, as in the reference's "siphon" image. Same frame size, same position, same
everything else, so the two can be swapped without the animal moving.

AVOID
Three-quarter or front views, any arms or tentacle stubs longer than the crown, any
background other than flat #00FF00, soft glows, painterly texture, noise, sub-pixel
detail, text, labels, borders, shadows, a second animal.
```

### Stage B, sheet 2: one arm

```text
GOAL
True pixel-art sprite of ONE arm of the giant squid in the attached reference sheet,
for a game, as in the reference's "body, one arm and one tentacle" image. Same design
and colours, redrawn as clean pixel art on a strict grid. ONE frame. The game draws
this one arm eight times, bending each.

THE GRID (most important)
- The frame is exactly 176 × 32 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block dark outline («outline hex») round the whole silhouette, never thicker.

COMPOSITION
- The arm laid out perfectly straight and level: its root at the left, cut flat where
  it leaves the crown, its tip at the right.
- From root to tip the arm is 160 art pixels long. At the root it is 14 art pixels
  thick; it tapers evenly to a point 3 thick at the tip.
- Its midline lies along the frame's horizontal centre line.
- The suckers are a row of round cream discs along its bottom edge, each at least 2
  art pixels across, shrinking toward the tip.
- Everything fits inside the frame with at least 4 art pixels of margin.
- Background: flat pure green #00FF00, one colour, nothing else. Do not use green
  anywhere on the arm, and do not let the outline pick up a green tint where it meets
  the background.

PALETTE
The same colours as the body: «the Stage A palette», plus at most 8 in-between shades.
Lit along its top edge, darker below.

AVOID
A curled, bent or coiled arm, a club at the tip, several arms, the body, any background
other than flat #00FF00, soft glows, painterly texture, noise, sub-pixel detail, text,
labels, borders, shadows.
```

### Stage B, sheet 3: one tentacle

```text
GOAL
True pixel-art sprite of ONE feeding tentacle of the giant squid in the attached
reference sheet, for a game, as in the reference's "body, one arm and one tentacle"
image. Same design and colours, redrawn as clean pixel art on a strict grid. ONE frame.
The game draws this one tentacle twice, bending each.

THE GRID (most important)
- The frame is exactly 256 × 40 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block dark outline («outline hex») round the whole silhouette, never thicker.

COMPOSITION
- The tentacle laid out perfectly straight and level: its root at the left, cut flat
  where it leaves the crown, its club at the right.
- From root to tip it is 240 art pixels long. The stalk is 6 art pixels thick at the
  root and 4 along most of its length, bare, with no suckers. The last 64 art pixels
  are the club: it widens to 14 art pixels thick and narrows again to a blunt point at
  the tip.
- Its midline lies along the frame's horizontal centre line.
- The club's suckers are rows of round cream discs ringed darker along its bottom edge,
  the biggest in the club's middle, each at least 2 art pixels across.
- Everything fits inside the frame with at least 4 art pixels of margin.
- Background: flat pure green #00FF00, one colour, nothing else. Do not use green
  anywhere on the tentacle, and do not let the outline pick up a green tint where it
  meets the background.

PALETTE
The same colours as the body: «the Stage A palette», plus at most 8 in-between shades.
Lit along its top edge, darker below.

AVOID
A curled, bent or coiled tentacle, suckers along the stalk, several tentacles, an arm,
the body, any background other than flat #00FF00, soft glows, painterly texture, noise,
sub-pixel detail, text, labels, borders, shadows.
```

### Import

```bash
npm run sprite -- docs/media/reference/giantsquid-sprite.png --id giantsquid --key green --fringe
npm run sprite -- docs/media/reference/giantsquid-arm-sprite.png --id giantsquid-arm --key green --fringe
npm run sprite -- docs/media/reference/giantsquid-tentacle-sprite.png --id giantsquid-tentacle --key green --fringe
```

The collar and the funnel open inside the silhouette, as the vampire squid's light organs did,
so expect to box them with `--keep`. The arm's and the tentacle's landmarks are set by hand.
