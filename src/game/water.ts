import { Container, Filter, GlProgram, Sprite, Texture, type UniformGroup } from 'pixi.js';
import { waterAt } from './zones';
import { clamp, lerp } from './util';
import type { View } from './view';
import { DEPTH_MAX } from './world';

const vertex = `
attribute vec2 aPosition;
varying vec2 vUv;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition() {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
void main() {
  gl_Position = filterVertexPosition();
  vUv = aPosition;
}
`;

const fragment = `
precision highp float;
varying vec2 vUv;

uniform vec2 uView;      // world units covered by the screen
uniform vec2 uCam;       // camera centre, world units
uniform float uTime;
uniform vec3 uNear;      // water colour at the top of the screen
uniform vec3 uFar;       // water colour at the bottom of the screen
uniform vec3 uBelow;     // colour of the tier beneath the next thermocline
uniform float uGateY;    // world depth of the next thermocline
uniform float uGateOpen; // 0 sealed, 1 open
uniform float uLight;
uniform float uGlow;
uniform float uDread;   // how close something that can eat you is, 0..1

// --- biome: the visual identity of the tier the camera is in ----------------
uniform float uTurbid;     // how much of the frame the drifting masses cover
uniform float uCloudScale; // their frequency — small and busy, or vast and slow
uniform float uCloudEdge;  // soft haze (0) to hard billows (1)
uniform float uRays;       // strength of the god rays
uniform float uShimmer;    // the fast second field: caustics up top, glimmer down low
uniform vec3 uAccent;      // colour of that shimmer, and of the biome's own light
uniform float uAmbient;    // what the water glows with when nothing lights it

// sin-free hash: transcendentals in the inner loop are the single most expensive
// thing in this shader, and this is visually indistinguishable
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// octave count is the other lever: only the main cloud field needs depth
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + 17.3; a *= 0.5; }
  return v;
}
float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * vnoise(p); p = p * 2.03 + 17.3; a *= 0.5; }
  return v;
}
float fbm2(vec2 p) {
  return 0.5 * vnoise(p) + 0.25 * vnoise(p * 2.03 + 17.3) + 0.25;
}

void main() {
  vec2 uv = vUv;
  vec2 world = uCam + (uv - 0.5) * uView;

  // one radial falloff for the whole pass: 0 at the centre, 1 at a corner, and
  // aspect-corrected so it is a circle on screen rather than a stretched ellipse
  vec2 pv = uv - 0.5;
  pv.x *= uView.x / max(uView.y, 1.0);
  float rad = length(pv) / max(length(vec2(0.5 * uView.x / max(uView.y, 1.0), 0.5)), 0.001);

  // --- base column gradient -------------------------------------------------
  vec3 tint = mix(uNear, uFar, smoothstep(0.0, 1.0, uv.y));
  vec3 base = tint * 0.34;
  vec3 mass = tint * 1.15;

  // --- drifting organic matter: two domain-warped noise fields --------------
  vec2 q = world * 0.0013 * uCloudScale;
  float warp = fbm3(q * 0.6 + vec2(uTime * 0.014, uTime * -0.009));
  // four octaves here, not three: this is the field the eye actually reads, and at three
  // it loses its high frequencies and the smoothstep below turns it into hard-edged slabs
  float body = fbm(q * 1.35 + warp * 1.6 + vec2(uTime * -0.021, uTime * 0.016));
  float fine = fbm2(q * 4.2 + warp * 2.1 + vec2(uTime * 0.04, uTime * -0.03));

  // clouds are lit masses hanging in dark water, with luminous edges. The biome sets
  // where the threshold sits (how much water is cloud) and how wide the ramp is —
  // a wide ramp is haze, a narrow one is a billow with a hard lip.
  float lo = 0.62 - uTurbid * 0.40;
  float ramp = mix(0.40, 0.11, uCloudEdge);
  float blob = smoothstep(lo, lo + ramp, body);
  float rim = smoothstep(lo + ramp * 0.1, lo + ramp * 0.5, body)
            - smoothstep(lo + ramp * 0.6, lo + ramp * 1.1, body);

  vec3 col = mix(base, mass, blob);
  col += mass * rim * (0.28 + uLight * 0.22) * (0.5 + uCloudEdge);
  // ambient carries the biome's own colour, not just the column's: below the twilight
  // the column tint is nearly black, and a self-lit water is the only thing that keeps
  // the deep tiers apart from each other
  col += mix(tint, uAccent * 0.5, 0.75) * uAmbient * (0.55 + 0.45 * blob);

  // the fast field reads as surface caustics where there is light and as loose
  // biolume glimmer where there is none — same noise, the biome picks the colour.
  // It must not scale away with uLight, or the deepest biomes lose their signature.
  col += uAccent * pow(max(fine - 0.45, 0.0), 2.0) * uShimmer * (0.55 + uLight * 0.7);

  // --- the tier below, always visible through the thermocline ---------------
  float dy = world.y - uGateY;
  // reuse the cloud noise rather than paying for another fbm — but remapped continuously.
  // fract() here is a sawtooth, and its wrap shows up as a hard seam across the water.
  float belowN = clamp(body * 0.75 + fine * 0.35, 0.0, 1.0);
  vec3 deep = mix(uBelow * 0.22, uBelow * 0.85, smoothstep(0.3, 0.78, belowN));
  // water dims as it approaches the seal, like looking down into a trench
  col = mix(col, col * 0.5, smoothstep(-340.0, 0.0, dy) * 0.62);
  float belowMask = smoothstep(-10.0, 150.0, dy);
  col = mix(col, deep, belowMask);

  // the seal itself: a bright shear surface, faint once you can pass it
  float sheet = exp(-abs(dy) / 34.0);
  float shear = 0.5 + 0.5 * sin(world.x * 0.012 + uTime * 0.8 + body * 4.0);
  float seal = mix(1.0, 0.22, uGateOpen);

  // a sealed tier sits in shadow — you can see into it, you cannot be in it
  col = mix(col, col * 0.52, belowMask * seal * 0.62);
  // and the barrier casts a contact shadow on the water directly beneath it
  col = mix(col, col * 0.55, exp(-max(dy, 0.0) / 85.0) * seal * 0.55);
  col += vec3(0.55, 0.90, 0.95) * sheet * seal * (0.45 + 0.55 * shear);
  col += vec3(0.20, 0.55, 0.62) * exp(-abs(dy) / 190.0) * seal * 0.16;

  // --- god rays ------------------------------------------------------------
  // shafts are cut from noise sampled across a slightly slanted axis, so they lean the
  // way light refracts, and they thin out as the column swallows them
  float axis = world.x * 0.0011 + world.y * 0.00042;
  // the frequency has to be high enough that several shafts cross the screen at once,
  // otherwise a single noise lobe fills the view and it just reads as fog
  float wide = fbm3(vec2(axis * 15.0, uTime * 0.02));
  float thin = fbm2(vec2(axis * 36.0 + 31.0, uTime * 0.035));
  float rays = pow(smoothstep(0.52, 0.92, wide), 1.8) * 0.6
             + pow(smoothstep(0.62, 0.97, thin), 2.5) * 0.32;
  float reach = exp(-max(world.y, 0.0) / 1700.0);
  float aloft = 1.0 - smoothstep(-0.2, 1.2, uv.y);
  col += uAccent * rays * reach * uLight * uRays * (0.1 + 0.3 * aloft);
  col += uAccent * rays * rays * reach * uLight * uRays * 0.07;

  float d = length((uv - 0.5) * uView);
  col += vec3(0.30, 0.95, 0.78) * uGlow * exp(-d / 380.0) * 0.45;

  // --- dread: something large has noticed you ------------------------------
  if (uDread > 0.01) {
    float grey = dot(col, vec3(0.3, 0.59, 0.11));
    col = mix(col, vec3(grey * 0.85, grey * 0.72, grey * 0.72), uDread * 0.5);
    float edge = smoothstep(0.2, 1.0, rad) * uDread;
    float pulse = 0.55 + 0.45 * sin(uTime * 5.0);
    // a tint, not a second vignette — stacking two multiplies the corners to mud
    col = mix(col, col * 0.72, edge * 0.7);
    col += vec3(0.24, 0.02, 0.03) * edge * pulse * 0.8;
  }

  // --- vignette -------------------------------------------------------------
  col *= mix(1.0, 0.30, smoothstep(0.22, 1.02, rad));

  // a touch of ordered dither: these gradients are wide, dark and upscaled from a
  // lower-resolution pass, which is exactly where 8-bit banding shows up
  float dither = fract(dot(gl_FragCoord.xy, vec2(0.7548777, 0.5698403)));
  col += (dither - 0.5) / 255.0;

  gl_FragColor = vec4(col, 1.0);
}
`;

