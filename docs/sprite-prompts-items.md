# Sprite prompts: the items

The mutations' drawings — what hangs over a pedestal and fills the card's mark — as generated
pixel art, to replace the ones painted in code (`render/itemart.ts`). Five sheets of a grid
each, sixteen items a sheet (twelve on the last), every item in its own cell.

**Attach every time:** the sheet's own `docs/media/reference/items-sheet-«n»-current.png` — the
drawings the game has now for exactly that sheet's items, on the same four-column grid and in
the same order, so cell for cell it says what each item is and its colours, to be redrawn
better and not copied — and `cave-room.webp` and `tank-room.webp` for the world they are seen
in. After the first sheet comes back right, attach it to every later one as well, so the five
are one set.

**Why a grid, and why this size.** The game draws an item at 22 art pixels, its outline
included, on the same pixel grid as everything else, so the cell is asked for at about that
size — 24, so the item has a margin — and every cell is the same, so the sheet can be cut by
position. A generator gets one sheet of sixteen consistent where it loses a sheet of seventy-
six; the order within a sheet is fixed, so a cell's position is its item.

**The key colour** is magenta. Flesh is asked for as salmon and brick, never magenta or hot
pink, and every item has a dark outline, so the key meets only the outline. If a sheet comes
back with pink fringes on its violet or red items, generate that sheet again on green
(`#00FF00`), saying so in the BACKGROUND line.

---

## The prompt

Shared by every sheet: the `STYLE` block, then the sheet's own `ITEMS` block from below.

```text
GOAL
A sheet of 16 item icons for a pixel-art underwater roguelite, in the spirit of the item
sprites of The Binding of Isaac: each one a single small object, lit and outlined, that
reads at a glance from across a room. Every item is an organ or body part of a fish or
sea creature — a fin, an eye, a gland, a jaw — drawn as a thing in itself, not as a
symbol. The attached "items-sheet-current" image is this sheet's items as they are drawn
now, cell for cell in the same order: redraw each one as better pixel art, keeping its
subject, silhouette idea and main colours.

THE GRID (most important)
- 4 columns × 4 rows of cells. Each cell is exactly 24 × 24 art pixels.
- 4 art pixels of empty background between cells, and round the outside: the whole sheet
  is 116 × 116 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8 block:
  928 × 928 px.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller than
  one block. No dithering noise. Every block is one flat colour.

EACH ITEM
- Centred in its cell, filling about 20 × 20 art pixels of it, never touching the cell's
  edge: at least 2 art pixels of margin all round.
- A 1-block outline of near-black navy (#060912) round the whole silhouette, never thicker,
  and no outline colour inside the item except where two parts meet.
- Thin parts (rays, whiskers, stalks, quills) at least 2 art pixels thick.
- Light from the top left: lit top-left edges, darker bottom-right, each part shaded as its
  own rounded form in 3–4 shades of its colour. A single small highlight on round, wet or
  glossy things.
- Colours rich and readable against dark navy water (#0b1530): the items are the brightest
  things in a dark room. Flesh is salmon and brick red, never magenta or hot pink.
- Lights (photophores, lures, glows) are flat bright pixels with NO halo, bloom or light
  spill: the game adds the glow.
- Side-on or three-quarter, whichever reads best; the same view for parts of a kind (all
  fins side-on, all eyes facing out).

BACKGROUND
Flat pure magenta #FF00FF everywhere that is not an item, gutters included. Do not use
magenta, or any colour close to it, anywhere on an item.

AVOID
Text, numbers, labels, frames or borders round cells, drop shadows, a floor or pedestal under
items, scenery, bubbles or particles between cells, soft glows, painterly texture, noise,
sub-pixel detail, an item spilling into the next cell, two items in one cell, cells in a
different order than listed.

ITEMS (left to right, top to bottom)
«the sheet's ITEMS block from below»
```

---

## Sheet 1 — the strike: primaries, multishot, shot effects

