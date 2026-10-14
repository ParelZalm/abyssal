/** Exercise the shipping body mesh on a flat face and a rock with a raised knob. */
export function checkOctopusCamouflage(FishView) {
  const proto = FishView.prototype, n = 32;
  const make = bump => ({
    mesh: {}, baked: { halfH: 10, depth: 8 },
    motion: { amp: 0, waves: 1, pulse: 0 },
    colX: Array.from({ length: n }, (_, j) => 20 - 40 * j / (n - 1)),
    verts: new Float32Array(n * 4), facing: 1, squeeze: null, arms: [],
    walker: true, camo: 0, clingW: 1, rotation: 0, scale: { x: 1, y: 1 },
    mimicRelief: new Float32Array(0), mimicNormal: { x: 0, y: -1 },
    mimicAmount: 0,
    x: 0, y: 0, g: { size: 40 }, surf: { x: 0, y: 20, nx: 0, ny: -1 },
    surface: { cell: 1, contains: (x, y) => y >= 20 - (bump ? 8 * Math.exp(-(((x + 7) / 5) ** 2)) : 0) },
    mimicShape: proto.mimicShape, touch: proto.touch,
  });
  const tick = host => proto.pose.call(host, 0, 0, 0, 1 / 60, 1);
  const difference = (a, b) => Math.max(...a.map((v, j) => Math.abs(v - b[j])));
  const flat = make(false), rock = make(true);
  tick(flat);
  const rest = Array.from(flat.verts);
  flat.camo = rock.camo = 1;
  tick(flat);
  const first = difference(rest, Array.from(flat.verts));
  for (let j = 0; j < 120; j++) { tick(flat); tick(rock); }
  const raised = Array.from(flat.verts);
  const extension = difference(rest, raised);
  const followsRock = difference(raised, Array.from(rock.verts));
  const underside = Math.max(...rest.filter((_, j) => j % 4 === 3)
    .map((v, j) => Math.abs(v - raised[j * 4 + 3])));
  flat.camo = 0;
  tick(flat);
  const firstRelease = difference(raised, Array.from(flat.verts));
  for (let j = 0; j < 180; j++) tick(flat);
  const restored = difference(rest, Array.from(flat.verts));
  const results = {
    extends: { distance: extension, pass: extension > 0.5 },
    followsRock: { distance: followsRock, pass: followsRock > 0.2 },
    easesIn: { distance: first, pass: first < extension * 0.2 },
    easesOut: { distance: firstRelease, pass: firstRelease < extension * 0.2 },
    restores: { error: restored, pass: restored < 0.05 },
    staysPlanted: { distance: underside, pass: underside < 0.001 },
    compacts: { width: Math.abs(raised[0] - raised[raised.length - 4]),
      pass: Math.abs(raised[0] - raised[raised.length - 4]) < 26 },
  };
  if (Object.values(results).some(result => !result.pass)) {
    throw new Error(`Octopus camouflage failed to reshape continuously: ${JSON.stringify(results)}`);
  }
  return results;
}
