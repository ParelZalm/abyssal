# Abyssal

A top-down fish-evolution roguelite for the browser — the opening act of *Spore*, played
as a run: hatch small, eat what fits down your throat, mutate every time you grow, and
swim nine kilometres down to whatever is waiting at the bottom.

## Stack

| Piece | Choice | Why |
| --- | --- | --- |
| Renderer | **PixiJS 8**, pinned to WebGL | Fast 2D batching for hundreds of animated creatures, plus a hand-written GLSL fragment shader for the water. |
| Build | **Vite** | Instant HMR, zero-config TS, tiny static output. |
| Language | **TypeScript** (strict) | The genome/trait system is the whole game — it wants types. |
| UI | **DOM + CSS** over the canvas | Menus, cards and bars are far cheaper and more accessible as DOM than as canvas widgets. |
| Deps | none beyond Pixi | No engine, no physics lib — the simulation is ~700 lines. |

## Run it

```bash
npm install && npm run dev
```

`npm run build` type-checks and emits a static bundle to `dist/`.

## How it plays

- **Move** with `W` to drive, `S` to brake and then back up, `A`/`D` to swing the body —
  or steer with the mouse instead, which scales effort by cursor distance. The fish runs on
  swim physics rather than a velocity you set: thrust goes along the body axis, lateral drag
  is roughly three times forward drag, so turns arc and releasing `W` coasts. Thrust is a
  **stroke** locked to the same phase that sways the tail, so you surge and glide; flaring to
  stop bites much harder than coasting does. Hold **Space**, **Shift** or **click** to boost:
  it opens with a real impulse and then winds up over about a second to roughly double cruise
  speed for as long as you hold it, burning fullness throughout. **P** pauses.
- **Biting** throws the body forward and squashes it — the animal compresses along its
  length, flares across it, and snaps back, while the frame drops into a few hundredths of a
  second of slow motion and a shock ring goes out from the wound.
- **Jellies heal you.** A moon jelly returns 30% of your maximum health and a siphonophore
  45%, which is the reason to take a stinging mouthful when you are hurt.
- **Eat** anything smaller than your gape. Your mouth reaches ahead of your body, and small
  prey inside that cone gets pulled in — chasing a speck around with a pixel-perfect hitbox
  is not fun. Prey under half your gape goes down whole; anything closer to your own size is
  a fight you can lose.
- **The shallows are the tutorial.** Above 1000 m plankton spawn thicker — in blooms of six
  to eleven rather than singly — and hunters and ambushers are thinned to about 40% of their
  usual share, so a hatchling opens on roughly a hundred edible things and a couple of
  threats. Both effects fade to nothing by 1000 m.
- **Fullness** drains constantly, faster as you get bigger — metabolism is a real cost,
  so size-stacking traits have a downside.
- **Biomass** fills the third bar. Each stage offers three of **33 mutations** from a
  rarity-weighted pool, and rarity carries real weight in both senses. Mechanically the
  tiers are far apart — a common is +18% speed, an apex is +110% bite or +9 armour — and
  the odds climb only for the good stuff, from 75/25/0 common·rare·apex at stage 1 to
  48/41/11 by stage 8. Visually the card's edge light tells you before you read it: commons
  are unlit, rares carry a cold blue glow, apex cards breathe amber. Any one mutation can be
  taken at most twice, so a run specialises without collapsing into one stat.
- **Organs.** A handful of reef mutations grow parts rather than numbers, and each carries a
  mechanic and a piece of morphology together: an **Illicium** hangs a lit lure on a stalk
  and prey genuinely swims toward it; **Venom Barbs** leave poison working in a wound after
  the mouth has let go, and a kill it finishes is still credited to you; **Pincer Claws**
  hold what they hit; a **Siphon Jet** makes the boost harder and cheaper; **Coral
  Encrustation** and an **Anemone Frill** plate and fringe you. You can see every one of
  them on your body.
- **Pause is your inventory.** `P` opens a sheet with the whole animal: derived body stats
  (health, bite, sense, gulp reach, metabolism), a breakdown of every organ with what it
  actually does, and the full mutation list with icons, rarity and descriptions.
