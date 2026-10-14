import { Texture } from 'pixi.js';

/** Browser regression for an opaque, continuous silhouette morph into an actual decoration. */
export function checkOctopusDecoration(nearestDisguise, DecorationMimic) {
  const near = { kind: 'brain', x: 10, y: 20, h: 30, seed: 23, grow: 'up', flip: false };
  const far = { kind: 'coral', x: 100, y: 20, h: 35, seed: 47, grow: 'up', flip: false };
  if (nearestDisguise([far, near], 0, 20) !== near) throw new Error('Did not choose the nearest decoration');
  if (nearestDisguise([], 0, 0) !== null) throw new Error('Empty room should use the rock fallback');
  const canvas = document.createElement('canvas'); canvas.width = 48; canvas.height = 24;
  const context = canvas.getContext('2d'); context.fillStyle = '#A7412D'; context.fillRect(1, 1, 46, 22);
  const texture = Texture.from(canvas);
  const body = { canvas, texture, vertices: new Float32Array([24, -24, 24, 0, -24, -24, -24, 0]),
    point: (x, y) => ({ x, y }) };
  const copy = new DecorationMimic();
  copy.update(near, 2600, 1, 6.95, body);
  const piece = copy.activePiece;
  if (piece.kind !== near.kind || piece.seed !== near.seed || piece.grow !== near.grow || piece.flip !== near.flip || piece.h !== near.h) {
    throw new Error('The disguise did not preserve the actual decoration design');
  }
  if (!copy.visible || copy.alpha !== 1 || copy.mesh.alpha !== 1) throw new Error('Morph must remain opaque');
  if (!copy.eyes.visible) throw new Error('Tiny squint did not appear in its short window');
  const positionsAt = amount => {
    copy.update(near, 2600, amount, 0, body);
    return Array.from(copy.positions);
  };
  const original = positionsAt(0), halfway = positionsAt(0.5), target = positionsAt(1);
  for (let i = 0; i < original.length; i++) {
    if (Math.abs(halfway[i] - (original[i] + target[i]) / 2) > 0.00001) {
      throw new Error('Mantle contour must morph continuously rather than spawn a growing object');
    }
  }
  const epsilon = positionsAt(0.0001);
  if (Math.max(...epsilon.map((x, i) => Math.abs(x - original[i]))) > 0.01) throw new Error('Discontinuous morph start');
  const span = points => Math.max(...points.filter((_, i) => i % 2 === 0)) - Math.min(...points.filter((_, i) => i % 2 === 0));
  let maximumPulse = 0;
  for (let j = 0; j < 100; j++) {
    copy.update(near, 2600, 1, j / 10, body);
    maximumPulse = Math.max(maximumPulse, Math.abs(span(Array.from(copy.positions)) / span(target) - 1));
  }
  if (maximumPulse > 0.004001) throw new Error('Pulse is too conspicuous');
  copy.update(near, 2600, 1, 3, body);
  if (copy.eyes.visible) throw new Error('Eyes should remain hidden outside the squint');
  copy.update(null, 2600, 0.5, 3, body);
  if (!copy.visible) throw new Error('Letting go must preserve the old shape during unfolding');
  copy.update(null, 2600, 0, 3, body);
  if (copy.visible) throw new Error('Morph should finish once the octopus has unfolded');
  copy.destroy({ children: true }); texture.destroy(true);
  return { nearest: true, designAndSeed: true, opaque: true, continuousContour: true,
    maximumPulse, squint: true, unfoldsContinuously: true };
}
