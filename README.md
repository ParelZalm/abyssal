# Abyssal

https://github.com/user-attachments/assets/211267d9-5ab7-45c0-9060-ae5d542e15cc

**A fish-evolution roguelite for the browser.** Think of the opening act of *Spore*,
played as a single run. You hatch small, eat whatever fits down your throat, mutate
every time you grow, and swim nine kilometres down to whatever is waiting at the bottom.

> **In rework.** On `rework/gameloop` the open column is becoming a chain of aquarium
> tanks made of one-screen rooms, played like *The Binding of Isaac* — see
> [ADR 0003](docs/adr/0003-tanks-of-rooms-replace-the-column.md) and
> [the roadmap](docs/roadmap.md). The controls below are already the new ones; the rest
> of this page describes the column game on `main`, and is rewritten when a whole tank
> plays through.

## The game

The ocean is stacked into five zones, each its own ecosystem and each sealed from the
one below by a **thermocline**. A seal opens for one thing only: a body big enough to
pass it. Exploring does not open the deep. Growing does. Every zone down is darker,
emptier and more dangerous, and it holds rarer mutations.

### The goal

Reach **the Trenches** and kill **the Leviathan**. That wins the run and adds 5,000
to your score. Most runs end earlier. Something bigger finds you, you starve, or you
force a seal you were not ready for and the pressure crushes you. The end screen then
tells you what killed you, how deep you got and what you had become. It shows your
**lineage**, a row of your body at every stage of the run, and the cards you were one
pick short of. That list is what turns the next run's first draft into a plan.

### A run, minute to minute

1. **Eat.** Anything smaller than your gape is food. Small prey inside the cone ahead of
   your mouth gets pulled in. Prey under half your gape goes down whole. Anything close
   to your own size is a fight you can lose. Kills made back to back build a **chain**
   that multiplies both biomass and score.
2. **Grow.** Biomass fills a bar. When it is full you grow and pick one **mutation** from
   a draft of three.
3. **Stay fed.** Fullness drains all the time, and faster the bigger you get, so
   stacking size has a price. Jellies sting, but eating one gives back a big share of
   your health.
4. **Go down.** Once you are big enough, the thermocline below you parts. Breaking into
   a new zone shows its card and gives you a free draft. Stay too long in water you have
   outgrown and it stops feeding you: food thins out and something is sent up to hunt
   you.
5. **Force it, if you dare.** If you are within 70% of a gate, you can boost into the
   seal and break through early. It costs a third of your health, and the water keeps
   crushing you until you grow into it or swim back up.

### The ocean

| Zone | Depth | Opens at | Guardian | What it is like |
| --- | --- | --- | --- | --- |
| **Sunlit Zone**: Open Water | 0 m | — | Great White | Bright and crowded, shot through with god rays. The tutorial: thick with plankton, few hunters. |
| **Sunlit Zone**: Reef Shelf | 40 m | 26 cm | | Thick, warm, sediment-heavy water pushed sideways by a current. Where most organs are found. |
| **Twilight Zone** | 100 m | 52 cm | Giant Squid | The last of the light. Cold, thin, nearly empty, with the first marine snow falling. |
| **Midnight Zone** | 1,000 m | 96 cm | Sperm Whale | No light at all. The only glow is alive. You find prey by feel, or not at all. |
| **The Abyss** | 4,000 m | 160 cm | Colossal Squid | Cold and barren. Nothing but snow falling out of the dark above. |
| **The Trenches** | 6,000 m | 240 cm | **Leviathan** | Hot vents below, a red-violet cast, embers rising. Something enormous has been waiting. |

Each zone has one **guardian**. It is not prey, and it is not a gate either. It ignores
you while you are small. Once you have grown into its zone, it takes an interest. Every
guardian has its own attack pattern: the Great White lines up and charges, and the Sperm
Whale clicks to stun whatever is in front of it. Killing a guardian clears it from the
zone for the rest of the run. Only the Leviathan ends it.

Light falls off with depth. Below the twilight you see only as far as your `sense` stat
reaches, plus whatever glows on its own. Anything that could swallow you washes red as
it closes. The frame then darkens, desaturates and pulses: that is the *dread*, and it
is measured between bodies, not between centres. A leviathan is close long before its
centre is. Thirty-six species live in the column, and each one you eat goes into the
**codex**.

