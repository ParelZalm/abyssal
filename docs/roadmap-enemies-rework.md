# Roadmap: the enemies rework

Every enemy goes from painted (built from its genome by `render/creature/fishbake.ts`) to
drawn from a sprite (`content/sprites.ts`), one at a time, through the flow below. This is
the list: what is done, what can be done next, and what has to be built first. The how of
each step is in [sprites.md](sprites.md); this page is the order and the record.

**While the rework is under way, only reworked enemies are dealt into fights**
(`REWORKED_ONLY` in `content/sprites.ts`), so no room mixes the two styles. A tank with no
reworked enemy yet has its fight rooms open as soon as they are entered; since the archerfish
every tank has one. Bosses are dealt whatever they are drawn with, since a tank cannot lose its way
down. Set `REWORKED_ONLY` false to see the whole roster again.

**The enemy last reworked is tested on its own** (`NEWEST` in `content/sprites.ts`): the first
fight room entered in every tank holds it alone, one of it, scaled to that tank, so a run's
first fight is it; no other room deals it. Point `NEWEST` at each enemy as it comes in.

## The flow, for one enemy

| Step | Who | What | How |
| --- | --- | --- | --- |
| 1. Pick | both | the next *ready* enemy below | — |
| 2. Prompt | code side | fill in the two prompts for it and hand them over | [sprites.md › Stage A](sprites.md#stage-a--the-reference-sheet-design), [Stage B](sprites.md#stage-b--the-sprite-sheet-production), [Frames by role](sprites.md#frames-by-role) |
| 3. Design sheet | art side | generate Stage A, choose the design | [Stage A](sprites.md#stage-a--the-reference-sheet-design) |
| 4. Sprite sheet | art side | generate Stage B from the chosen design, check it, send the PNG | [Stage B](sprites.md#stage-b--the-sprite-sheet-production), [Before sending it back](sprites.md#before-sending-it-back) |
| 5. Import | code side | `npm run sprite`, fix pitch or the strike's box if the preview says so | [Import it](sprites.md#2-import-it) |
| 6. Wire | code side | `SOURCES`, `SPRITES` (with the import command in its comment), `drawn`, `NEWEST` | [Wire it](sprites.md#3-wire-it), [Size](sprites.md#size) |
| 7. Check | code side | the board, a tank, the hitbox, the lights | [Check it](sprites.md#4-check-it) |
| 8. Commit | code side | sheets, frames, tables, and the row below marked done, in one commit | [Commit](sprites.md#5-commit) |

Step 3 can be skipped when the design is already settled; the Stage B prompt then takes the
style sheets and a description instead of the animal's own Stage A sheet.

## Status

**done** is in the game from a sprite. **prompted** has its prompts written and waits on the
art. **ready** can go through the flow now. **blocked**
needs the code named in *Blocked on* first.

### Deep tank

| Enemy | Plan · role | Frames | Status | Notes |
| --- | --- | --- | --- | --- |
| Anglerfish | angler · turret | rest, strike (jaw) | **done** | drawn 2; `angler.webp`, `angler-sprite.webp` |
| Gulper Eel | eel · charger | rest, strike (jaw and pouch) | **done** | drawn 1, already 3.7 tiles long; `gulper.webp`, `gulper-sprite.webp` |
| Barracuda | eel · charger | rest, strike (jaw) | **done** | drawn 1.6; dashes from 10 tiles (`reach`) and leaves a streak of light (`streak`); its sheet bled magenta round the outline (`--fringe`); `barracuda.webp`, `barracuda-sprite.webp` |
| Siphonophore | jelly · drifter | rest | **done** | drawn 4; one frame; its bells alone squeeze on the pulse and squirt from their mouths (`bells`); its tentacles are in its hull; `siphon.webp`, `siphon-sprite.webp` |
| Vampire Squid | squid · spitter | rest, strike (mouth) | blocked | rigged arms |

### Reef tank

| Enemy | Plan · role | Frames | Status | Notes |
| --- | --- | --- | --- | --- |
| Ribbon Eel | eel · charger | rest, strike (jaw) | **done** | drawn 1, already 3.8 tiles; on green (`--key green`); hull the body without its fins; `ribbon.webp`, `ribbon-sprite.webp` |
| Triggerfish | darter · spitter | rest, strike (mouth) | **done** | drawn 2; spits from its drawn mouth (`mouth`); hull the body without its fins; `triggerfish.webp`, `triggerfish-sprite.webp` |
| Lionfish | darter · turret | rest, strike (spines up) | **done** | drawn 2; its spines rise as its tell, the frames padded 38 cells for them; hull the body under the spines and fans; `lionfish.webp`, `lionfish-sprite.webp` |
| Moon Jelly | jelly · drifter | rest | **done** | drawn 3; one frame; its bell alone squeezes (`bells` with no jets); its gonads are its lights; `moonjelly.webp`, `moonjelly-sprite.webp` |

### Nursery tank

| Enemy | Plan · role | Frames | Status | Notes |
| --- | --- | --- | --- | --- |
| Archerfish | darter · spitter, `volley` | rest, strike (mouth) | **done** | drawn 1.6; its strike taken from the head only (`--keep`); its volley leaves its drawn mouth (`mouth`); `archerfish.webp`, `archerfish-sprite.webp` |
| Mackerel | darter · charger, `pack` | rest, strike, wounded, wounded strike | **done** | drawn 1, as big as the archerfish already; the first through with a wounded pair, the frenzy flushed red with its first dorsal up; on green, its back steel blue; drawn at 3.5 image pixels to the art pixel (`--pitch 3.46`), and the green bled into the red outline as a brown (`--fringe 30`); hull the body without its fins; `mackerel.webp`, `mackerel-sprite.webp` |
| Pufferfish | darter · turret, `balloon` | rest, strike, wounded, wounded strike | **done** | drawn 1.6; a porcupinefish, deflated at rest with its puff the mesh's swell, turned drawn blown up with its spines standing; drawn at 3.2 image pixels to the art pixel (`--pitch 3.2`); the ball drawn shorter, so its strike takes the beak alone (`--keep-wounded`); hit on its body, and turned on the ball (`woundedHull`); `pufferfish.webp`, `pufferfish-sprite.webp` |
| Sea Nettle | jelly · drifter, `bloom` | rest, wounded | **done** | drawn 3, as the moon jelly is; a Pacific sea nettle; its sheet came with the rest alone, and its wounded is the rest recoloured hot through the Stage A palette's two rows (`--wounded-palette`); drawn at 7.5 image pixels to the art pixel (`--pitch 7.5`); its bell alone squeezes (`bells` with no jets) and its tentacles wave (`trail`); one warm light in the bell; its ephyrae bud from the sprite; `nettle.webp`, `nettle-sprite.webp` |

### Bosses — later

| Boss | Tank | Why later |
| --- | --- | --- |
| Mantis Shrimp | nursery | **done**: the fight reads the club only as the hull's nose, set on the folded heel by hand; the strike frame is the club cocked, its tell; the legs walk in the skin (`SpriteArt.legs`); `mantisshrimp.webp`, `mantisshrimp-sprite.webp` |
| Great White | reef | its fight reads its snout and its tells off the plan |
| Giant Squid | deep | its arms are rigged and torn off one at a time |

## Blocked on

Code to write before a blocked enemy can go through the flow. Each unblocks the rows that
name it.

- ~~**A wounded frame.**~~ Done: a sprite takes a wounded pair, *wounded* and *wounded
  strike* (a drifter the first alone), imported from the same sheet and swapped in for good
  when the hostile turns at half health (`Roles.turn`, `bakeSprite`). The wounded strike keeps
  the tell on a turned animal. The board's turned cells show the pair. Unblocked the mackerel,
  pufferfish and sea nettle.
- **Rigged arms.** A squid plan's arms are strips of their own (`armRig` in
  `render/creature/fishbake.ts`) that reach and grab. A sprite needs the arm as its own image
  and the rig to use it. Unblocks the vampire squid, and later the Giant Squid.

## Order

1. **Deep tank first:** the barracuda, then the siphonophore (both done). The darkest water carries the
   art direction's lights best, and the two done already set the style to match.
2. **The reef** next, whole (done): its four enemies, from the prompts in
   [sprite-prompts-reef.md](sprite-prompts-reef.md).
3. **The nursery's archerfish** (done), so the first tank has a fight again, from
   [sprite-prompts-nursery.md](sprite-prompts-nursery.md).
4. **A wounded frame**, then the mackerel, pufferfish and sea nettle (all done): the nursery is
   through.
5. **Rigged arms**, then the vampire squid.
6. **Bosses**, each a question of its own.
7. **`REWORKED_ONLY` comes out** once no fight room is short of enemies.
