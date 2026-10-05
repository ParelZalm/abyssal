# Changelog

What each release of Abyssal changed, for a player and for whoever builds on it. The newest is
first. Add to *Unreleased* in the same commit as the change; `npm run release` turns it into the
next version's section ([docs/releasing.md](docs/releasing.md)). Versions are
[semantic](https://semver.org): while the game is `0.x`, a minor is a feature that changes how it
plays and a patch is a fix or a balance pass.

## [Unreleased]

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

[Unreleased]: https://github.com/ParelZalm/abyssal/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/ParelZalm/abyssal/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ParelZalm/abyssal/releases/tag/v0.1.0
