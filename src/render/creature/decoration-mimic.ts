import { Buffer, BufferUsage, Container, GlProgram, Graphics, MeshSimple, Shader, Matrix, Texture, UniformGroup } from 'pixi.js';
import { bakeDecoration, type Piece } from '../decor';
import { artDensity, artVersion } from '../pixel';
import { clamp, lerp } from '../../core/util';

const COLS = 96;
interface Profile { left: number; right: number; top: number[]; bottom: number[] }
/** The occupied contour, rather than a rectangle containing transparent sprite margins. */
export function silhouetteProfile(canvas: HTMLCanvasElement): Profile {
  const { width: w, height: h } = canvas;
  const pixels = canvas.getContext('2d')!.getImageData(0, 0, w, h).data;
  const top = Array<number>(w).fill(h), bottom = Array<number>(w).fill(0);
  let left = w - 1, right = 0;
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
    if (pixels[(y * w + x) * 4 + 3] < 128) continue;
    top[x] = Math.min(top[x], y); bottom[x] = Math.max(bottom[x], y + 1);
    left = Math.min(left, x); right = Math.max(right, x);
  }
  // Empty columns of branching coral collapse to the base, then open as the skin reshapes.
  for (let x = left; x <= right; x++) if (top[x] === h) top[x] = bottom[x] = h;
  return { left, right: right + 1, top, bottom };
}

/** Signed distance lets holes open from their edges instead of switching off at 50%. */
export function shapeField(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const w = canvas.width, h = canvas.height;
  const pixels = canvas.getContext('2d')!.getImageData(0, 0, w, h).data;
  const distance = (solid: boolean) => {
    const d = Float32Array.from({ length: w * h }, (_, i) => (pixels[i * 4 + 3] >= 128) === solid ? 0 : w + h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x) d[i] = Math.min(d[i], d[i - 1] + 1);
      if (y) d[i] = Math.min(d[i], d[i - w] + 1);
    }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (x + 1 < w) d[i] = Math.min(d[i], d[i + 1] + 1);
      if (y + 1 < h) d[i] = Math.min(d[i], d[i + w] + 1);
    }
    return d;
  };
  const inside = distance(false), outside = distance(true), image = new ImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    image.data[i * 4] = clamp(128 + (inside[i] - outside[i]) * 8, 0, 255);
    image.data[i * 4 + 3] = 255;
  }
  const result = document.createElement('canvas'); result.width = w; result.height = h;
  result.getContext('2d')!.putImageData(image, 0, 0);
  return result;
}

/** Continue the object's markings through empty texels for skin that has not opened yet. */
function skinPattern(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const w = canvas.width, h = canvas.height, image = canvas.getContext('2d')!.getImageData(0, 0, w, h);
  const seen = new Uint8Array(w * h), queue: number[] = [];
  for (let i = 0; i < w * h; i++) if (image.data[i * 4 + 3]) { seen[i] = 1; queue.push(i); }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head], x = i % w, y = Math.floor(i / w);
    for (const n of [x ? i - 1 : -1, x + 1 < w ? i + 1 : -1, y ? i - w : -1, y + 1 < h ? i + w : -1]) {
      if (n < 0 || seen[n]) continue;
      seen[n] = 1; queue.push(n);
      image.data.set(image.data.subarray(i * 4, i * 4 + 4), n * 4);
    }
  }
  const result = document.createElement('canvas'); result.width = w; result.height = h;
  result.getContext('2d')!.putImageData(image, 0, 0); return result;
}

export interface MimicBody {
  canvas: HTMLCanvasElement;
  texture: Texture;
  vertices: Float32Array;
  /** Body-mesh points, already carried into the disguise's world-space frame. */
  point(x: number, y: number): { x: number; y: number };
}

