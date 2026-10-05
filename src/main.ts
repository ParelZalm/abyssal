import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import './style.css';
import { Game } from './Game';
import { loadSprites } from './render/creature/sprite';
import { parseLaunch } from './dev/launch';
import { devPanel } from './dev/panel';
import { lab } from './dev/lab';

// a bake is synchronous, so the authored sprites are in hand before anything is drawn
await loadSprites();
const game = new Game();
// Development only, and not in a production build at all: a launch from the address bar
// (`dev/launch.ts`), the dev panel with the link to the design board, and `window.game`
if (import.meta.env.DEV) {
  const launch = parseLaunch(new URLSearchParams(location.search));
  game.boot(launch);
  devPanel(game);
  if (launch?.lab) lab(game, launch);
  (window as unknown as { game: Game }).game = game;
} else {
  game.boot();
}
