import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import './style.css';
import { Game } from './Game';
import { parseLaunch } from './dev/launch';
import { devPanel } from './dev/panel';
import { protoAnglerBar } from './dev/proto-angler';

const game = new Game();
// Development only, and not in a production build at all: a launch from the address bar
// (`dev/launch.ts`), the dev panel with the link to the design board, and `window.game`
if (import.meta.env.DEV) {
  game.boot(parseLaunch(new URLSearchParams(location.search)));
  devPanel(game);
  protoAnglerBar(); // PROTOTYPE (prototype/angler-art)
  (window as unknown as { game: Game }).game = game;
} else {
  game.boot();
}
