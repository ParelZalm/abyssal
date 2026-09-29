import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import './style.css';
import { Game } from './Game';

/**
 * Development only — a link to `/design.html`, the board that shows every drawing the game
 * makes. Guarded by `import.meta.env.DEV`, so it is not in a production build at all.
 */
function devSwitch() {
  const a = document.createElement('a');
  a.href = '/design.html';
  a.textContent = 'design ▸';
  a.style.cssText = 'position:fixed;left:10px;bottom:8px;z-index:60;text-decoration:none;'
    + 'font:11px ui-monospace,monospace;letter-spacing:.08em;color:#8fb4c8;'
    + 'background:rgba(3,8,12,.7);border:1px solid rgba(120,200,210,.25);'
    + 'border-radius:4px;padding:4px 8px;opacity:.55';
  a.onmouseenter = () => { a.style.opacity = '1'; };
  a.onmouseleave = () => { a.style.opacity = '.55'; };
  document.body.appendChild(a);
}

const game = new Game();
game.boot();
if (import.meta.env.DEV) {
  devSwitch();
  (window as unknown as { game: Game }).game = game;
}
