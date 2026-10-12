import { MeshSimple, Texture } from 'pixi.js';
import { livingSkin } from './living';
import { lerp } from '../../core/util';

/** Shallow, concave membranes joining only the proximal parts of adjacent arms. */
export class ArmWeb {
  readonly mesh: MeshSimple;
  readonly skin;
  private readonly texture: Texture;
  private readonly vertices: Float32Array;

  constructor(private readonly count: number) {
    const canvas = document.createElement('canvas'); canvas.width = 8; canvas.height = 8;
    const ctx = canvas.getContext('2d')!;
    for (let y = 0; y < 8; y++) {
      ctx.fillStyle = y < 2 ? '#9B4933' : y < 5 ? '#6C2D29' : '#351825'; ctx.fillRect(0, y, 8, 1);
    }
    this.texture = Texture.from(canvas); this.texture.source.scaleMode = 'nearest';
    this.skin = livingSkin(this.texture, 2); this.skin.uniforms.uniforms.uRipple = 0;
    this.vertices = new Float32Array((count - 1) * 10);
    const uv = new Float32Array(this.vertices.length), indices = new Uint32Array((count - 1) * 9);
    for (let i = 0; i < count - 1; i++) {
      uv.set([0.5, 0, 0, 0.6, 0.5, 1, 1, 0.6, 0.5, 0], i * 10);
      const a = i * 5; indices.set([a, a + 1, a + 2, a, a + 2, a + 3, a, a + 3, a + 4], i * 9);
    }
    this.mesh = new MeshSimple({ texture: this.texture, vertices: this.vertices, uvs: uv, indices, shader: this.skin.shader });
  }

  update(arms: readonly { verts: Float32Array }[], spread: number) {
    if (arms.length !== this.count) return;
    const point = (arm: number, fraction: number) => {
      const v = arms[arm].verts, cols = v.length / 4;
      const j = Math.min(cols - 1, Math.round((cols - 1) * fraction));
      return { x: (v[j * 4] + v[j * 4 + 2]) / 2, y: (v[j * 4 + 1] + v[j * 4 + 3]) / 2 };
    };
    for (let i = 0; i < arms.length - 1; i++) {
      const a = point(i, 0), b = point(i + 1, 0);
      const tipA = point(i, lerp(0.14, 0.22, spread)), tipB = point(i + 1, lerp(0.14, 0.22, spread));
      // A soft inward scallop, never a straight sheet joining distant arm tips.
      const notch = { x: lerp((a.x + b.x) / 2, (tipA.x + tipB.x) / 2, 0.65),
        y: lerp((a.y + b.y) / 2, (tipA.y + tipB.y) / 2, 0.65) };
      this.vertices.set([a.x, a.y, tipA.x, tipA.y, notch.x, notch.y, tipB.x, tipB.y, b.x, b.y], i * 10);
    }
    this.mesh.vertices = this.vertices;
  }

  destroy() { this.skin.shader.destroy(); this.mesh.destroy(); this.texture.destroy(true); }
}
