#!/usr/bin/env node
/**
 * The changelog's half of a release, run by `npm version` (the `version` script in
 * `package.json`) once the version is bumped and before it is committed: the *Unreleased*
 * section becomes the new version's, dated today, a fresh empty *Unreleased* goes above it, and
 * the compare links at the foot are moved on. It refuses an empty *Unreleased*, so a release
 * cannot go out saying nothing. See `docs/releasing.md`.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.env.npm_package_version;
if (!version) {
  console.error('changelog: run through `npm version` (npm run release -- <patch|minor|major>)');
  process.exit(1);
}
const file = 'CHANGELOG.md';
const text = readFileSync(file, 'utf8');
const head = '## [Unreleased]';
const at = text.indexOf(head);
if (at < 0) { console.error(`changelog: no "${head}" section`); process.exit(1); }
const next = text.indexOf('\n## [', at + head.length);
const body = text.slice(at + head.length, next < 0 ? undefined : next).trim();
if (!body) { console.error('changelog: Unreleased is empty — say what this release changed first'); process.exit(1); }

const date = new Date().toISOString().slice(0, 10);
const repo = 'https://github.com/ParelZalm/abyssal';
const prev = /\n## \[(\d+\.\d+\.\d+)\]/.exec(text.slice(at))?.[1];
let out = `${text.slice(0, at)}${head}\n\n## [${version}] — ${date}\n\n${body}\n${next < 0 ? '' : text.slice(next)}`;
out = out.replace(/^\[Unreleased\]: .*$/m,
  `[Unreleased]: ${repo}/compare/v${version}...HEAD\n[${version}]: ${prev ? `${repo}/compare/v${prev}...v${version}` : `${repo}/releases/tag/v${version}`}`);
writeFileSync(file, out);
console.log(`changelog: Unreleased is now ${version} (${date})`);
