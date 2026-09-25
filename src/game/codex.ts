/**
 * The codex: what every run so far has found, kept across runs.
 *
 * Kept by id rather than by name, so renaming a species or a synergy does not orphan what
 * a player has already found — and an id the game no longer has is carried along unread
 * rather than dropped, so a rename that is later reverted loses nothing either.
 */
export interface Codex {
  /** Kills by species id, across every run. */
  species: Record<string, number>;
  /** Times each trait id has been taken, one per stack. */
  traits: Record<string, number>;
  /** Synergy (named organ) ids that have fired on the player at least once. */
  synergies: string[];
  /** Families whose transformation the player has undergone. */
  forms: string[];
  runs: number;
}

const KEY = 'abyssal.codex';

const empty = (): Codex => ({ species: {}, traits: {}, synergies: [], forms: [], runs: 0 });

/** A missing, private-mode or hand-edited store all read as a codex with nothing in it. */
export function loadCodex(): Codex {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Codex> | null;
    if (!raw || typeof raw !== 'object') return empty();
    const strings = (v: unknown) =>
      Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];
    const counts = (v: unknown) => {
      const out: Record<string, number> = {};
      if (v && typeof v === 'object') {
        for (const [k, n] of Object.entries(v)) if (Number.isFinite(n) && n > 0) out[k] = n;
      }
      return out;
    };
    return {
      species: counts(raw.species),
      traits: counts(raw.traits),
      synergies: strings(raw.synergies),
      forms: strings(raw.forms),
      runs: Number.isFinite(raw.runs) ? Number(raw.runs) : 0,
    };
  } catch { return empty(); }
}

export function saveCodex(c: Codex) {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* private mode: the run still counts */ }
}

/** Book one kill. True the first time this species has ever been eaten. */
export function recordSpecies(c: Codex, id: string) {
  const n = c.species[id] ?? 0;
  c.species[id] = n + 1;
  return n === 0;
}

/** Book one stack of a trait. True the first time it has ever been taken. */
export function recordTrait(c: Codex, id: string) {
  const n = c.traits[id] ?? 0;
  c.traits[id] = n + 1;
  return n === 0;
}

/** Book a transformation. True the first time any run has become it. */
export function recordForm(c: Codex, family: string) {
  if (c.forms.includes(family)) return false;
  c.forms.push(family);
  return true;
}

/** Book a synergy firing. True the first time it has ever fired. */
export function recordSynergy(c: Codex, id: string) {
  if (c.synergies.includes(id)) return false;
  c.synergies.push(id);
  return true;
}