```text
Row 1
1. Archer Spit — a single fat drop of clear blue water, round at the foot, drawn up to a
   point, a bright glint on its shoulder.
2. Spine Volley — three long ivory quills fanned out from one root, each with a dark
   reddish-brown socket at its base.
3. Mouthbrooder — a teal fish head on the left, its mouth open wide and dark, three tiny
   pale white-blue fry swimming out of it to the right.
4. Lunging Bite — two long ivory fangs hanging from a strip of teal gum.
Row 2
5. Parietal Eye — a big round eye, white with a teal iris and black pupil, and above it a
   small third eye: a dark socket holding a glowing gold lens.
6. Twin Spout — two drops of blue water side by side, the same size.
7. Four-Eyed Fish — two eyes stacked one above the other, split by a thin blue line of
   water between them.
8. Archer's Eye — a large eye with a gold iris, and a small blue water drop beside it at the
   bottom right.
Row 3
9. Quill Storm — five ivory quills fanned out from one root, wider than Spine Volley.
10. Hunting Nares — a teal snout with two dark nostrils, three short mint-green scent
    trails curling up and away from it.
11. Needle Jet — a long thin silver needle running diagonally across the cell, a small blue
    ring of water round it near the eye of the needle.
12. Brood Pouch — a cluster of seven pale pink roe eggs, each with a dark eye spot.
Row 4
13. Cavitation — a silver-white bubble ring, short blue burst lines flying out round it.
14. Galvanic Cells — a slate-blue cell like a small battery with a grey cap, a lilac
    lightning bolt beside it.
15. Vent Gland — a sulphur-yellow-green gland, round below and drawn up into flickering
    flame points above, a gold core.
16. Brine Gland — a six-armed pale ice crystal, icy blue-white.
```

## Sheet 2 — effects, actives, tears, range

```text
Row 1
1. Surface Halo — a flat gold halo ring seen from slightly above, four small gold-white
   glints falling beneath it.
2. Venom Barbs — a long ivory barb running diagonally, a single purple drop of venom at its
   point.
3. Neurotoxin — a round violet gland with a grey stopper on top, a yellow-green core
   showing through it.
4. Ink Sac — a dark violet-black sac with a gloss highlight, one drop of ink hanging under
   it.
Row 2
5. Electric Organ — a stack of four slate-blue plates, a gold lightning bolt beside them.
6. Inflation — a round yellow-green pufferfish ball covered in ivory spines, one eye.
7. Broad Pectorals — a broad translucent aqua fin fanned out from a small teal root, with
   blue fin rays.
8. Efficient Gills — three curved salmon-red gill arches side by side, each with a row of
   feathery filaments.
Row 3
9. Gill Rakers — a curved salmon-red arch with a comb of ivory teeth along its inside.
10. Segmented Trunk — a short chain of five round segments shrinking toward one end,
    alternating slate-blue and teal.
11. Crushing Pharynx — one broad flat molar, ivory, with a worn grinding top.
12. White Muscle Burst — a pale white-pink muscle spindle with a gold lightning bolt
    beside it.
Row 4
13. Ram Ventilation — three salmon-red gill arches with two blue water streams flowing in
    from the left.
14. Lateral Line — a silver fish-flank segment, a row of small glowing cyan pores along it.
15. Swim Bladder — a silvery two-chambered bladder, the bigger chamber behind, a short pale
    duct under it.
16. Barbels — a teal fish head side-on, facing right, three pale whiskers hanging from its
    chin with bright tips.
```

## Sheet 3 — shot speed, damage

```text
Row 1
1. Tapetum Lucidum — a large eye with a bright mirror-gold iris.
2. Pressure Gland — a round blue water sac wrapped by two salmon muscle bands, a short pale
   nozzle at its top right with a spurt of water.
3. Forked Caudal Fin — a small teal tail stalk ending in a big forked aqua tail fin with
   blue rays.
4. Fusiform Body — a sleek silver torpedo-shaped fish, side-on facing right, two thin blue
   speed lines along it.
Row 2
5. Siphon Jet — a coral-orange tube, its mouth dark, three blue water jets blasting out of
   its far end.
6. Hinged Jaw — an open jaw bone side-on, ivory, upper and lower halves with rows of small
   teeth.
7. Distensible Gullet — a round stretchy salmon-red pouch with a ringed coral mouth opening.
8. Serrated Teeth — one big ivory triangle tooth pointing down, notched saw edges.
Row 3
9. Parrot Beak — a parrotfish's fused beak: a slate-blue upper plate over a teal lower one,
   a dark line between.
10. Pincer Claws — a bright orange crab pincer: palm, the moving finger over the fixed one,
    and the gap between.
11. Vacuum Feeding — a salmon funnel-shaped mouth on a teal head, blue suction lines
    pulling in.
12. Gigantism — a big round teal fish, almost a ball, a small fin and eye.
Row 4
13. Rete Mirabile — a salmon-red muscle lump laced with a net of crossing blue and red
    vessels.
14. Apex Predator — a row of five big ivory shark teeth hanging from a strip of salmon gum.
15. Titan Jaws — a massive open jaw bone, slate-steel, rows of ivory teeth.
16. Mantis Strike — a mint-green mantis-shrimp arm ending in a heavy orange round club.
```

