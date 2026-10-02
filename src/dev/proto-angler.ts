/**
 * PROTOTYPE — `prototype/angler-art` only. Never merge.
 *
 * `?angler=a|b` gives every anglerfish the prototype's texture (`render/creature/proto-angler.ts`)
 * and `?big=3` makes it three times the size — option C — so the three can be judged in a
 * deep-tank room: `/?tank=deep&room=fight&god=1&angler=b&big=3`. A bar at the bottom of the
 * page switches between them by reloading with the new address.
 */
const q = new URLSearchParams(location.search);
const art = q.get('angler');

export const protoAngler = {
  art: art === 'a' || art === 'b' ? art : null,
  big: Math.max(0.25, Number(q.get('big') ?? 1) || 1),
};

export function protoAnglerBar() {
  if (!import.meta.env.DEV) return;
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:99;display:flex;gap:6px;'
    + 'padding:6px 10px;border-radius:999px;background:#fff;color:#111;font:12px monospace;box-shadow:0 2px 12px #0008;align-items:center';
  const go = (k: string, v: string | null) => {
    const u = new URL(location.href);
    if (v === null) u.searchParams.delete(k); else u.searchParams.set(k, v);
    location.href = u.toString();
  };
  const btn = (label: string, on: boolean, act: () => void) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = `font:inherit;border:1px solid #111;border-radius:999px;padding:2px 8px;cursor:pointer;background:${on ? '#111' : '#fff'};color:${on ? '#fff' : '#111'}`;
    b.onclick = act;
    bar.appendChild(b);
  };
  bar.append('PROTOTYPE angler ·');
  btn('shipping', protoAngler.art === null, () => go('angler', null));
  btn('A painter', protoAngler.art === 'a', () => go('angler', 'a'));
  btn('B template', protoAngler.art === 'b', () => go('angler', 'b'));
  bar.append(' · size');
  for (const b of [1, 2, 3, 4]) btn(`×${b}`, protoAngler.big === b, () => go('big', String(b)));
  document.body.appendChild(bar);
}