- **Tiers** stack the ocean into five sealed layers, each its own ecosystem — creatures now
  hold to their own depth band rather than roaming the whole column. A thermocline seals the
  floor of each tier and only opens once your body reaches its entry size:

  | Tier | Depth | Entry size |
  | --- | --- | --- |
  | Sunlit Shallows | 0 – 1300 m | — |
  | Reef Shelf | 1300 – 3000 m | 26 cm |
  | Twilight Zone | 3000 – 5200 m | 52 cm |
  | Midnight Zone | 5200 – 7400 m | 96 cm |
  | The Abyss | 7400 – 9000 m | 160 cm |

  A sealed tier is rendered in shadow — you can see into it, you cannot be in it — with the
  barrier casting a contact shadow on the water beneath, and the entry requirement written
  on the seal itself in glowing text that rides its screen position. Push against it and it
  holds you. Breaking through plays a tier card and grants a **free mutation**, and each
  tier reached also widens the draft pool toward rare and apex traits — so depth upgrades
  you, not just biomass.
- **Every tier is its own biome.** Colour alone was too weak a cue, so each tier now has a
  weather of its own — the cloud field, the light and the suspended matter are all driven by
  a per-tier profile, cross-faded over 620 m either side of a thermocline so a dive never
  steps. The shallows are busy and crisp, shot through with god rays, and fizz upward with
  bubbles. The reef is thick warm sediment dragged sideways by a steady current. The
  twilight is thin, cold and nearly empty, with the first marine snow falling through it.
  The midnight zone is black and still, and the only light in it is alive — sparse plankton
  hanging there and pulsing. The abyss has vents underneath: slow enormous masses, a
  red-violet cast, and embers rising out of the dark. Below the twilight the water lights
  itself in the biome's own colour, because a column tint that is nearly black cannot tell
  two dark tiers apart.
- **Depth** is difficulty. Light falls off with depth, and below the twilight zone you see
  only what your `sense` stat and other creatures' bioluminescence reveal. The Leviathan
  spawns once you reach the Abyss tier; killing it wins the run.

## Mutations

The HUD shows what you are made of as a grid of **marks rather than names** — a stroke glyph
per mutation, tinted by rarity, with a stack badge and the full name and effect on hover.
Two of the newer mutations reach into the simulation rather than just scaling a stat:
`gulp` widens the cone that draws small prey into your mouth, and `lifesteal` returns a
share of everything you swallow as health.

## Fear

Every animal has a **menace** score derived from its genome — jaw, spines, bite, bulk. It
drives the art directly: the body mass darkens, the edge runs hot, the sensory arcs go from
cold blue to ember, blades grow along the flanks, and a bruised red bloom builds around it.
Your own fish crosses the same thresholds as you take apex mutations, so becoming the thing
other fish flee from is something you watch happen to your body.

Running the other way, anything that can swallow you washes red as it closes, and the water
itself reacts: proximity measured **between bodies rather than between centres** — a
leviathan is close long before its centre is — feeds a `uDread` uniform that desaturates the
frame, crushes the edges and pulses a dark red vignette.

## Performance

The frame budget is spent almost entirely on the GPU, and it was measured rather than
guessed — at 3× normal population the frame was 10.8 ms median / 25.6 ms p90, but 8.2 ms
with the water hidden and 8.3 ms with the creatures hidden, which said the full-screen
shader and the per-creature draws were each large enough that together they blew the
budget. Four changes, in order of what they bought:

- **The water shades at 0.4 resolution.** It is all low-frequency fog, so a quarter of the
  fragments is indistinguishable once upscaled. This was worth roughly 5 ms on its own.
- **The noise hash lost its `sin`.** A transcendental in the inner loop of a 4-octave FBM
  called five times per pixel is the most expensive thing in the shader; the sin-free hash
  looks identical.
- **Octave counts are graded** — four for the main cloud field, three for the warp and the
  wide rays, two for fine detail and thin rays — and the deep-water field reuses noise that
  has already been computed instead of paying for another FBM. Two limits found the hard
  way: the main cloud field must keep four octaves (at three it loses its high frequencies
  and `smoothstep` turns it into hard-edged slabs), and the reuse has to be a *continuous*
  remap — an early version used `fract()`, which is a sawtooth and drew its wrap as a seam
  straight across the water.
