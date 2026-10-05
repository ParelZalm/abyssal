/**
 * The title's deep water, drawn on the GPU: the dark, the whirlpool turning above it, the
 * rays it lets down, the thunder that flickers through it, and the leviathan in it.
 *
 * The whirlpool is a vortex seen from below in perspective — a disc flattened to the ellipse
 * the reference has (`TitleScene`'s `WHIRL`). Its arms are a logarithmic spiral turning as
 * one, bent by foam that turns faster the nearer the eye, as water in a vortex does; a turned
 * picture of rings (what the generator painted) reads as a plate spinning, not as water. It
 * turns slowly — a full turn is minutes — and soft: broad arms of low noise, no fine detail.
 * The rays are angular noise fanning down from its eye, swaying slower still.
 *
 * The leviathan is in here, not on the canvas over it, because it is behind everything and
 * because it is dark against dark: what shows it is the thunder. In the black it is a shape
 * a shade darker than the water; in a flash the water behind it goes bright and it stands in
 * it as a wall of black with light along its back. Its arms bend by shifting where its
 * texture is read, wider toward their tips. Its eyes are drawn over, on the canvas, where
 * they can be crisp.
 *
 * Drawn at the painting's own pixel (`resize`) and shown with hard pixels: the water sits on
 * the same coarse grid as the rock, and a frame of it costs a few thousand fragments.
 */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform vec4 uWhirl;
uniform float uFlash;
uniform sampler2D uLev;
uniform vec4 uLevRect;
uniform float uLevDir;
uniform float uLevOn;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v / 0.875;
}

