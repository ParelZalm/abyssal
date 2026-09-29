/**
 * The pixel grid, and the pass that puts the whole frame on it.
 *
 * The game is drawn at a fraction of the screen's resolution and scaled up with hard
 * pixels, so everything in a frame — water, bodies, blooms, particulate — shares one grid.
 * Scaling each creature's art up by itself cannot do that: every animal would sit on its
 * own grid at its own size, and a rotated or skinned one would resample its pixels at
 * every bend. One low-resolution frame re-grids all of it for free.
 *
 * The canvas is simply created at `1 / PIXEL` resolution and CSS scales it up with
 * `image-rendering: pixelated`. No render target of our own, and the GPU shades a ninth of
 * the pixels it used to.
 *
 * On top of that, `FramePass` quantises the finished frame onto a stepped palette with an
 * ordered dither. Smooth gradients — the depth ramp, the blooms, the fog a guardian drags —
 * would otherwise stay smooth on big pixels, which reads as a blurry modern image scaled up
 * rather than as pixel art. Quantising in one place means every system bands the same way,
 * and none of them has to know about it.
 */
import { Filter, GlProgram } from 'pixi.js';

/** CSS pixels per art pixel. The reference is drawn at about four; three holds more world. */
export const PIXEL = 3;

const vertex = `
attribute vec2 aPosition;
varying vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

void main() {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}
`;

const fragment = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uLevels;

// the 4x4 Bayer matrix by recursion, 0..1: the one dither pattern every pixel-art
// gradient in the game uses, so creature art and the frame agree on it
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

void main() {
  vec4 c = texture2D(uTexture, vTextureCoord);
  // quantised in a square-root space, not linear: the ocean is nearly all dark, and even
  // steps in linear light would spend every level on colours the frame never shows while
  // the midnight water collapsed onto two of them
  vec3 g = sqrt(max(c.rgb, 0.0));
  float t = bayer4(gl_FragCoord.xy) - 0.47;
  g = clamp(floor(g * uLevels + 0.5 + t) / uLevels, 0.0, 1.0);
  gl_FragColor = vec4(g * g, c.a);
}
`;

/** Quantise and dither the finished frame. Runs at the canvas's own, already low, resolution. */
export class FramePass extends Filter {
  constructor(levels = 18) {
    super({
      glProgram: GlProgram.from({ vertex, fragment, name: 'pixel-frame' }),
      resources: { frameUniforms: { uLevels: { value: levels, type: 'f32' } } },
      antialias: false,
    });
  }
}
