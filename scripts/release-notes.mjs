#!/usr/bin/env node
/**
 * Print one version's section of the changelog, for a GitHub release's notes:
 *
 *   gh release create v0.2.0 --title v0.2.0 --notes "$(npm run -s release:notes -- 0.2.0)"
 *
 * Without a version it prints the newest released one. See `docs/releasing.md`.
 */
import { readFileSync } from 'node:fs';

const text = readFileSync('CHANGELOG.md', 'utf8');
const want = process.argv[2]?.replace(/^v/, '');
const re = /^## \[(\d+\.\d+\.\d+)\][^\n]*\n([\s\S]*?)(?=^## \[|^\[[^\]]+\]: )/gm;
for (const m of text.matchAll(re)) {
  if (!want || m[1] === want) { console.log(m[2].trim()); process.exit(0); }
}
console.error(`release-notes: no section for ${want ?? 'any version'} in CHANGELOG.md`);
process.exit(1);
