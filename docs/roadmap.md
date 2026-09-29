# Roadmap: making the run more fun

What is left from the fun pass of September 2026. The organ registry, the first synergy
(Toxic Lure, mechanic and paint) and the design board rework are done. Each item below
says where it lands in the code and what it depends on.

The core diagnosis still holds: the presentation and the simulation are strong, the
*decision layer* is thin. Every item is ranked by how much it adds to choices in a run,
or to a reason to start the next one.

## 1. More synergies (cheap)

Done so far: Toxic Lure, Ghost Light, Urchin, Nematocyst, Ballistic, Vivisect, Drifting
Bloom, Whale Shark. Ballistic brought the boost seam (`Creature.boosting`, opened by
`kick()`) and `World.hit`, a non-bite blow, so a synergy can now act on the boost or strike
with something other than the mouth. Vivisect brought the bleed (`Creature.bleed`, ticked
in `Combat.bleedOut`), which drips blood a hunter can follow.

Each one is three touches, all following Toxic Lure:

1. An entry in `src/sim/organs/synergies.ts` with a `name` and a two-field `when`. Effect hooks
   return `true` on a frame they acted, which fires the first-time toast.
2. A branch in the matching painter in `src/render/creature/bake/`, guarded by
   `hasSynergy(g, id)`. Fills only, no strokes.
3. A cell in the `BUILDS` list in `src/design/catalog.ts`.

Check the `when` against the roster too: `species.ts` gives NPCs claws, glow, sense and
translucency, and a synergy one of them qualifies for repaints it. If a pair has no organ
field on one side, add a morphology field for the trait (as `serrate` was for Serrated
Teeth) rather than thresholding a stat several cards raise.

The table is done: Flash Sense came last, keyed on the `electro` field once Ampullae
became the electroreception organ, since a threshold on `glow` and `sense` would have
repainted the Leviathan. More pairs are for the next pass over the pool.

Watch: a synergy with a `burn` or `boost` modifier needs no event and cannot return
`true`, so it will never toast. Whale Shark toasts because its wake is an `onTick` that
returns true when it pulled something; a pure modifier synergy still needs that.

## 2. ~~Transformations (Isaac's Guppy)~~

Done: `content/forms.ts`, five families (armoured dropped — every plated plan is a
guardian's), three different traits of one family. Each form is a plan the roster draws,
with the wraith's smoke kept on it, plus a grant of existing organs (the Shark's `frenzy` is
new). See `docs/progression.md`. Since done: how the ocean reads a transformed player —
hunters of the form's plan take it for kin and leave it be above half health, then turn on
it (`Creature.spares`) — and a second form in a long run, a new family at four traits, with
the grants stacked.

## 3. ~~The draft reads synergies~~

Done in `run/prospects.ts`: the completing card's second light and note, a lean of ×1.5
toward completing cards and ×1.15 toward begun families, a reroll paid in fullness at a
climbing price, and the end screen's "one card short of". A banish was left out — the
reroll already makes the draft a resource choice, and a banish needs a run-long exclusion
list the pool does not have yet. With only four synergies the lean mostly serves forms;
it gets more interesting as synergies are added (§1).

## 4. Depth as a choice, not a ladder

Gates are size-only, so the optimal play is to grind the shallows until the gate opens.

- ~~**A clock in the shallows.**~~ Done as `spendWater`: a band spends once its gate
  below is open and the player stays. The arrival is the least hunter that can eat you
  (a Mackerel in Open Water at 30 cm, not a shark), and past the Reef there is none, so
  deeper bands only thin. If that is too gentle, a band could wake its guardian instead.
- ~~**A tempting pocket below each gate.**~~ Done: `Spawner.pocket` holds a shoal of the
  lower band's food just under a shut seal, in view.
- ~~**Squeezing through undersized.**~~ Done: from 70% of a gate, boost into the seal for
  a second; it costs 30% of health and 1.5% a second, with no regeneration, while too small.

## 5. Builds that play differently