### Becoming something else

- **53 mutations** in three rarities: common, rare and apex. Rare and apex cards get
  likelier the deeper you are and the further the run goes. A card's edge light tells
  you its rarity before you read it. Any one mutation can be taken twice at most, so a
  run specialises without collapsing into a single stat.
- **The draft is the water you are in.** A reef organ first turns up on the reef, and
  an abyss mutation in the abyss. The draw also leans toward the build you already
  have. A reroll costs fullness.
- **Organs grow parts, not numbers.** Each organ comes with a mechanic and a piece of
  morphology together. An **Illicium** hangs a lit lure that prey swims toward.
  **Venom Barbs** keep working after you let go. **Pincer Claws** hold what they hit.
  A **Siphon Jet** makes the boost harder and cheaper. **Ink Sac**, **Electric Organ**
  and **Inflation** are active organs you fire by hand. Every one of them shows on your
  body.
- **Transformations.** Take three different mutations from one family and your whole
  body plan changes: Predators become a **Shark**, Sprinters a **Squid**, Lurkers a
  **Moray**, the Luminous an **Angler**, Grazers a **Bloom**. Each form swims
  differently and earns an organ of its own.
- **Synergies.** Nine hidden combinations of organs do something that neither organ
  does alone. Lure plus venom poisons prey before you bite (*Toxic Lure*). Jet plus
  claws turns a boost into a battering ram (*Ballistic*). You find them in play, not
  on a card, and the codex keeps the ones you have found.
- **Menace.** Jaw, spines, bite and bulk add up to how frightening an animal looks. The
  art reads that score directly: the body darkens, the edges run hot, blades grow along
  the flanks. You cross the same thresholds as everything else, so becoming the thing
  other fish flee from is something you watch happen to your own body.

### Between runs

The codex remembers every species you have eaten, every mutation you have taken and
every synergy you have found, across runs. Reaching a zone for the first time unlocks a
**starting form** for later runs: the *Reef Wrasse*, *Lanternfish*, *Angler Larva* or
*Squid Paralarva*. Each one hatches with that zone's signature mutation already taken.
The **Daily** run is one seeded ocean shared by everyone on the same date. Any other
run can be replayed or shared with `?seed=`.

### Controls

| | |
| --- | --- |
| Swim | `W` `A` `S` `D`, diagonals included. |
| Strike | The arrows, one of four ways. Left and right turn you to face it; up and down bite above or below your head. Holding one keeps you facing it while you swim, so you can back away from what you are biting. |
| Active mutation | `Space`, once you have one. |
| Item | `E` (nothing to hold yet). |
| Pause | `P` or `Esc`. The pause sheet is your inventory: body stats, every organ and what it does, and the full mutation list. |
| Sound | `M` |

The fish runs on swim physics, not a velocity you set. Thrust goes along the body, and
sideways drag is about three times forward drag, so turns arc and letting go of `W`
coasts. Each stroke is locked to the tail's sway, so you surge and glide.

## Stack

| Piece | Choice | Why |
| --- | --- | --- |
| Renderer | **PixiJS 8**, pinned to WebGL | Fast 2D batching for hundreds of animated creatures, plus a hand-written GLSL fragment shader for the water. |
| Build | **Vite** | Instant HMR, zero-config TypeScript, a tiny static output. |
| Language | **TypeScript** (strict) | The genome and trait system is the whole game. It wants types. |
| UI | **DOM + CSS** over the canvas | Menus, cards and bars are far cheaper and more accessible as DOM than as canvas widgets. |
| Type | **Pixelify Sans**, bundled via `@fontsource` | The HUD sits over a pixel-art frame, so it speaks in pixels too; bundled so nothing is fetched at runtime. |
| Deps | none beyond Pixi and the font | No engine and no physics library. The swimming, the ecosystem and the fights are all in `src/sim/`. |

## Development

```bash
npm install
npm run dev      # the game, with HMR
npm run design   # the design board at /design.html
npm run build    # tsc --noEmit && vite build: the only gate
```

There is no test suite and no linter. `npm run build` type-checks in strict mode, and
passing it is what "it works" means here. Almost every change is visual, so the real
check is looking at it. In dev builds the `Game` instance is exposed as `window.game`,
so you can drive a run from the console. [`CLAUDE.md`](CLAUDE.md) has the recipe.

