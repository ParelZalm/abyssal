# Changelog

What each release of Abyssal changed, for a player and for whoever builds on it. The newest is
first. Add to *Unreleased* in the same commit as the change; `npm run release` turns it into the
next version's section ([docs/releasing.md](docs/releasing.md)). Versions are
[semantic](https://semver.org): while the game is `0.x`, a minor is a feature that changes how it
plays and a patch is a fix or a balance pass.

## [Unreleased]

## [0.5.1] — 2026-10-09

- **The column's background is gone.** The parallax props and fields the open column drew
  behind the action (`render/scenery.ts`, `props.ts`, `fields.ts`), out of play since the
  tank rework, are deleted with the design board's archived *Column era* section that alone
  still drew them, and with the bands' `scenery` tables and `bandWater` that only they read.

## [0.5.0] — 2026-10-09

- **The Ink Sac confuses.** Its ink leaves every hostile in the room confused for 4 s — a
  question mark over each, lit plain through the dark, none winding up, charging or firing —
  where before it only hid you while you stayed in the cloud. The cloud is drawn under the
  bodies now, so it no longer buries the room's hostiles; bosses keep their own fights.
- **Music.** Each tank has its own track — the Nursery, the Reef and the Deep — looped and
  crossfaded as the body goes down the drain; the title plays the Nursery's, and Hatch carries
  it on into the first tank. M mutes it with the heartbeat, and it stops while the tab is hidden.
- **The Shark is drawn.** Becoming a Shark makes the larva a drawn shark of the same pale glass,
  its first dorsal, tail, pectoral, pelvic and eye drawn apart and grown as the painters grew them,
  and it wears the larva's drawn mutations, its eyes sized to its own, with jaws and lures drawn
  for it: the mouth under its snout, the lure arching from its brow. Its brood pouch hangs clear of
  its pectoral, and its siphon of its anal fin.
- **The Squid is drawn.** Becoming a Squid makes the larva a drawn squid of the same pale glass,
  its fins and its eye drawn apart, its arms and tentacles drawn and rigged at its head, and it
  wears the larva's drawn mutations; its jaws are a squid's beak at the root of its arms, in each
  card's look, and its lures arch from its head at its own reach.
- **The Moray is drawn.** Becoming a Moray makes the larva a drawn moray of the same pale glass, a
  long eel with one low fin round its body and a paddle of a tail, its eye near its snout, and it
  wears the larva's drawn mutations; Anguilliform Body keeps its own fin instead of painting a
  second one round it, and no jaw grows a spike on its back. It is a little shorter than the eels
  of the roster, and its spit leaves its mouth rather than the middle of its body. Its jaws and
  lures are drawn for it: a moray's jaw that drops wide under its eye, with fangs, a saw or a
  parrot's beak, and the lure arching from its brow at its own reach. Its eye is a moray's, a
  third smaller, so the mouth shows from under it.
- **The Angler is drawn.** Becoming an Angler makes the larva a drawn anglerfish of the same pale
  glass, a deep egg of a body under its lure, its fins, its fan of a tail and its eye drawn apart,
  its mouth a long upturned seam that opens wide to bite, and it wears the larva's drawn mutations,
  with jaws and lures drawn for it: its jaws along that upturned mouth, its lure arching from its
  brow at its own reach. Its eye looks ahead of it. Before, it was painted as the deep's anglerfish: dark,
  scaled, a comb of spines and a lamp of an eye.
- **The Bloom is drawn.** Becoming a Bloom makes the larva a drawn jellyfish of the same pale glass:
  a dome of a bell with the larva's eye in its front and its gut showing through, trailing nine
  fine tentacles beaded with stinging cells and three frilled oral arms, and it strikes by
  squeezing its bell in a hard pulse rather than opening a jaw. It wears the larva's drawn
  mutations; its tentacles are its stinging fringe, so no second fringe hangs under it, and no
  comb of rakers is painted on its front, since its sieve is its arms. Its tentacles trail
  longer with its segments, and they hold together as lines at every size rather than breaking
  into specks. Before, it was painted: a grey bell with a mouth at its front.
- **The Bloom bites with its bell.** A jaw mutation taken as a Bloom grows a small mouth on the
  front of its bell under the eye, armed in the card's look — the Hinged Jaw, the fangs, the saw or
  the Parrot Beak — opening on the strike; before, jaws showed nothing on it. Its lures root on the
  top of its dome and arch forward over it.
- **No more spit sac.** The blue drop of water every body wore for the hatchling's spit is gone
  from the larva and every form: wherever it sat it read as a tear or a stain. Twin Spout still
  shows its second sac.
- **The Angler's glow dazes.** A hostile that comes too close to the Angler, into its glow, is dazed
  for 4.5 s: greyed out, stars circling over its head, and at 0.4 of its pace — its swim, its
  charge and the shots it fires, which still reach as far. It comes round
  and is spared for 2 s before the glow can daze it again; bosses keep their own fights.
- **A glowing body is no longer white-hot.** The player's light organs widen its glow instead of
  burning a white blob over its middle, so the body reads under its own light.
- **Fixed**: the Parrot Beak's lower plate is teal again, on the larva, the Shark and the Squid; the
  larva's had come out wholly the outline's grey.
- **Fixed**: taking the Deep Lantern, the Lunging Bite or the Parrot Beak could leave the body
  drawn as it was before, the lantern still the first lure and the jaw still the last one.
- **For development**: `scripts/import-marks.mjs` reads a sheet whose pitch is not whole, and
  `--fit` finds each cell's grid on its own; `--drawn` names colours it never takes for bleed.
- **For development**: the lab opens with a shelf for each form, its family's mutations, so three
  taken from one are the metamorphosis a run makes; `/?lab=1&shelf=moray` opens on the Moray's.

## [0.4.0] — 2026-10-06

- **The larva's back is drawn.** What stands up off it is drawn now: the Dorsal Spines, the
  Spine Volley's quills (three, five for a Quill Storm), the Brine Gland's rime, the coral's
  knobs and branches, the Inflation's prickles and the Porcupine's quills, the Stonefish's warts.
- **And its belly.** What hangs under it or sits low on it is drawn: the Pincer Claws (serrated
  for Vivisect) and the Ballistic club, the Anemone Frill's tentacles, the Brood Pouch's roe, the
  Leaden Bones' keel, the photophores, the Mantle Pump's funnel and Lie in Wait's beard.
- **And its flank.** What shows through its side is drawn: the Ink Sac, the Electric Organ (to the
  tail for the Electric Eel), the Galvanic Cells' wire, the Vent Gland, Cavitation's bladder, the
  venom gland (ringed for Nematocyst), Blood Lamp's coals, Open Veins, Brittle Frame's cracks,
  Lie in Wait's mottling and the Mantle Pump's rings.

## [0.3.0] — 2026-10-05

- **The larva is drawn.** It is a hand-drawn picture now, like the enemies': a pale,
  see-through fry with its spine and gut showing, a deep round head and a big eye, a back fold
  arching over its trunk and a fan of a tail. The mutations on its head and tail are drawn on
  it too: the jaws, the beak and the lures, the extra eyes, the forked tails, the siphon and
  the rest. Bigger
  fins and a sharper eye still grow on it, and every other mutation is painted onto it as before,
  in its own colours.
- **The deep's hostiles fight their own way**, each with a turn at half health. The barracuda
  hangs across from you and crosses the room the moment you are in its row, stunned on the rock
  it stops on; turned, it ricochets three dashes off the walls. The gulper eel draws you and
  your shots into its jaw, swallowing the shots, and a gulp that misses leaves it hanging open;
  turned, it spits back a fan for what it swallowed. The vampire squid's bolts curve after you;
  turned, it balls up inside out when you come close, braced, then bursts into a cloud of
  stinging motes and jets away. The anglerfish's lure flares and lets three to five violet sparks
  out of it to hang beside it, taking aim, and they fire at you one after another; turned, it
  lunges. The siphonophore
  breaks in two where it is hit, and a long piece breaks again.
- Release notes link into the repo at the release's tag, where they were relative and broke on
  the release page (`npm run release:notes`).

## [0.2.0] — 2026-10-05

### The tank game

The open water column is gone: the run is a chain of aquarium tanks of one-screen rooms, played
like *The Binding of Isaac* ([ADR 0003](docs/adr/0003-tanks-of-rooms-replace-the-column.md),
[the roadmap](docs/roadmap.md)).

- **Three tanks** — the nursery, the reef, the deep — of 6–8 rooms each, dealt from the seed:
  fights that shut their doors, a treasure room, a shop, a boss, and sometimes a deal room. A
  drain in the boss room's floor is the way down, and the body grows ×1.8 at each descent.
- **Isaac's controls**: WASD swims, the arrows strike four ways, Space fires the active, E takes,
  Q uses the item.
- **Hearts in halves**, armour as a chance to shrug a hit off, swallowing on the killing bite,
  carcasses, and a belly that passes pickups.
- **Hostiles with movesets** that turn at half health, in four roles — charger, spitter, turret,
  drifter — and drawn from authored sprites; **three bosses** with set pieces: the Mantis Shrimp
  in its den, the Great White's breach, the Giant Squid's ink and ghosts.
- **The economy**: shells, keys, chests, three items, the shop, and the deal room's deals and
  curses.
- **The mutation pool reworked toward Isaac's stats** — damage, tears, range, shot speed, speed —
  with every card's numbers computed on the body as before → after, Isaac's word for each
  ("Tears up"), and a drawing of its organ on an upgraded pedestal.
- **Primaries, multishot and shot organs** that stack, so synergy is the systems composing: the
  spit, the spine volley, the Mouthbrooder's fry, the lunging bite; the Parietal Eye, Twin Spout
  and Four-Eyed Fish; eight shot organs; fifteen named synergies, Shoal Hunt among them.
- **The look**: side-on pixel art on one grid, dark stone and navy water lit by what glows, the
  title painting, Isaac's HUD and minimap.
- **For development**: launches from the address bar, the dev panel, the lab (`/?lab=1`) and the
  design board.

## [0.1.0] — 2026-09-29

The column game: one open water column nine kilometres deep, five zones sealed by thermoclines
that open to a body big enough, a draft of three mutations at every growth, guardians, the
Leviathan at the bottom, and the codex. Kept as the tag `v0.1.0`.

[Unreleased]: https://github.com/ParelZalm/abyssal/compare/v0.5.1...HEAD
[0.5.1]: https://github.com/ParelZalm/abyssal/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/ParelZalm/abyssal/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/ParelZalm/abyssal/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/ParelZalm/abyssal/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/ParelZalm/abyssal/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ParelZalm/abyssal/releases/tag/v0.1.0
