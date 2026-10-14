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
 * - **The hit flash.** A wound turns the body white for a few frames (`uFlash`). A tint only
 *   multiplies, so it can darken a body toward red but never lift it, and the red flash it
 *   was is barely a change on a dark animal in a dark room.
 * - **The daze.** A hostile held in the Angler's glow is drained toward grey (`uGrey`), for the
 *   same reason: its red could not be tinted out of it.
 * - **The carcass rim.** A body left dead is ringed with one texel of hot red just outside
 *   its silhouette (`uRim`), where the texel is empty and one beside it is not. Outside, not
 *   on, the art's own outline: a dead body is tinted down, and red laid over a dim edge read
 *   as brown. The crop leaves a texel of water past the outline for it (`cropOf` in `fishbake.ts`).
 * - **Displacement.** Single texels of the art are moved by whole texels, the way a pixel
 *   animator nudges pixels between frames: a one-texel nub runs back along each fin's edge a
 *   column at a time, the tail's tip steps a texel on the beat, and now and then a lone nub
 *   comes and goes. Every decision is made per texel and held for a frame, so
 *   nothing is a smooth warp laid over the grid — an earlier sine field was, and it read as
 *   the art wobbling rather than the fins moving.
 * - **Legs.** A sprite with a row of legs (`SpriteArt.legs`) walks them: each leg's tip swings
 *   back along the ground and comes forward lifted, the root held, and the stroke runs from
 *   the tail to the head a leg behind the next, as a mantis shrimp's legs and swimmerets beat
 *   and a centipede's go. Also by whole texels per held frame, so a leg bends in steps.
 * - **The mimic.** A reef octopus settled on the rock wears it (`uMimic`): each pixel of it
 *   takes the colour of the rock just under the face it holds, below that pixel, read from the
 *   room's own baked picture (`rockOf`), and keeps the body's light and dark as relief. The face
 *   is a line (`uSurf`), and a pixel's height off it is squeezed into the rock's top layer, the
 *   lit lip and the growth on it: deeper in, the room's bake has the rock gone dark, and a body
 *   read from there was a black hole in the reef. In world space, so it is the rock's own grid.
 * - **Trails.** What hangs behind a drifter's bell (`SpriteArt.trail`) is sent a wave on each
 *   pulse, root to tip: held at the bell, swinging most at the tips, a strand a little behind
 *   the one above it. Without it the bell pulsed and the tentacles hung as if painted on.
 *
 * The cost is the batch: a mesh with a shader of its own is a draw call of its own, so every
 * body on screen is one. The strip was batched before this, but each bake is a texture of its
 * own, so a school of distinct animals was already close to a call apiece.
 */
import { GlProgram, Shader, Texture, UniformGroup } from 'pixi.js';
import type { Baked } from './fishbake';

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
uniform mat3 uToWorld;
out vec2 vUV;
out vec4 vColor;
out vec2 vWorld;