const vertex = `#version 300 es
in vec2 aPosition;
in vec2 aUV;
in vec2 aTargetUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform vec4 uWorldColorAlpha;
uniform vec4 uColor;
out vec2 vUV;
out vec2 vTargetUV;
out vec4 vColor;
void main() {
 gl_Position=vec4((uProjectionMatrix*uWorldTransformMatrix*uTransformMatrix*vec3(aPosition,1.0)).xy,0.0,1.0);
 vUV=aUV; vTargetUV=aTargetUV; vColor=uColor*uWorldColorAlpha;
}`;
const fragment = `#version 300 es
precision mediump float;
in vec2 vUV;
in vec2 vTargetUV;
in vec4 vColor;
uniform sampler2D uTexture;
uniform sampler2D uTarget;
uniform sampler2D uSourceShape;
uniform sampler2D uTargetShape;
uniform float uAmount;
out vec4 finalColor;
void main() {
 vec4 a=texture(uTexture,vUV), b=texture(uTarget,vTargetUV);
 float contour=mix(texture(uSourceShape,vUV).r,texture(uTargetShape,vTargetUV).r,uAmount);
 if(contour<128.0/255.0) discard;
 vec3 skin=a.rgb/max(a.a,0.001), disguise=b.rgb/max(b.a,0.001);
 if(b.a<0.01) disguise=skin;
 if(a.a<0.01) skin=disguise;
 finalColor=vec4(mix(skin,disguise,uAmount),1.0)*vColor;
}`;
let program: GlProgram | null = null;

/** One skin and one silhouette, reshaped from the mantle into the selected decoration. */
export class DecorationMimic extends Container {
  private piece: Piece | null = null;
  private version = -1;
  private eyes = new Graphics();
  private mesh: MeshSimple | null = null;
  private target: Texture | null = null;
  private sourceShape: Texture | null = null;
  private targetShape: Texture | null = null;
  get pattern(): Texture | null { return this.target; }
  private targetProfile: Profile | null = null;
  private targetBounds = { x: 0, y: 0, w: 1, h: 1 };
  private bodyCanvas: HTMLCanvasElement | null = null;
  private bodyProfile: Profile | null = null;
  private positions = new Float32Array(COLS * 4);
  private sourceUV = new Float32Array(COLS * 4);
  private targetUV = new Float32Array(COLS * 4);
  private uniforms = new UniformGroup({ uAmount: { value: 0, type: 'f32' } });

  get activePiece(): Piece | null { return this.visible ? this.piece : null; }

  update(piece: Piece | null, depth: number, amount: number, clock: number, body?: MimicBody) {
    piece ??= amount > 0.001 ? this.piece : null;
    this.visible = !!piece && !!body && amount > 0.001;
    if (!piece || !body) return;
    if (piece !== this.piece || this.version !== artVersion) this.prepare(piece, depth, body);
    if (this.bodyCanvas !== body.canvas) {
      this.bodyCanvas = body.canvas;
      this.bodyProfile = silhouetteProfile(body.canvas);
      this.mesh!.shader!.resources.uSourceShape = Texture.WHITE.source;
      this.sourceShape?.destroy(true);
      this.sourceShape = Texture.from(shapeField(body.canvas));
      this.sourceShape.source.scaleMode = 'nearest';
      this.mesh!.shader!.resources.uSourceShape = this.sourceShape.source;
    }
    const source = this.bodyProfile!, target = this.targetProfile!, bounds = this.targetBounds;
    const e = clamp(amount, 0, 1), pulse = 1 + Math.sin(clock * 0.9) * 0.004 * e;
    const w = body.canvas.width, h = body.canvas.height;
    const tw = this.target!.source.pixelWidth, th = this.target!.source.pixelHeight;
    const bodyCols = body.vertices.length / 4;
    for (let j = 0; j < COLS; j++) {
      const t = j / (COLS - 1);
      const sx = lerp(source.left + 0.5, source.right - 0.5, t);
      const tx = lerp(target.left + 0.5, target.right - 0.5, t);
      const si = clamp(Math.floor(sx), 0, w - 1), ti = clamp(Math.floor(tx), 0, tw - 1);
      const u = sx / w, column = (1 - u) * (bodyCols - 1), lo = Math.floor(column), hi = Math.min(bodyCols - 1, lo + 1);
      for (let edge = 0; edge < 2; edge++) {
        const sy = edge ? source.bottom[si] - 0.5 : source.top[si] + 0.5;
        const ty = edge ? target.bottom[ti] - 0.5 : target.top[ti] + 0.5;
        const v = sy / h;
        const sample = (axis: number) => {
          const at = (col: number) => lerp(body.vertices[col * 4 + axis], body.vertices[col * 4 + 2 + axis], v);
          return lerp(at(lo), at(hi), column - lo);
        };
        const from = body.point(sample(0), sample(1));
        const toX = (bounds.x + tx / tw * bounds.w) * 1.08 * pulse;
        const toY = (bounds.y + ty / th * bounds.h) * 1.08;
        const i = j * 4 + edge * 2;
        this.positions[i] = lerp(from.x, toX, e);
        this.positions[i + 1] = lerp(from.y, toY, e);
        this.sourceUV[i] = u; this.sourceUV[i + 1] = v;
        this.targetUV[i] = tx / tw; this.targetUV[i + 1] = ty / th;
      }
    }
    this.mesh!.vertices = this.positions;
    this.mesh!.geometry.getBuffer('aUV').update();
    this.mesh!.geometry.getBuffer('aTargetUV').update();
    this.mesh!.shader!.resources.uTexture = body.texture.source;
    this.uniforms.uniforms.uAmount = e;
    this.uniforms.update();
    const blink = clock % 7.5;
    this.eyes.visible = e > 0.95 && blink > 6.9 && blink < 7.15;
    this.eyes.scale.y = 0.4 + Math.sin((blink - 6.9) / 0.25 * Math.PI) * 0.6;
  }