/** Colour of the water column at a given depth, sampled from the tier palette. */
// Deliberately dim: the creatures are the only bright thing in the frame, and every
// step of this ramp was pulled down until a mid-tier fish reads as a light source
// against it rather than as a shape cut out of it.
const TINTS: [number, [number, number, number]][] = [
  [0, [0.10, 0.42, 0.40]],
  [1300, [0.055, 0.30, 0.31]],
  [3000, [0.030, 0.18, 0.21]],
  [5200, [0.017, 0.10, 0.135]],
  [7400, [0.011, 0.05, 0.077]],
  [DEPTH_MAX, [0.006, 0.022, 0.042]],
];

export function waterColor(y: number): [number, number, number] {
  y = clamp(y, 0, DEPTH_MAX);
  for (let i = 1; i < TINTS.length; i++) {
    if (y <= TINTS[i][0]) {
      const [ay, a] = TINTS[i - 1], [by, b] = TINTS[i];
      const t = (y - ay) / (by - ay);
      return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
    }
  }
  return TINTS[TINTS.length - 1][1];
}

export function lightAt(y: number) {
  return clamp(1 - y / 6200, 0.03, 1);
}

/** Full-screen procedural water: fog, thermoclines and the tier below. */
export class Water {
  layer = new Container();
  private sprite = new Sprite(Texture.WHITE);
  /** The live uniform store Pixi builds from the definitions below. */
  private u!: {
    uView: Float32Array; uCam: Float32Array; uTime: number;
    uNear: Float32Array; uFar: Float32Array; uBelow: Float32Array;
    uGateY: number; uGateOpen: number; uLight: number; uGlow: number; uDread: number;
    uTurbid: number; uCloudScale: number; uCloudEdge: number; uRays: number;
    uShimmer: number; uAccent: Float32Array; uAmbient: number;
  };
  private group!: UniformGroup;
  private defs = {
    uView: { value: new Float32Array([1920, 1080]), type: 'vec2<f32>' },
    uCam: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
    uTime: { value: 0, type: 'f32' },
    uNear: { value: new Float32Array([0.1, 0.5, 0.5]), type: 'vec3<f32>' },
    uFar: { value: new Float32Array([0.1, 0.4, 0.4]), type: 'vec3<f32>' },
    uBelow: { value: new Float32Array([0.05, 0.2, 0.25]), type: 'vec3<f32>' },
    uGateY: { value: DEPTH_MAX * 4, type: 'f32' },
    uGateOpen: { value: 0, type: 'f32' },
    uLight: { value: 1, type: 'f32' },
    uGlow: { value: 0, type: 'f32' },
    uDread: { value: 0, type: 'f32' },
    uTurbid: { value: 0.34, type: 'f32' },
    uCloudScale: { value: 1, type: 'f32' },
    uCloudEdge: { value: 0.35, type: 'f32' },
    uRays: { value: 1, type: 'f32' },
    uShimmer: { value: 0.5, type: 'f32' },
    uAccent: { value: new Float32Array([0.7, 1, 0.86]), type: 'vec3<f32>' },
    uAmbient: { value: 0.1, type: 'f32' },
  };