## Sheet 4 — speed, armour, deals and curses, healing

```text
Row 1
1. Dense Muscle — a brick-red muscle spindle with white tendons at both ends, fibres along it.
2. Red Muscle — the same muscle hotter and darker red, a few bright gold sparks in it.
3. Mucus Coat — a glossy mint-green slime blob dripping two drops.
4. Ganoid Scales — overlapping diamond-shaped scales in three rows, steel-blue enamel.
Row 2
5. Dorsal Spines — three ivory spines standing up off a strip of teal skin.
6. Coral Encrustation — a branching coral, pink-orange, rounded pale tips.
7. Anemone Frill — a fringe of short wavy pale-pink tentacles rising from a violet base.
8. Plated Carapace — a domed orange-brown shell, segmented by darker red bands.
Row 3
9. Stone Hide — a heavy grey stone shield, a dark crack across it.
10. Leaden Bones — a dark grey bell-shaped weight with a ring on top.
11. Brittle Frame — an ivory bone with a crack across its middle.
12. Devourer's Jaw — an enormous open ivory jaw, wide gape, long teeth.
Row 4
13. Blood Lamp — a deep red lamp-shaped organ hanging from a grey stalk, a hot glowing core.
14. Open Veins — a winding blue vein, one red drop of blood falling from it.
15. Regenerative Tissue — a cluster of three salmon-red cells with a bright green cross over
    them.
16. Symbiotic Algae — three tall green algae blades with a few pale glowing spots on them.
```

## Sheet 5 — sight, stealth, locomotion, apex

This sheet is 4 columns × 3 rows: change the grid's lines to "4 columns × 3 rows", "the whole
sheet is 116 × 88 art pixels" and "928 × 704 px".

```text
Row 1
1. Cnidocyte Graft — four violet stinging capsules, each trailing a thin lilac thread.
2. Photophores — a dark oval patch of skin set with three glowing cyan light organs.
3. Counter-Illumination — a silver fish side-on facing right, a row of soft blue lights
   along its belly.
4. Glass Body — a pale see-through fish side-on facing right, its ivory spine and ribs
   showing through.
Row 2
5. Illicium — a dark curved stalk ending in a glowing cyan lure bulb.
6. Deep Lantern — a longer dark stalk with a big glowing cyan lantern bulb.
7. Ampullae of Lorenzini — a dark patch of skin with a few black pores, faint lilac rings of
   an electric field round it.
8. Anguilliform Body — a long teal eel body in a smooth S-curve, a small eye at the head.
Row 3
9. Mantle Pump — a coral-orange squid mantle with two side fins and a big eye.
10. Lie in Wait — a grey mottled stonefish lump with coral-red warts and two eyes on top.
11. Abyssal Heart — a dark violet heart with a glowing blue core.
12. Leviathan Blood — a deep red drop of blood inside a thin gold ring.
```

---

## Before sending it back

- **The grid.** Zoom in: clean square blocks, the gutters empty and even, sixteen cells (or
  twelve) in the order asked. A sheet a little off its grid is fine; blur is not.
- **Each item** sits inside its cell with a margin, outlined, and is the item its position
  says.
- **Magenta is only the background,** and nothing glows.
- **Send the PNG,** not a screenshot. Several candidates of a sheet are welcome.

## The code side

Not built yet: the first sheet back is the time to write it. An importer beside
`scripts/import-sprite.mjs` that finds the grid as that one does, cuts the cells by position,
keys out the background from the cell edges inward up to the outline, and writes each item at
one pixel per art pixel to `src/render/items/«id».png`; `itemCanvas` in `render/itemart.ts`
then takes a sheet's picture where there is one and its painted drawing where there is not, so
the sheets can land one at a time. Check them on the board's *Mutation art* group and in the lab
(`/?lab=1`).