  private prepare(piece: Piece, depth: number, body: MimicBody) {
    this.mesh?.shader?.destroy(); this.mesh?.destroy(); this.target?.destroy(true);
    this.piece = piece; this.version = artVersion;
    const density = artDensity();
    const picture = bakeDecoration({ ...piece, x: 0, y: 0 }, density, depth);
    const { texture, x, y, sx, sy, rotation, ax, ay } = picture;
    const transform = new Matrix().setTransform(x, y, 0, 0, sx, sy, rotation, 0, 0);
    const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) =>
      transform.apply({ x: (u - ax) * texture.width, y: (v - ay) * texture.height }));
    const left = Math.min(...corners.map(p => p.x)), top = Math.min(...corners.map(p => p.y));
    const width = Math.max(...corners.map(p => p.x)) - left, height = Math.max(...corners.map(p => p.y)) - top;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(width * density)); canvas.height = Math.max(1, Math.ceil(height * density));
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(density, 0, 0, density, -left * density, -top * density);
    ctx.transform(transform.a, transform.b, transform.c, transform.d, transform.tx, transform.ty);
    ctx.drawImage(texture.source.resource as HTMLCanvasElement, -ax * texture.width, -ay * texture.height);
    texture.destroy(true);
    this.targetBounds = { x: left, y: top, w: width, h: height };
    this.targetProfile = silhouetteProfile(canvas);
    this.target = Texture.from(skinPattern(canvas)); this.target.source.scaleMode = 'nearest';
    this.targetShape?.destroy(true);
    this.targetShape = Texture.from(shapeField(canvas)); this.targetShape.source.scaleMode = 'nearest';
    const indices = new Uint32Array((COLS - 1) * 6);
    for (let j = 0; j < COLS - 1; j++) {
      const a = j * 2; indices.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], j * 6);
    }
    program ??= GlProgram.from({ vertex, fragment, name: 'octopus-decoration-skin' });
    const shader = Object.assign(new Shader({ glProgram: program, resources: {
      uTexture: body.texture.source, uTarget: this.target.source,
      uSourceShape: this.sourceShape?.source ?? Texture.WHITE.source, uTargetShape: this.targetShape.source, morph: this.uniforms,
    } }), { texture: body.texture });
    this.mesh = new MeshSimple({ texture: body.texture, vertices: this.positions, uvs: this.sourceUV, indices, shader });
    this.mesh.geometry.addAttribute('aTargetUV', { buffer: new Buffer({ data: this.targetUV,
      usage: BufferUsage.VERTEX | BufferUsage.COPY_DST }), format: 'float32x2', stride: 8, offset: 0 });
    this.addChild(this.mesh, this.eyes);
    const w = Math.max(0.7, piece.h * 0.055), h = Math.max(0.3, piece.h * 0.012);
    this.eyes.clear().rect(-w * 1.4, 0, w, h).rect(w * 0.4, 0, w, h).fill(0x9c8864);
    this.eyes.alpha = 0.65;
    const nx = piece.grow === 'left' ? -1 : piece.grow === 'right' ? 1 : 0;
    const ny = piece.grow === 'up' ? -1 : piece.grow === 'down' ? 1 : 0;
    this.eyes.position.set(nx * piece.h * 0.38, ny * piece.h * 0.38);
    this.eyes.rotation = Math.atan2(ny, nx) + Math.PI / 2;
  }

  destroy(options?: Parameters<Container['destroy']>[0]) {
    this.mesh?.shader?.destroy(); this.mesh?.destroy(); this.target?.destroy(true);
    this.sourceShape?.destroy(true); this.targetShape?.destroy(true);
    this.mesh = null; this.target = null;
    super.destroy(options);
  }
}