void main() {
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  float y = px.y / uRes.y;

  // the deep: a little navy under the light, and black toward the floor
  vec3 col = mix(vec3(0.004, 0.028, 0.066), vec3(0.0, 0.004, 0.012), smoothstep(0.05, 0.95, y));

  // the whirlpool, in its own plane: a radius and an angle on the flattened disc
  vec2 d = (px - uWhirl.xy) / uWhirl.zw;
  float r = length(d), a = atan(d.y, d.x), lr = log(r + 0.002);
  // the foam turns faster the nearer the eye — but sheared for ever that winds every arm into
  // a ring, so it is sheared over a cycle, two cycles half apart and cross-faded
  float T = 40.0;
  float t1 = mod(uTime, T), t2 = mod(uTime + T * 0.5, T);
  float w1 = 1.0 - abs(2.0 * t1 / T - 1.0);
  // read round a circle, not off the angle itself: the angle jumps a whole turn on the line
  // running left from the eye, and noise read off it showed that line as a seam
  float s1 = a + t1 * 0.12 / (r + 0.25), s2 = a + t2 * 0.12 / (r + 0.25);
  float f1 = fbm(vec2(cos(s1), sin(s1)) * 1.3 + vec2(lr * 2.2, lr * 1.1) + 3.0);
  float f2 = fbm(vec2(cos(s2), sin(s2)) * 1.3 + vec2(lr * 2.2, lr * 1.1) + 7.0);
  float foam = mix(f2, f1, w1);
  // the arms turn as one body, a logarithmic spiral, and the foam bends them
  float ph = a + uTime * 0.035 + lr * 2.2;
  float arms = 0.5 + 0.5 * sin(ph * 2.0 + foam * 3.0);
  float disc = smoothstep(1.4, 0.1, r);
  float swirl = disc * (0.38 * arms * arms + 0.4 * foam * arms);
  float core = exp(-r * 5.0);
  col += mix(vec3(0.01, 0.12, 0.32), vec3(0.2, 0.58, 0.95), arms * smoothstep(1.2, 0.2, r)) * swirl;
  col += vec3(0.45, 0.8, 1.0) * core * (1.0 + 0.15 * sin(uTime * 0.4));

  // the rays it lets down: angular noise fanning from its eye, slow to sway
  vec2 c = px - uWhirl.xy;
  float ang = atan(c.x, max(c.y, 1.0));
  float dist = length(c) / uRes.y;
  float rays = fbm(vec2(ang * 6.0, uTime * 0.015)) * fbm(vec2(ang * 15.0 + 3.1, uTime * 0.025));
  rays = pow(rays * 1.6, 2.2) * smoothstep(1.25, 0.0, abs(ang)) * exp(-dist * 1.7) * smoothstep(0.0, 0.06, c.y / uRes.y);
  col += vec3(0.03, 0.2, 0.46) * rays * (1.0 + 3.0 * uFlash);

  // thunder overhead: the eye of the whirlpool blazes and the whole water is lit from above
  col += vec3(0.6, 0.85, 1.0) * uFlash * exp(-r * 1.5) * 0.9;
  col += vec3(0.12, 0.26, 0.42) * uFlash * (0.55 * exp(-dist * 1.1) + 0.12);

  if (uLevOn > 0.5) {
    vec2 q = (px - uLevRect.xy) / uLevRect.zw + 0.5;
    if (uLevDir < 0.0) q.x = 1.0 - q.x;
    float bend = q.x < 0.6 ? pow(1.0 - q.x / 0.6, 1.3) : 0.0;
    q.y -= sin(uTime * 0.45 + q.x * 6.0) * 0.035 * bend;
    if (q.x > 0.0 && q.x < 1.0 && q.y > 0.0 && q.y < 1.0) {
      vec4 lev = texture2D(uLev, q);
      float above = texture2D(uLev, q - vec2(0.0, 1.0 / uLevRect.w)).a;
      float vis = 0.16 + 0.84 * uFlash;
      col = mix(col, vec3(0.0, 0.003, 0.008), lev.a * vis);
      col += vec3(0.45, 0.7, 1.0) * max(0.0, lev.a - above) * uFlash * 1.6;
      col += lev.rgb * lev.a * uFlash * 0.35;
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export interface AbyssFrame {
  time: number;
  flash: number;
  /** The whirlpool's centre and radii, in scene pixels. */
  whirl: { x: number; y: number; rx: number; ry: number };
  /** The leviathan's box (centre, size) in scene pixels and the way it faces, or null. */
  lev: { x: number; y: number; w: number; h: number; dir: number } | null;
}

export class Abyss {
  readonly element = document.createElement('canvas');
  private readonly gl: WebGLRenderingContext | null;
  private prog: WebGLProgram | null = null;
  private tex: WebGLTexture | null = null;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  /** Scene pixels per pixel of this canvas. */
  private k = 6;

  constructor() {
    this.element.className = 'abyss';
    this.gl = this.element.getContext('webgl', { antialias: false, premultipliedAlpha: false });
    const gl = this.gl;
    if (!gl) return;
    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(p);
    gl.useProgram(p);
    this.prog = p;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const at = gl.getAttribLocation(p, 'aPos');
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['uRes', 'uTime', 'uWhirl', 'uFlash', 'uLev', 'uLevRect', 'uLevDir', 'uLevOn']) {
      this.loc[n] = gl.getUniformLocation(p, n);
    }
  }

  /** The canvas sized to the scene at one texel per `pixel` of it: the painting's own pixel. */
  resize(w: number, h: number, pixel: number) {
    this.k = pixel;
    this.element.width = Math.max(1, Math.ceil(w / pixel));
    this.element.height = Math.max(1, Math.ceil(h / pixel));
  }

  /** The leviathan's picture, cut from its sheet. */
  setLeviathan(art: HTMLCanvasElement) {
    const gl = this.gl;
    if (!gl) return;
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, art);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  draw(f: AbyssFrame) {
    const gl = this.gl;
    if (!gl || !this.prog) return;
    const k = 1 / this.k, L = this.loc;
    gl.viewport(0, 0, this.element.width, this.element.height);
    gl.uniform2f(L.uRes, this.element.width, this.element.height);
    gl.uniform1f(L.uTime, f.time);
    gl.uniform4f(L.uWhirl, f.whirl.x * k, f.whirl.y * k, f.whirl.rx * k, f.whirl.ry * k);
    gl.uniform1f(L.uFlash, f.flash);
    gl.uniform1i(L.uLev, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    const lv = f.lev;
    gl.uniform1f(L.uLevOn, lv && this.tex ? 1 : 0);
    if (lv) {
      gl.uniform4f(L.uLevRect, lv.x * k, lv.y * k, lv.w * k, lv.h * k);
      gl.uniform1f(L.uLevDir, lv.dir);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  destroy() {
    // off the page first: a context lost while still shown is a white frame
    this.element.remove();
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