Most of the pool is multipliers, which converge on one optimal fish. New organs that
change *what you do*, each an entry in `sim/organs/` plus paint:

- ~~**Diet.**~~ Done: Gill Rakers (`filter`) and Crushing Pharynx (`crush`), with the
  `gulp`, `damage`, `biteRate` and `recoil` hooks they needed. Jellies do not sting in
  the simulation, so "eats jellies safely" had nothing to protect against; the crusher's
  safety is from spines and frill. The two can be taken together; if a mouth should be one
  or the other, the draft needs an exclusion rule it does not have.
- ~~**Locomotion.**~~ Done: Anguilliform Body (`eel`), Mantle Pump (`mantle`) and Lie in
  Wait (`lurk`), through a `swim` hook on `Creature.propel` and a `stealth` hook. No
  species carries them yet; the Ribbon Eel and the Anglerfish are the obvious first
  NPCs to give them to, once the player versions have been played.
- ~~**Sense modes.**~~ Done: `sightOf` dims the eye with the light, Tapetum's
  `eyeAdapt` wins it back, and `electro` (Ampullae) feels the living at short range in any
  water, the wounded from twice as far. Flash Sense sits on top.
- ~~**Costs on apex cards.**~~ Done: every apex card carries a turn, speed or metabolism
  price in its text.
- ~~**Cursed cards.**~~ Done: Blood Lamp (+90% bite, `glare`) and Brittle Frame (speed and
  turning, `brittle`). More curses belong here as the pool grows.
- ~~**One active organ slot.**~~ Done: Ink Sac, Electric Organ and Inflation, one at a
  time, on E or the right button.
- ~~**Zone pools.**~~ Done: `Trait.band` replaced `minStage`. A card is offered in its band
  or deeper — the band the player is in when the draft happens — and leans ×1.6 at home.

## 6. Enemies that ask for tactics

Beaten by behaviour, not just size: the anglerfish only if you avoid its lure, a school
edible once you split it, a shark that flees the blood you leave. Each guardian should be
a small puzzle with a tell. Squid arms that can be torn free are the model to copy.

- ~~**The anglerfish, the bait ball and shark blood.**~~ Done: see *Tactics* in
  `docs/simulation.md`.
- ~~**Guardian tells.**~~ Done: the Great White charges, the Sperm Whale clicks, the squids
  grab, and the Leviathan draws the water in front of it into its mouth and snaps (`suck`).

## 7. Something survives death

The biggest roguelite gap. There is no save beyond the best score in `localStorage`.

- ~~**Codex.**~~ Done: `run/codex.ts`, a Codex screen off the title and end screens,
  firsts toasted and listed on the end screen, and a *new* mark on draft cards for traits
  never taken. Species show as names and counts; drawing each one there would need a
  bake to an image, which is the same work as the run summary's silhouettes (§8).
- ~~**Starting forms.**~~ Done: four, one per zone reached, from the title.
- ~~**Daily seed.**~~ Done: a Daily button, the seed on the end screen, `?seed=` to share,
  and a draft stream of its own so a seed deals the same hands.
- ~~**Daily best.**~~ Done: the day's record apart from the all-time best, raced on the run
  strip during a daily, reported on the end screen and shown on the Daily button.

## 8. Small feel wins

- ~~Name what killed you on the death screen.~~ Done: `Creature.hurt` books the species
  and how (bite, sting, poison) on every wound; `Game.causeOfDeath` reads it if it is under
  4 s old, and otherwise names starvation or the forced band's pressure.
- ~~An audible, readable hunger warning.~~ Done: toasts at a quarter and at empty, the
  fullness bar pulsing red, and a synthesised heartbeat (`audio/sound.ts`, the game's first
  sound) that quickens as the bar drains. M mutes it, remembered.
- ~~The fish's silhouette at each stage on the run summary.~~ Done: `Game.lineage` keeps
  a genome copy at hatching, every level-up and a transformation; the end screens bake up
  to eight of them and read them back off the GPU, drawn to scale.