- **Off-screen creatures skip their art entirely** (they still swim, hunt and get eaten),
  and motes and particles are sprites off one shared texture so a whole fight batches into
  a single draw call.

Result at normal load: **8.3 ms median, 9.3 ms p95** while actively hunting — pinned to a
120 Hz display. At 3× population the median is 8.8 ms, down from 10.8.

## Notes for contributors

Implementation notes live in [`docs/`](docs/README.md) — architecture, simulation,
progression, rendering, performance, and a log of what has already been tried and
undone. [`CLAUDE.md`](CLAUDE.md) is the short version, aimed at agents.

## Code map

| File | Responsibility |
| --- | --- |
| `src/game/genome.ts` | The stat block every creature, player included, is built from. |
| `src/game/traits.ts` | The mutation pool and the rarity-weighted draft. |
| `src/game/species.ts` | Species table: 18 species — depth bands, sizes, behaviour, body plan, nutrition. |
| `src/game/tiers.ts` | The five stacked tiers, their size gates and the descent limit. |
| `src/game/fishview.ts` | Eight top-down body plans, drawn from the genome and animated by transform. |
| `src/game/world.ts` | Simulation — steering, perception, schooling, contacts, biting. |
| `src/game/biomes.ts` | Per-tier visual identity: cloud, light and what drifts in the water. |
| `src/game/scenery.ts` | Parallax soft props behind and in front of the creatures. |
| `src/game/props.ts` | Disc / blob / mass / wisp textures for the scenery bands. |
| `src/game/water.ts` | The GLSL water: fog, thermoclines and the tier below, as one full-screen filter. |
| `src/game/ocean.ts` | Suspended particulate drifting past the camera. |
| `src/game/fx.ts` | Pooled particles — sprites for dots, Graphics only for rings. |
| `src/game/textures.ts` | The two shared canvas textures everything batches against. |
| `src/main.ts` | Loop, camera, input, progression, run state. |
| `src/ui/UI.ts` | DOM UI facade — HUD chrome + overlay screens. |
| `src/ui/icons.ts` | The abstract glyph set mutations are shown by. |

## Look

Everything is seen from directly above, and each species picks one of eight **body plans**
— microbe, darter, shark, eel, jelly, squid, angler, leviathan. A plan decides both the
silhouette and how the thing swims: a jelly contracts its bell and trails tentacles, an eel
runs a five-link chain down its whole body, a shark holds a stiff torpedo and barely sways,
an angler hangs a lit lure out in front of a wall of teeth. Within a plan the genome still
does the work, so a mutation that changes your jaw, spines or glow changes how you actually
look in the water.

Every body is built from the same four rules, so a creature stays legible against water
that is nearly its own colour:

- **A heavy near-black outline with a thin lit rim inside it**, drawn as two strokes on
  one path — the wide dark one first, the narrow bright one over it. The outline is what
  separates an animal from the water; the rim is what stops the silhouette reading as a
  hole punched in the frame.
- **Segmented volume down the tail.** Each link of the chain outlines its two long edges
  only — stroking the closed path draws the joint caps too, and those land as straight
  lines across the body — plus a lit crescent along one flank, which is the only cue a
  flat top-down shape has for being round.
- **Grown parts are seated, not stuck on.** A claw arm, a venom barb and an illicium each
  start from a socket: a dark seat with a lit ring. The arm carries a highlight down its
  top and the working end — the claw tip, the barb's wet point, the bait — is the
  brightest thing on it, so a build reads by its parts at a glance.
- **Fins are membranes**: translucent fills with a lit edge, rather than flat shapes.

The water itself is a single full-screen GLSL pass: domain-warped FBM for the drifting
organic masses, a depth-sampled palette, **god rays** cut from noise along a slanted axis so
they lean the way light refracts and thin out as the column swallows them, your own
bioluminescence, and the thermoclines. Because the seal and the tier beneath it are shaded from world coordinates,
**the next depth level is visible below you at all times** — you look down into a darkening
trench, a luminous shear surface, and the colder water and larger silhouettes waiting past
it, long before you are big enough to go there.
