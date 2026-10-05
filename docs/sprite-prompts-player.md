# Sprite prompts: the player

The player's bodies, drawn to the enemies' and the items' standard (`roadmap.md`, *The player
fish rework*). Decided October 2026: **drawn bodies and drawn parts**. Each body the player can
be is a picture, bare, and every mutation that marks the body is a picture of its own part — an
eye, a fin, a sac, a quill — that the game places on the body where it belongs, as `edgeAt`
places the painted parts now. Enemies never change, so one picture of one animal was enough;
the player changes with every mutation, which is why the parts are apart from the body.

Six bodies: the larva, and the five it can become — the Shark, the Squid, the Moray, the Angler
and the Bloom (`content/forms.ts`). They go one at a time, the larva first, since it is the body
of every run's opening and the one the parts are fitted to first.

**Attach every time:** `docs/media/reference/cave-room.webp` (the larva is in it, small and
white in the middle of the room — that is the target) and `tank-room.webp` for the world, and
`angler.webp` for a finished animal. For Stage B, attach the chosen Stage A sheet as well.

**Done prompts are struck through** and cut down to what was made and how it was imported; the
prompt itself is in the history, where each one says.

---

## The larva — redrawn

The first larva is in the game (`BODIES.wraith`), but its body was a cone behind a round head,
and it is drawn again to a more natural fish: `docs/media/reference/larva.webp` is the new Stage
A, a deep round head tapering to a narrow tail stalk, a separate fan of a tail on rays, a back
fold that arches up over the middle of the trunk, a shallower belly fold, a fan of a pectoral
over the gut, and the eye about a sixth of the length. Until both sheets below are in, the game
keeps the first one. The first one's prompts and imports are in the history:
`git show 92d0f2e:docs/sprite-prompts-player.md`.

- ~~Stage A~~ — done: `docs/media/reference/larva.webp`.

### Stage B

Two sheets again, and **the parts sheet first** this time. The first larva's two sheets did not
agree — the bare body came back a cone, the whole larva on the parts sheet a cylinder with a
head — and the game laid the parts from one on the body from the other. So the parts sheet,
with the whole larva on it, is made first, and the bare body is asked for as exactly the body
of that whole larva, with the parts sheet attached.

**On green:** the larva is lavender, and magenta bled into it cannot be told from paint.

**The sizes**, off the Stage A sheet's "in game" image at 112 art pixels from tail tip to snout:
the tail 24 long and 26 tall; the body, tail stalk to snout, 88 long, 28 deep at the head and 8
at the stalk; the back fold 52 long and 14 tall at its arch; the belly fold 48 long and 10 deep;
the eye 20 across; the pectoral 12 by 13; the whole larva 42 deep with its folds. One change from
the sheet: **the eye sits a little further back**, with 5 art pixels of head in front of it,
because on the first larva the eye covered the snout and the mouth with it.

**Attach both:** `cave-room.webp`, `tank-room.webp`, `angler.webp` and `larva.webp`; for sheet 2,
the parts sheet that came back as well.

#### Sheet 1: the parts

```text
GOAL
True pixel-art sprite sheet of the fish larva in the attached reference sheet, for a
game: the whole larva once, and under it its parts drawn apart, as in the reference's
"parts" image. Same design and colours — the deep round head, the trunk tapering to a
narrow tail stalk, the fan tail on rays, the arched back fold — redrawn as clean pixel
art on a strict grid.

THE GRID (most important)
- The sheet is exactly 160 × 136 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block outline (#79728F) round each silhouette, never thicker.

LAYOUT
- Top row: the WHOLE larva, assembled, as in the reference's "in game" image: facing
  RIGHT, straight and horizontal, 112 art pixels from tail tip to snout and 42 deep
  with its fin folds. Centred left to right. The eye is 20 across and sits with 5 art
  pixels of head in front of it; the small mouth is at the tip of the snout, just
  below the middle line, a short dark seam.
- Bottom rows: its five parts, each on its own with at least 8 art pixels of
  background on every side between it and anything else, each drawn at EXACTLY the
  size, angle and shape it has on the whole larva above, facing the same way, not
  rotated, not enlarged:
  1. the tail (the round fan on its rays, cut flat where it joins the tail stalk);
  2. the back fin fold (the fold arching up over the trunk, its lower edge where it
     meets the body);
  3. the belly fin fold (the shallower fold along the belly, its upper edge where it
     meets the body);
  4. the pectoral fin (the small fan behind the head, over the gut);
  5. the eye (the black pupil, the pale-silver ring and the white glint).
- Where a part meets the body, finish its edge with the outline like the rest of it.
- The tail's and the pectoral's rays and the notochord are at least 2 art pixels
  thick.
- Background: flat pure green #00FF00, one colour, nothing else. Do not use green
  anywhere on the animal, and do not let the outline pick up a green tint where it
  meets the background.

PALETTE
Use these colours, plus at most 8 in-between shades of them: outline #79728F, deep
shadow #B8B0D8, body #E8E4F8, body highlight #F4F2FF, fin #D6D0ED, gut #6A5A8A, eye
ring #CDD3E3, pupil #080B16. Light comes from above and slightly in front: lit top,
darker belly; each part shaded as its own rounded form, the fins paler and more
see-through than the body.

LIGHTS
The eye's glint is a flat white block. NO glow halo, bloom or light spill, on the
animal or on the background. The game adds the glow itself.

AVOID
Labels, leader lines, dotted outlines, parts that differ from the whole larva in size
or shape, a part drawn twice, any background other than flat #00FF00, soft glows,
painterly texture, noise, sub-pixel detail, text, borders, shadows, a second animal.
```

