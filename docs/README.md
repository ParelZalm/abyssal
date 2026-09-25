# Abyssal — implementation notes

The root [`README.md`](../README.md) describes the game: what it is, how it plays, and
what the player sees. These documents describe the code: how the pieces fit, which
invariants hold them together, and which mistakes have already been made and undone.

| Document | What it covers |
| --- | --- |
| [architecture.md](architecture.md) | Module graph, the frame, layer order, coordinate systems. |
| [simulation.md](simulation.md) | Swim physics, perception and behaviour, contacts, spawning. |
| [progression.md](progression.md) | Genome, the mutation draft, zones and gates, run state. |
| [rendering.md](rendering.md) | The water shader, zone water, how a creature is drawn, the DOM HUD. |
| [performance.md](performance.md) | The frame budget, where it goes, and the rules that keep it. |
| [decisions.md](decisions.md) | Things tried, kept or parked — read before redoing any of them. |
| [roadmap.md](roadmap.md) | What is left to make the run more fun, ranked, with where each item lands. |

Keep these current when the shape of a system changes. They are for the next person
reading the code cold; they are not a changelog.
