/**
 * The skin a living body is drawn with: sub-pixel sampling and a displacement field, as one
 * shader on the creature's strip.
 *
 * The strip already bends the body, but it is 20-odd columns long and nearest-sampled, so
 * everything smaller than a column or a pixel is lost: a body that drifts a third of a pixel
 * does not move at all and then jumps, and a fin has no motion of its own. Both are what a
 * pixel animator draws by hand:
 *
 * - **Sub-pixel.** Four texels are read around the sample point and blended, with the blend
 *   pinched toward the nearest one so the art stays hard. Moved a fraction of a pixel, an
 *   edge takes an in-between colour instead of standing still, and `FramePass` steps that
 *   colour onto the palette the way a hand-shaded in-between would be.
 * - **Displacement.** Single texels of the art are moved by whole texels, the way a pixel
 *   animator nudges pixels between frames: a one-texel nub runs back along each fin's edge a
 *   column at a time, the tail's tip steps a texel on the beat, and now and then a lone nub
 *   comes and goes. Every decision is made per texel and held for a frame, so
 *   nothing is a smooth warp laid over the grid — an earlier sine field was, and it read as
 *   the art wobbling rather than the fins moving.
 *
 * The cost is the batch: a mesh with a shader of its own is a draw call of its own, so every
 * body on screen is one. The strip was batched before this, but each bake is a texture of its
 * own, so a school of distinct animals was already close to a call apiece.
 */
import { GlProgram, Shader, UniformGroup, type Texture } from 'pixi.js';

// GLSL 300 es, unlike `FramePass`: the edge blend is sized with `fwidth`, which ES 1.0 only
// has behind an extension
const vertex = `#version 300 es
in vec2 aPosition;
in vec2 aUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform vec4 uWorldColorAlpha;
uniform mat3 uTransformMatrix;
uniform vec4 uColor;
out vec2 vUV;
out vec4 vColor;

void main() {
  mat3 m = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((m * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
  vColor = uColor * uWorldColorAlpha;
}
`;

const fragment = `#version 300 es
precision mediump float;
in vec2 vUV;
in vec4 vColor;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec2 uSize;
uniform float uBeat;
uniform float uClock;
uniform float uBody;
uniform float uRipple;
uniform float uSoft;

float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }

vec4 texel(vec2 t) {
  // outside the bake there is nothing: clamping would smear the edge texel into the gap a
  // displaced fin leaves behind
  if (t.x < 0.0 || t.y < 0.0 || t.x >= uSize.x || t.y >= uSize.y) return vec4(0.0);
  return texture(uTexture, (floor(t) + 0.5) / uSize);
}

void main() {
  vec2 p = vUV * uSize;
  // everything that decides a displacement reads the texel this pixel lands in, not the
  // pixel itself, and the answer is a whole number of texels
  vec2 cell = floor(p);
  vec2 cuv = (cell + 0.5) / uSize;
  float up = cuv.y < 0.5 ? -1.0 : 1.0;
  // the fins are what lies outside the body's own depth: above the back, below the belly. A
  // hard edge — a texel is fin or it is not — or a weight times a whole texel rounds into a
  // seam through the middle of the fin
  bool fin = abs(cuv.y - 0.5) * 2.0 > uBody * 0.95;
  // u runs tail (0) to nose (1)
  float tail = clamp((0.22 - cuv.x) / 0.22, 0.0, 1.0);
  float fromNose = uSize.x - 1.0 - cell.x;
  // held frames, as a hand-drawn cycle is: about nine to a stroke of the tail
  float frame = floor(uBeat * 1.5);
  vec2 d = vec2(0.0);
  if (fin) {
    // Only the fin's outline moves, and only outward by one texel: an empty texel just past the
    // edge takes the edge texel's colour, so the edge grows a one-pixel nub. Moving whole
    // columns of fin shifted every texel in them and read as rough, not as a fin breathing.
    vec2 inward = vec2(0.0, -up);
    bool edge = texel(cell).a < 0.01 && texel(cell + inward).a > 0.5;
    // one column in eight carries the nub, stepping back a column a frame, half of them skipped
    float k = mod(fromNose - frame, 8.0);
    bool bump = k < 1.0 && hash(cell.x + floor((frame - fromNose) / 8.0) * 17.0) > 0.5;
    // and at rest, rarely, a lone nub comes and goes
    bool flick = hash(cell.x * 7.0 + floor(uClock * 3.0) * 3.1) > 0.985;
    if (edge && (bump || flick)) d.y += up;
  }
  // only the tail's last few columns step, and by one texel, when the stroke is near its peak
  d.y += floor(clamp((0.1 - cuv.x) / 0.1, 0.0, 1.0) * sin(frame * 0.7) + 0.5);
  // sampled from the other side: to show a texel moved by d, read the one d behind it
  p -= floor(d * uRipple + 0.5);

  // four taps, blended only across the one screen pixel that straddles a texel boundary. At
  // the game's one texel per pixel that is the whole of a sub-pixel offset; magnified, as on
  // the design board, it is a pixel of antialiasing on an edge that is otherwise hard — a
  // blend sized in texels would soften the art the moment anything zoomed in on it
  vec2 q = p - 0.5;
  vec2 b = floor(q);
  vec2 f = q - b;
  vec2 fw = max(fwidth(p) * uSoft, vec2(1e-3));
  vec2 w = clamp((f - 0.5) / fw + 0.5, 0.0, 1.0);
  vec4 c = mix(mix(texel(b), texel(b + vec2(1.0, 0.0)), w.x),
               mix(texel(b + vec2(0.0, 1.0)), texel(b + vec2(1.0, 1.0)), w.x), w.y);
  finalColor = c * vColor;
}
`;

let program: GlProgram | null = null;

export interface LivingSkin {
  /** Carries `texture` because a mesh's shader has to: `Mesh.texture` writes through to it. */
  shader: Shader & { texture: Texture };
  uniforms: UniformGroup;
  /** Point the skin at another bake of the same crop — the jaw opening. */
  use(texture: Texture): void;
}

/**
 * A skin for one strip. `body` is the body's half-depth over the strip's half-height, which
 * is how the shader tells a fin from a flank without a mask baked for it.
 */
export function livingSkin(texture: Texture, body: number): LivingSkin {
  program ??= GlProgram.from({ vertex, fragment, name: 'creature-living' });
  const uniforms = new UniformGroup({
    uSize: { value: new Float32Array([texture.source.pixelWidth, texture.source.pixelHeight]),
             type: 'vec2<f32>' },
    uBeat: { value: 0, type: 'f32' },
    uClock: { value: 0, type: 'f32' },
    uBody: { value: body, type: 'f32' },
    uRipple: { value: 1, type: 'f32' },
    // the blend's width in screen pixels: 1 is a true sub-pixel blend, 0 is nearest
    uSoft: { value: 1, type: 'f32' },
  });
  const shader = Object.assign(
    new Shader({ glProgram: program, resources: { uTexture: texture.source, living: uniforms } }),
    { texture });
  return {
    shader, uniforms,
    use(t) { shader.resources.uTexture = t.source; },
  };
}
