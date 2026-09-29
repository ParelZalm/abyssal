const KEY = 'abyssal.best';
/** Only the day's own record: yesterday's daily was another ocean, so there is nothing to keep. */
const DAILY_KEY = 'abyssal.daily';

/**
 * The best score any run has reached, and the best on the daily, kept across runs. Both are
 * read once and cached, since the HUD asks for them every frame.
 */
export class Best {
  value = load();
  private day = loadDaily();

  /** Record a final score; true if it is a new best. */
  submit(score: number) {
    if (score <= this.value) return false;
    this.value = score;
    try { localStorage.setItem(KEY, String(score)); } catch { /* private mode: the run still counts */ }
    return true;
  }

  /** The best score on the daily for `date` (its `YYYY-MM-DD` key), 0 if none yet. */
  daily(date: string) {
    return this.day.date === date ? this.day.score : 0;
  }

  /** Record a daily's final score against its date; true if it is that day's new best. */
  submitDaily(date: string, score: number) {
    if (score <= this.daily(date)) return false;
    this.day = { date, score };
    try { localStorage.setItem(DAILY_KEY, JSON.stringify(this.day)); } catch { /* as above */ }
    return true;
  }
}

function load() {
  try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; }
}

function loadDaily(): { date: string; score: number } {
  try {
    const d = JSON.parse(localStorage.getItem(DAILY_KEY) ?? 'null') as { date?: unknown; score?: unknown } | null;
    if (d && typeof d.date === 'string') return { date: d.date, score: Number(d.score) || 0 };
  } catch { /* a malformed record is no record */ }
  return { date: '', score: 0 };
}