void main() {
  mat3 m = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((m * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
  vWorld = (uToWorld * vec3(aPosition, 1.0)).xy;
  vColor = uColor * uWorldColorAlpha;
}
`;

const fragment = `#version 300 es
precision mediump float;
in vec2 vUV;
in vec4 vColor;
in vec2 vWorld;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform sampler2D uRock;
uniform vec4 uRockRect;
uniform vec2 uRockSize;
uniform float uMimic;
uniform float uPattern;
uniform vec4 uSurf;
uniform vec2 uMimicDepth;
uniform vec2 uSize;
uniform float uBeat;
uniform float uClock;
uniform float uBody;
uniform float uRipple;
uniform float uSoft;
uniform float uFlip;
uniform float uFlash;
uniform float uGrey;
uniform float uRim;
uniform vec3 uRimColor;
uniform vec4 uLegs;
uniform vec2 uTrail;

float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }

// the room's rock at a world point, on its own texel grid; clear where it is water
vec4 rock(vec2 w) {
  vec2 t = (w - uRockRect.xy) * uRockRect.zw;
  if (t.x < 0.0 || t.y < 0.0 || t.x >= 1.0 || t.y >= 1.0) return vec4(0.0);
  return texture(uRock, (floor(t * uRockSize) + 0.5) / uRockSize);
}

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
  // Only the outline moves, and only outward by one texel: an empty texel just past the edge
  // takes the edge texel's colour, so the edge grows a one-pixel nub. Moving whole columns of
  // fin shifted every texel in them and read as rough, not as a fin breathing.
  vec2 inward = vec2(0.0, -up);
  bool edge = texel(cell).a < 0.01 && texel(cell + inward).a > 0.5;
  bool nub = false;
  if (fin) {
    // one column in eight carries the nub, stepping back a column a frame, half of them skipped
    float k = mod(fromNose - frame, 8.0);
    bool bump = k < 1.0 && hash(cell.x + floor((frame - fromNose) / 8.0) * 17.0) > 0.5;
    // and at rest, rarely, a lone nub comes and goes
    bool flick = hash(cell.x * 7.0 + floor(uClock * 3.0) * 3.1) > 0.985;
    nub = bump || flick;
  }
  // a flip snapping round: nubs all along the outline, back and belly as well as the fins,
  // thinning out as it settles and re-rolled every few frames, so the silhouette crackles for
  // an instant — the in-between a pixel animator draws instead of a turn
  if (uFlip > 0.0) nub = nub || hash(cell.x * 3.7 + up * 1.3 + floor(uClock * 20.0) * 5.3) < uFlip * 0.55;
  if (edge && nub) d.y += up;
  // the legs: u0, u1 across and the root and tip down, in uv; none when u1 is not past u0
  if (uLegs.y > uLegs.x && cuv.x > uLegs.x && cuv.x < uLegs.y && cuv.y > uLegs.z) {
    float down = clamp((cuv.y - uLegs.z) / (uLegs.w - uLegs.z), 0.0, 1.0);
    // two waves along the row, some four legs to a wave on the mantis shrimp's: shorter and a
    // column's offset differs from the next by more than a texel, and a leg tears in two
    float wave = (uLegs.y - uLegs.x) * uSize.x * 0.5;
    float fromTail = cell.x - uLegs.x * uSize.x;
    // an eighth of a stride a held frame, on the fins' frames: at twice their rate the stride
    // came round three times a second and was a shimmer, not legs
    float phase = frame * 0.785 - fromTail * 6.283 / wave;
    // the tip's swing, a third of a leg's spacing each way, and never under a texel
    float step = max(1.0, uSize.x * 0.018);
    d.x += floor(down * step * cos(phase) + 0.5);
    // lifted while it comes forward, when the cosine climbs; on the ground going back
    d.y -= floor(down * step * 0.6 * max(0.0, -sin(phase)) + 0.5);
  }
  // the trail: tips at u0, root at u1; none when u1 is not past u0
  if (uTrail.y > uTrail.x && cuv.x < uTrail.y) {
    float along = clamp((uTrail.y - cuv.x) / (uTrail.y - uTrail.x), 0.0, 1.0);
    float fromRoot = (uTrail.y - cuv.x) * uSize.x;
    // a wave and a half down the trail, one to each pulse: the beat is the bell's, so the
    // ripple leaves the rim as it squeezes. Held a twelfth of a pulse at a time
    float wave = (uTrail.y - uTrail.x) * uSize.x / 1.5;
    float beat = floor(uBeat * 2.0) / 2.0;
    // a strand runs a little behind the one above it, so they do not swing as one sheet; a
    // fraction of a radian a row, or neighbouring rows part by more than a texel and a strand tears
    float phase = beat - fromRoot * 6.283 / wave + cell.y * 0.08;
    float swing = max(1.0, uSize.y * 0.05);
    d.y += floor(pow(along, 1.3) * swing * sin(phase) + 0.5);
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
  // the mimic: the rock under the face, below this pixel, with the body's own shading over it.
  // Untinted, as the rock is: a tint on the body would set it apart from what it wears
  if (uMimic > 0.0 && c.a > 0.0) {
    vec2 n = uSurf.zw, u = vec2(-n.y, n.x), rel = vWorld - uSurf.xy;
    vec2 foot = uSurf.xy + u * dot(rel, u);
    float h = max(dot(rel, n), 0.0);
    vec4 r = rock(foot - n * (uMimicDepth.x + h * uMimicDepth.y));
    // a thin ledge, read through: the lip itself
    if (r.a < 0.5) r = rock(foot - n * uMimicDepth.x);
    // the face is a line only near where it was found: under a step down from it, on down to
    // the rock below, or the part of the body over the step wore nothing
    for (int k = 1; k <= 8 && r.a < 0.5; k++) r = rock(foot - n * uMimicDepth.x * float(1 + k * 2));
    if (r.a > 0.5) {
      float lum = dot(c.rgb / c.a, vec3(0.3, 0.59, 0.11));
      // This is opaque skin taking on a material, not the water showing through it.
      // Keep the raised object readable even when the sampled rock is in deep shadow.
      vec3 stone = r.rgb / r.a;
      float stoneLum = dot(stone, vec3(0.3, 0.59, 0.11));
      stone *= max(1.0, 0.16 / max(stoneLum, 0.001));
      vec3 worn = stone * clamp(0.65 + lum * 0.8, 0.65, 1.25) * c.a * vColor.a;
      finalColor.rgb = mix(finalColor.rgb, worn, uMimic);
    }
  }
  if (uPattern > 0.0 && c.a > 0.01) {
    vec3 marking = texture(uRock, vec2(fract(cuv.x * 2.0), cuv.y)).rgb;
    finalColor.rgb = mix(finalColor.rgb, marking * c.a * vColor.a, uPattern);
  }
  // dazed (the Angler's glow): the body drained toward its own grey, a little dimmed. A tint only
  // multiplies, so it could darken a red animal but never take the red out of it
  finalColor.rgb = mix(finalColor.rgb, vec3(dot(finalColor.rgb, vec3(0.3, 0.59, 0.11)) * 0.85), uGrey);
  // a hit: the body goes white for a few frames. Premultiplied, so white is the alpha
  finalColor.rgb = mix(finalColor.rgb, vec3(finalColor.a), uFlash);
  // a carcass's rim, decided per texel like the nubs, and never tinted: the tint is what dims
  // the dead body, and the rim is there to be seen on it
  if (uRim > 0.0 && c.a < 0.5) {
    vec2 t = floor(p);
    float n = max(max(texel(t + vec2(1.0, 0.0)).a, texel(t - vec2(1.0, 0.0)).a),
                  max(texel(t + vec2(0.0, 1.0)).a, texel(t - vec2(0.0, 1.0)).a));
    if (n > 0.5) finalColor = vec4(uRimColor, 1.0) * (uRim * vColor.a);
  }
}
`;

let program: GlProgram | null = null;

export interface LivingSkin {
  /** Carries `texture` because a mesh's shader has to: `Mesh.texture` writes through to it. */
  shader: Shader & { texture: Texture };
  uniforms: UniformGroup;
  /** Point the skin at another bake of the same crop — the jaw opening. */
  use(texture: Texture): void;
  /** The picture the mimic reads the rock from (`rockOf`). */
  wear(texture: Texture): void;
}

/**
 * A skin for one strip. `body` is the body's half-depth over the strip's half-height, which
 * is how the shader tells a fin from a flank without a mask baked for it.
 */
export function livingSkin(texture: Texture, body: number, legs: Baked['legs'] = null,
                           trail: Baked['trail'] = null): LivingSkin {
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
    // a flip's recoil, 1 as it snaps round to 0 settled (`FishView`)
    uFlip: { value: 0, type: 'f32' },
    // a hit's white flash, 0..1 (`FishView.hurt`)
    uFlash: { value: 0, type: 'f32' },
    // dazed, drained toward grey, 0..1 (`FishView.dazed`)
    uGrey: { value: 0, type: 'f32' },
    // a carcass's red outline, 0 off to 1 full (`FishView.lie`)
    uRim: { value: 0, type: 'f32' },
    uRimColor: { value: new Float32Array([1, 0.16, 0.12]), type: 'vec3<f32>' },
    // a sprite's legs, walked in a wave (`Baked.legs`); off at zero width
    uLegs: { value: new Float32Array(legs ?? [0, 0, 0, 0]), type: 'vec4<f32>' },
    // what trails behind a sprite's bell, waved on the pulse (`Baked.trail`); off at zero width
    uTrail: { value: new Float32Array(trail ?? [0, 0]), type: 'vec2<f32>' },
    // the mimic (`FishView`'s, for a reef octopus): how far, 0..1; the strip's frame to the
    // world's; the room's rock picture's corner and one over its size, and its texels; the face
    // held, as a point on it and the way out; and how deep under it the colour is read, past the
    // lip and per unit of height
    uMimic: { value: 0, type: 'f32' },
    uPattern: { value: 0, type: 'f32' },
    uToWorld: { value: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), type: 'mat3x3<f32>' },
    uRockRect: { value: new Float32Array([0, 0, 1, 1]), type: 'vec4<f32>' },
    uRockSize: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
    uSurf: { value: new Float32Array([0, 0, 0, -1]), type: 'vec4<f32>' },
    uMimicDepth: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
  });
  const shader = Object.assign(
    new Shader({ glProgram: program,
                 resources: { uTexture: texture.source, uRock: Texture.WHITE.source, living: uniforms } }),
    { texture });
  return {
    shader, uniforms,
    use(t) { shader.resources.uTexture = t.source; },
    wear(t) { shader.resources.uRock = t.source; },
  };
}
