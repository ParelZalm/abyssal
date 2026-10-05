# Branches and releases

How work gets from a branch into a release. Settled October 2026, when the tank rework
(`rework/gameloop`) was merged into `main` as 0.2.0 and the stale branches were cleared.

## Branches

- **`main` is always playable.** Every commit on it builds (`npm run build`) and has been
  looked at — on the design board, in the lab (`/?lab=1`), or in a launch. Nothing is pushed to
  `main` that would not be fine to release.
- **Work happens on a short-lived branch off `main`**, named for what it is:
  `feat/<topic>` for something new the game does, `fix/<topic>` for a fix, `art/<topic>` for
  drawing or sprites, `docs/<topic>` for docs alone. A roadmap stage is one branch. Commit and
  push the branch as it goes, in the log's style (`area: summary`, then a bullet body).
- **Merge it into `main` when it is done**, with `git merge --no-ff`, so the stage reads as one
  merge in the history; then delete the branch, here and on `origin`:

  ```bash
  git checkout main && git pull
  git merge --no-ff feat/<topic>
  git push
  git branch -d feat/<topic> && git push origin --delete feat/<topic>
  ```

- **A prototype** — a question answered on a branch that is never meant to merge — is
  `prototype/<topic>`. Once it has answered, keep it as a tag and delete the branch, so the
  branch list only ever holds work in progress:

  ```bash
  git tag -a archive/prototype-<topic> prototype/<topic> -m "what it answered"
  git push origin archive/prototype-<topic>
  git branch -D prototype/<topic> && git push origin --delete prototype/<topic>
  ```

  It is still there to look at: `git checkout archive/prototype-<topic>`.

## The changelog

[`CHANGELOG.md`](../CHANGELOG.md) is what each release changed, newest first, for a player and
for whoever builds on it. **Every merge into `main` adds its lines under *Unreleased*** in the
same commit or the merge — what changed in play, not the commit log. The implementation notes in
`docs/` are not a changelog and stay current instead; the roadmap says why a stage was done and
what it found.

## Versions

[Semantic versions](https://semver.org), tagged `vX.Y.Z`. While the game is `0.x`:

- a **minor** (`0.3.0`) is a feature that changes how it plays — a roadmap stage, a tank, a
  rework of a system;
- a **patch** (`0.2.1`) is a fix, a balance pass or art that changes nothing about how it plays.

`1.0.0` is the game finished as the roadmap's version 1 describes it.

## Cutting a release

From `main`, up to date, with a clean tree and *Unreleased* filled in:

```bash
npm run release -- minor     # or patch, or an exact version: npm run release -- 0.3.0
```

That is `npm run build && npm version …`, and `npm version` runs the rest:

1. the build, which must pass;
2. the version in `package.json` and `package-lock.json` bumped;
3. `scripts/changelog.mjs` (the `version` script): *Unreleased* becomes the new version's
   section, dated today, a fresh *Unreleased* goes above it and the compare links move on — it
   refuses an empty *Unreleased*;
4. a commit, `release: vX.Y.Z` (`.npmrc`), and an annotated tag `vX.Y.Z` on it;
5. `git push --follow-tags` (the `postversion` script): `main` and the tag to `origin`.

Then the GitHub release, from that version's notes (`gh auth login` once first):

```bash
gh release create v0.3.0 --title v0.3.0 --notes "$(npm run -s release:notes -- 0.3.0)"
```

A fix to a release is a `fix/` branch merged into `main` and a patch release; there are no
release branches until something needs one.

## History

| Tag | What it is |
| --- | --- |
| `v0.1.0` | The column game: one open water column, five zones and their thermoclines, the draft, the Leviathan. The last `main` before the rework. |
| `v0.2.0` | The tank game: the rework merged — three tanks of rooms, Isaac's controls and stats, the bosses, the economy, the mutation pool and its art. |
| `archive/prototype-angler-art` | The anglerfish painted three ways (a painter, a template, bigger), which decided that enemies are drawn from sprites. Never merged. |

The merged branches of the column era (`zones`, `guardians`, `greatshark-silhouette`,
`prototype/fish-design`) and `rework/gameloop` itself were deleted once in `main`; their
commits are all in its history.