#### Sheet 2: the bare body

```text
GOAL
True pixel-art sprite of the fish larva's BARE BODY, for a game: EXACTLY the body of
the whole larva at the top of the attached parts sheet — the same outline, the same
head, the same taper, the same shading — with its eye, its fin folds, its tail and its
pectoral fin taken off. The notochord and the gut show through it as they do there.
2 frames of the same body, side by side, left to right: "rest", "strike".

THE GRID (most important)
- Each frame is exactly 144 × 64 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block outline (#79728F) round the whole silhouette, never thicker.

COMPOSITION
- Strict side view, facing RIGHT, body straight and horizontal.
- From the tail stalk (where the tail joins, cut flat) to the snout the body is 88 art
  pixels long, 28 deep at the head and 8 at the stalk, as on the parts sheet.
- Where the eye goes the head is plain body colour, shaded as the rest of the head: no
  socket, no hole, no dotted outline. The game puts the eye on it.
- The body is centred vertically: its midline, tail stalk to snout, lies along the
  frame's horizontal centre line.
- The notochord is a straight line at least 2 art pixels thick.
- Everything fits inside the frame with at least 4 art pixels of margin, in both frames.
- Background: flat pure green #00FF00, one colour, nothing else. Do not use green
  anywhere on the animal, and do not let the outline pick up a green tint where it
  meets the background.

PALETTE
The parts sheet's colours: outline #79728F, deep shadow #B8B0D8, body #E8E4F8, body
highlight #F4F2FF, fin #D6D0ED, gut #6A5A8A, plus at most 8 in-between shades.

FRAME 1 — "rest"
The bare body at rest, the small mouth at the tip of the snout shut: a short dark seam.

FRAME 2 — "strike"
Identical to frame 1 in every pixel except the mouth: the lower jaw dropped open, a
dark gape (#6A5A8A at its deepest) 5 art pixels tall cut into the tip of the snout. No
teeth. Same frame size, same position, same everything else, so the two can be swapped
without the animal moving.

AVOID
A body shaped differently from the whole larva on the parts sheet, an eye, an eye
socket or a dotted outline, fin folds, a tail, a pectoral fin, any background other
than flat #00FF00, soft glows, painterly texture, noise, sub-pixel detail, text,
labels, borders, shadows, a second animal.
```

**What to send back:** both PNGs. On the parts sheet, check that each part laid on the whole
larva would cover its own place exactly; on the body sheet, that the body is the whole larva's.

**When they land:** `npm run sprite` for the body and `scripts/import-parts.mjs` for the parts,
as the first larva went in; then the eye's trim (`parts.size.eye`, 0.72 on the first larva, whose
eye was a fifth of its length) is set again against this one, likely back to 1.

### What comes after it

1. **The parts the mutations add**, in sheets grouped by where they sit on a body: the head and
   the tail below, then the back, the belly and the flank.
2. **The five forms**, one at a time, each a Stage A and B of its own, its parts fitted to it.

---

## The larva's mutations

**Wait for the redrawn larva** above: these are drawn to its parts sheet and its sizes.

Every mark a mutation makes on the body, drawn as a part of its own, fitted to the drawn larva.
There is no Stage A: the larva fixes the style, and each item's drawing fixes what the organ
is, so these go straight to production sheets. The board's *Mutations* and *Builds* groups
are where they are judged, each beside its item.

**These are not found on a whole animal**, as the larva's own parts were: there is no one
picture with all of them on it. Each part is drawn alone in a fixed cell of a grid, and the
game places it on the body by its **anchor**, the point it joins the body by, where its painter
places it now (`edgeAt`). The anchor is never drawn; it is read off the part's shape (a flat cut
end, the middle of an eye), so each item below says which edge it joins by.

**Sizes are the larva's.** The larva is 112 art pixels from tail tip to snout, its head 28
deep, its eye 20 across and its tail 24 by 26, as on its parts sheet. A part drawn to that scale
sits on it without being resized; the game grows and shrinks it with its mutation from there.