**Launches** start a run past the title, in any tank and any room of it:
`/?tank=reef&room=boss&god=1` is the Great White with nothing to lose. The keys are
`tank` (nursery, reef, deep), `room` (start, fight, treasure, shop, deal, boss), and the
flags `dropin`, `god`, `calm` (no hostiles), `rich`, plus `start`, `traits` (mutation ids,
comma-separated) and `seed`. *Again* on the end screen replays the launch. In the game, the
backquote key opens the dev panel, which has every launch and can act on the run under way: clear the room, go to any room of
the tank, go down to the next tank, give a mutation, and toggle god mode.

**The design board** (`/design.html`, dev only) lays out every drawing the game makes:
the rooms and their decoration, the hostiles and bosses, pickups and pedestals, every
body plan, every mutation taken once on the hatchling, and the water palettes, sorted in
its sidebar by what they belong to. Each one is drawn over the real water colour at its
own depth. It imports the shipping drawing code, so it cannot drift from the game. The
URL carries the whole state, so a link to one cell is a link to one design question.

### How it is drawn

- **Pixel art, side-on.** The frame is drawn at half resolution and scaled up with hard
  pixels, then quantised onto a dithered palette, so everything shares one grid. Every
  creature is painted per pixel in profile. Each species uses one of the body plans:
  microbe, darter, shark, eel, jelly, squid or angler. The wraith is the plan you hatch
  as, and every guardian gets a body nothing else wears. A plan decides both the
  silhouette and how the animal swims. Within a plan the genome still does the work.
- **Creature art is baked once and skinned.** A body is painted into a texture on every
  `rebuild(genome)`. Swimming moves mesh vertices, never geometry, so a hundred animals
  cost a few vertex writes each.
- **Nothing on an animal is stroked.** A contour has a position of its own, so it draws
  twice wherever two parts cross. The pixel outline is read off the finished silhouette
  instead, with a rim lit from the surface, a hue-shifted ramp and an ordered dither.
- **The water is a single full-screen GLSL pass.** It combines domain-warped FBM, a
  depth-sampled palette, god rays, your own bioluminescence and the thermoclines, all
  shaded from world coordinates. So the next zone is always visible below you, long
  before you are big enough to go there.
- **Performance was measured, not guessed.** The water shades at 0.4 resolution, its
  noise hash has no `sin`, octave counts are graded per layer, and off-screen creatures
  skip their art. At normal load that holds about 8 ms a frame. See
  [`docs/performance.md`](docs/performance.md).

### Code map

The folders are layers, and imports only point down them. See
[`docs/architecture.md`](docs/architecture.md) for the full map.

| Folder | Responsibility |
| --- | --- |
| `src/main.ts`, `src/Game.ts` | Boot; the loop, the reset, and routing what the simulation did to the systems it concerns. |
| `src/core/` | Seeded RNG, maths, colour and value noise. No game knowledge. |
| `src/content/` | The tables: genome, species, zones and bands, traits, transformations, the body form. |
| `src/sim/` | The simulation: `World`, `Creature`, spawning, behaviour, guardian patterns, combat, and every organ's mechanic in `sim/organs/`. |
| `src/run/` | One run's record and the systems that move it: evolution and the draft, metabolism, the bands and their gates, the ending, the codex. |
| `src/input/` | The keyboard, and the player's swim, strike and active mutation. |
| `src/render/` | Camera, scene visibility, the GLSL water, particulate, scenery, particles. `render/creature/` bakes and skins the fish. |
| `src/ui/` | The DOM UI facade: HUD chrome, overlay screens, and the glyphs mutations are shown by. |
| `src/dev/` | Launches and the in-game dev panel. Dev only. |
| `src/design/` | The design board at `/design.html`. Dev only. |

### Further reading

Implementation notes live in [`docs/`](docs/README.md): architecture, simulation,
progression, rendering, performance, a roadmap, and a log of what has already been tried
and undone. Read [`docs/decisions.md`](docs/decisions.md) before rebuilding anything that
looks missing. [`CONTEXT.md`](CONTEXT.md) is the glossary, and [`CLAUDE.md`](CLAUDE.md)
is the short version, aimed at agents.
