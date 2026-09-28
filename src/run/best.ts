const KEY = 'abyssal.best';

/** The best score any run has reached, kept across runs. */
export class Best {
  value = load();

  /** Record a final score; true if it is a new best. */
  submit(score: number) {
    if (score <= this.value) return false;
    this.value = score;
    try { localStorage.setItem(KEY, String(score)); } catch { /* private mode: the run still counts */ }
    return true;
  }
}

function load() {
  try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; }
}
