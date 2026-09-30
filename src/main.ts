import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import './style.css';
import { Game } from './Game';
import { parseLaunch } from './dev/launch';
import { devPanel } from './dev/panel';

const game = new Game();
// Development only, and not in a production build at all: a launch from the address bar
// (`dev/launch.ts`), the dev panel with the link to the design board, and `window.game`
if (import.meta.env.DEV) {
  game.boot(parseLaunch(new URLSearchParams(location.search)));
  devPanel(game);
  (window as unknown as { game: Game }).game = game;
} else {
  game.boot();
}