- ~~A card of its own for a discovery.~~ Done: `DiscoveryCard`, under the run strip for
  four seconds with the synergy's codex line, never pausing play.

## 9. Pixel art, side-on

Decided September 2026: the game is drawn as pixel art on one coarse grid, and every
creature is seen side-on instead of from above — Terraria, Isaac, Core Keeper for the
density, and a reference frame of a midnight scene for the look. The prototype that made
the case was `design/proto-pixel.ts`, taken off the board once it shipped. Everything
follows, in stages, each committed on its own:

1. ~~**The grid.**~~ Done: `render/pixel.ts`. The canvas is created at `1 / PIXEL`
   resolution and scaled up with hard pixels, and `FramePass` quantises the finished frame
   onto a stepped palette with a Bayer dither, so every gradient bands the same way.
2. ~~**Creatures side-on.**~~ Done: `render/creature/bake/sheet.ts` paints per pixel in
   profile — ramps, dither, a derived outline and rim — for every plan and every organ's
   morphology, at the grid's own density, re-baked when the zoom moves a tier. The view
   mirrors instead of rolling (`faceFor`) and caps its pitch (`drawnAngle`); the lure's
   strike point follows both. Left for tuning: the per-plan proportions, and small
   animals, which at their real size are a handful of texels.
3. ~~**Light.**~~ Done: every light organ the bake records gets a bloom of its own in the
   shared additive layer, sized in pixels of the frame, carried through the body's
   transform and breathing on its own clock; `FramePass` bands and dithers all of it. The
   glow floor every animal carries is halved, since the pixel rim now holds the silhouette.
4. ~~**The water and the background.**~~ First pass done: particulate and fx dots are a
   hard 5×5 pixel disc, and the background props are brought down to 64 texels with their
   blur turned into screen-door dither, so a plane's distance reads as dither density. The
   water shader is left alone — `FramePass` bands it. Left: pixel-art scenery with real
   structure (rock, kelp, vents), which is where the field prototype should land
   (`decisions.md` has it and where to recover its code).
5. ~~**The HUD.**~~ Done: Pixelify Sans, bundled, with font smoothing off; square corners,
   2 px frames, hard 2 px rings for every glow, one-pixel drop shadows, flat bar fills with
   a lit top row, bevelled buttons. The mutation icons are pixels, rastered per size onto
   2 px cells, and the danger vignette is hard bands with a dithered edge.

6. ~~**Motion.**~~ Done: idle levels out and hovers, pitch is capped by activity, hunters
   wind up, strike and recover with a jaw baked open for it, a wound flinches and flashes,
   and a death is played out — belly-up, or down the swallower's throat. Turning back is a
   flip: mirrored in a frame, checked in speed, with a squish and a crackle as it settles.
   The design board's Motion group loops each state.

What is left across the whole pass is tuning, not structure: per-plan proportions and
palettes side-on, small animals at their real size, and scenery with real structure.

## Suggested order

1. ~~Two or three more synergies~~ — done, Ballistic included.
2. ~~The shallows clock~~ — done.
3. ~~The codex~~ — done.
4. ~~Diet and locomotion organs~~ — done.
5. ~~Transformations~~ and ~~the draft reading them~~ — done.
6. ~~Vivisect, Drifting Bloom and Whale Shark~~ — done. Flash Sense waits on §5's sense
   modes.
7. ~~Zone pools and costs on apex cards~~ — done.
8. ~~The pocket below each gate, and forcing a seal~~ — done.
9. ~~Sense modes and Flash Sense~~ — done.
10. ~~Cursed cards and the active organ slot~~ — done.
11. ~~Enemies that ask for tactics~~ — done.
12. ~~Starting forms and a daily seed~~ — done.
13. ~~The small feel wins~~ — done. What is left is marked as left open in each section:
    more synergies and curses as the pool grows (§1, §5). ~~How the ocean reads a
    transformed player and a second form (§2)~~ — done. ~~A daily best (§7)~~ and ~~a Leviathan
    pattern of its own (§6)~~ — done.