  constructor() {
    const filter = new Filter({
      glProgram: GlProgram.from({ vertex, fragment, name: 'water' }),
      resources: { waterUniforms: this.defs },
      // the water is all low-frequency fog; shading it at half resolution costs a
      // quarter of the fragments and is indistinguishable once it is upscaled
      resolution: 0.4,
      antialias: false,
    });
    // write through the group Pixi actually uploads, not the definition object
    this.group = filter.resources.waterUniforms as UniformGroup;
    this.u = this.group.uniforms as typeof this.u;
    this.sprite.filters = [filter];
    this.layer.addChild(this.sprite);
  }

  resize(w: number, h: number) {
    this.sprite.width = w;
    this.sprite.height = h;
  }

  update(view: View, glow: number, dread: number, gateY: number, gateOpen: boolean) {
    const { x: camX, y: camY } = view;
    const u = this.u;
    u.uView[0] = view.w; u.uView[1] = view.h;
    u.uCam[0] = camX; u.uCam[1] = camY;
    u.uTime = view.t;

    u.uNear.set(waterColor(camY - view.h * 0.5));
    u.uFar.set(waterColor(camY + view.h * 0.5));

    u.uGateY = gateY;
    u.uGateOpen = gateOpen ? 1 : 0;
    u.uBelow.set(waterColor(Math.min(gateY + 700, DEPTH_MAX)));
    u.uLight = lightAt(camY);
    u.uGlow = glow;
    u.uDread += (dread - u.uDread) * 0.08;

    // the biome is already cross-faded across the thermocline by depth; easing on top
    // of that keeps a fast dive from stepping the cloud field
    const b = waterAt(camY);
    u.uTurbid = lerp(u.uTurbid, b.turbid, 0.05);
    u.uCloudScale = lerp(u.uCloudScale, b.cloudScale, 0.05);
    u.uCloudEdge = lerp(u.uCloudEdge, b.cloudEdge, 0.05);
    u.uRays = lerp(u.uRays, b.rays, 0.05);
    u.uShimmer = lerp(u.uShimmer, b.shimmer, 0.05);
    u.uAmbient = lerp(u.uAmbient, b.ambient, 0.05);
    for (let i = 0; i < 3; i++) u.uAccent[i] = lerp(u.uAccent[i], b.accent[i], 0.05);
    this.group.update();
  }

}