**Attach every time:** `docs/media/reference/larva-parts-sprite.png` (the larva and its parts,
which these are added to), `larva.webp` (its reference sheet), `cave-room.webp` for the world,
and the items sheet each part's item is on (named in each list), so an organ on the body and
its item over the pedestal read as one thing.

**On green**, as the larva was: it is lavender, and several parts are violet.

### The shared block

```text
GOAL
True pixel-art sprite sheet of body parts for the fish larva in the attached sheets, for
a game: each part a separate piece that the game lays onto the larva. Same style, same
outline, same light and the same scale as the larva and its parts in the attached
parts sheet: these are added to that larva. A grid of cells, one part per cell, in the
order listed.

THE GRID (most important)
- «C» columns and «N» rows of cells, each exactly «W» × «H» art pixels, no gaps between
  cells and no lines drawn between them.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block outline (#79728F) round each part, never thicker, as on the larva.

EACH PART
- Side view, facing RIGHT like the larva: forward is right, up is up.
- Drawn at the larva's scale: the larva is 112 art pixels long, its head 28 deep, its
  eye 20 across.
- Centred in its cell unless the item says where its edge goes, with at least 3 art
  pixels of margin to the cell's edges.
- Where a part joins the body, its edge is cut clean and outlined like the rest of it.
- Thin parts (whiskers, stalks, rays, threads) are at least 2 art pixels thick.
- Background: flat pure green #00FF00, one colour, in every cell. Do not use green on
  any part, and do not let an outline pick up a green tint.

PALETTE
The larva's colours where a part is the larva's own flesh or fin: outline #79728F, deep
shadow #B8B0D8, body #E8E4F8, body highlight #F4F2FF, fin #D6D0ED, gut #6A5A8A, eye
ring #CDD3E3, pupil #080B16. Each item's own colours where it says, plus at most 8
in-between shades. Light from above and slightly in front: lit top, darker below.

LIGHTS
Lit things (a lure's bulb, a lens) are flat bright pixels. NO glow halo, bloom or light
spill, on the part or on the background. The game adds the glow itself.

AVOID
The larva itself or any part of its body that the item does not name, labels, text,
numbers, cell borders, any background other than flat #00FF00, soft glows, painterly
texture, noise, sub-pixel detail, shadows.
```

Then the sheet's own `PARTS` block, with its grid filled in above.

### The head

20 parts, `«C»` 4, `«N»` 5, `«W»` × `«H»` 40 × 40, so the sheet is 160 × 200 art pixels. Attach
`items-sheet-1-current.png`, `items-sheet-2-current.png`, `items-sheet-3-current.png` and
`items-sheet-5-current.png`.

```text
PARTS (left to right, top to bottom)
1. Tapetum Lucidum — the larva's eye, the same 20 across, black pupil and pale-silver
   ring, but the pupil backed by a mirror of warm gold (#ffb84a to #ffe49a) that shows
   as a gold crescent low in the pupil, and the glint brighter. Centred.
2. Four-Eyed Fish — a second, smaller eye (18 across) raised on a low hump of the
   larva's skin, a thin pale-blue line (#78c4f0) across its middle where it is split in
   two. The hump's bottom edge is cut flat at the cell's bottom margin: that edge sits
   on the top of the head.
3. Parietal Eye — a small dark socket (10 across) with a pale, lit lens (#e8f4ff) in it,
   a third eye on the crown. Centred.
4. Surface Halo — a flat ring of gold (#ffe49a, darker gold below) seen slightly from
   above, 26 wide and 8 tall, with four small gold-white sparks on it. Centred; it floats
   over the head and touches nothing.
5. Hunting Nares — two small dark nostril pits, each 4 across with a mint rim
   (#7af0c8), side by side 3 apart, on a small patch of the larva's skin 14 × 8. Centred.
6. Ampullae of Lorenzini — a patch of the larva's skin 16 × 10 freckled with six or
   seven black pores, each in a faint lilac ring (#b8a8ff). Centred.
7. Archer Spit — a round sac of clear blue water (#78c4f0, a white-blue sheen
   #ecfaff high on it), 10 across, seen through the skin: the throat's water. Centred.
8. Mouthbrooder — the throat let down into a pale pouch of the larva's skin, 24 wide
   and 14 deep, the dark eyes of four or five fry (#dce8ff bodies, black eyes) showing
   through it. Its top edge is cut flat at the cell's top margin: it hangs under the jaw.
9. Barbels — three soft whiskers, the larva's fin colour, 2 thick, hanging down and
   back from one root, the longest 22. The root is at the cell's top-left, cut flat.
10. Needle Jet — a long thin silver needle (#d8f6ff to #8a9ab0), 30 long and 3 thick,
    straight and level, pale at the point, a small ring of blue water round it near the
    root. Its root is at the left, cut flat, at mid-height: it leaves the snout.
11. Illicium — a lure: a thin dark stalk (#3a3550) 2 thick rising from its root at the
    cell's bottom-left, arching up and forward, 26 tall, ending in a glowing cyan bulb
    (#3fd8ff, white-cyan centre) 6 across that hangs forward of the root.
12. Deep Lantern — the same lure, longer (34 tall) and its bulb bigger (9 across), the
    root again at the bottom-left.
13. Hinged Jaw, shut — the larva's lower jaw drawn as a piece: 18 long, 7 deep, pale
    like the larva's chin, a row of small ivory teeth (#f4ecd8) along its top edge. Its
    hinge is the left end, at mid-height; its tip is at the right.
14. Hinged Jaw, open — the same jaw swung down 35° about its hinge, and above it the
    dark gape of the open mouth (#2a1e3a) as a wedge from the hinge forward.
15. Lunging Bite, shut — the same jaw with two long ivory fangs (#f4ecd8), 6 tall,
    standing up from its front, crossing the lip.
16. Lunging Bite, open — that jaw swung down 35° as in 14, with the gape, the fangs
    pointing up into it.
17. Serrated Teeth, shut — the same jaw with a saw edge: many small triangle teeth, each
    2 tall, close-set along its whole top.
18. Serrated Teeth, open — that jaw swung down 35° as in 14, with the gape.
19. Parrot Beak, shut — a parrotfish's fused beak capping the front of the snout: a
    slate-blue upper plate (#5a6a8a) over a teal lower one (#3a8a8a), a pale cutting
    edge where they meet, 14 long and 14 deep. Its back edge is at the left, cut flat
    where it meets the head.
20. Parrot Beak, open — the same beak with the lower plate swung down 25° about its back
    edge, the dark gape (#2a1e3a) between the plates.
```

### The tail

6 parts, `«C»` 2, `«N»` 3, `«W»` × `«H»` 80 × 48, so the sheet is 160 × 144 art pixels: the tail's
parts are long. Attach `items-sheet-3-current.png` and `items-sheet-5-current.png`.

```text
PARTS (left to right, top to bottom)
1. Forked Caudal Fin — the larva's tail redrawn with a fork: the same root (8 deep, cut
   flat at the right, where it meets the tail stalk), the same fin colour and faint
   rays, but swept back into two pointed lobes with a notch between them, 24 long and
   30 tall tip to tip.
2. Forked Caudal Fin, twice — the same, deeper: two long scythe lobes, 30 long and 36
   tall tip to tip, the notch reaching two thirds of the way to the root.
3. Anguilliform Body — an eel's ribbon fin: one continuous soft fin, the larva's fin
   colour, that runs back along the top from the cell's top right, round the end of the
   body in a rounded point, and forward again underneath, 8 deep all the way, 74 long.
   Its inner edge, where it meets the body, is cut clean; the body itself is not drawn.
4. Siphon Jet — a short muscular tube, the larva's deep shadow and body colours, 18 long
   and 7 thick, pointing BACK (left), its mouth open and dark (#2a1e3a). Its root is at
   the right, cut flat.
5. Smoke Screen — the same siphon, stained black with ink (#08060e, a grey sheen
   #787896) from its mouth forward, thinning toward the root.
6. Drifting Bloom — a fringe of six stinging filaments trailing behind, each 2 thick,
   violet (#c8a8ff), from 30 to 60 long, gently waved, each beaded with three small
   bright stinging cells (#f0e0ff). Their roots are in a column at the cell's right
   edge, cut flat: they hang from the rear of the body.
```

**What to send back:** the two PNGs. Check that the cells are on the grid (the importer cuts
by position) and that no part runs into its neighbour's cell.

### The code side, when they land

The importer cuts each cell by position and finds its anchor by the rule its item gives:

| Part | Anchor |
| --- | --- |
| eyes, lens, nares, pores, sac, halo | the middle |
| Four-Eyed Fish's hump | the middle of its flat bottom edge |
| brood pouch | the middle of its flat top edge |
| barbels | the top-left root |
| needle, beak | the middle of the flat left edge |
| lures | the bottom-left root |
| jaws | the hinge, the left end at mid-height |
| tails, siphons, bloom | the middle of the flat right edge |

Each part is laid where its painter lays its painted one now — the eyes on the drawn eye, the
jaw at the drawn mouth's hinge, the tails at the tail stalk — and stretched as its mutation
grows it, as the larva's own parts are (`posesFor`). A shut and an open jaw swap with the
body's rest and strike frames. Ink, electric plates, venom, spines, quills and coral are the
back, belly and flank sheets', next.
