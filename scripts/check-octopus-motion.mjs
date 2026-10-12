/** Run in the design browser with the shipping FishView class; no renderer is needed. */
export function checkOctopusMotion(FishView) {
  const proto = FishView.prototype, cols = 16, dt = 1 / 60;
  const host = {
    cols, plan: 'squid', walker: true, loose: false, striker: 0,
    clingW: 0, surf: null, rotation: 0, scale: { x: 1, y: 1 }, x: 0, y: 0,
    strike: 1, wrap: 0, windup: 0, armT: 0, facing: 1, cloaked: 0, cloak: false,
    mimicAmount: 0,
    grip: { x: 50, y: 0 }, limb: proto.limb, trail: proto.trail,
    arms: Array.from({ length: 8 }, () => ({
      rig: { len: 50, halfH: 1, rootX: 0, spread: 0 }, v: 0,
      mesh: {}, verts: new Float32Array(cols * 4),
    })),
  };
  const tick = () => {
    proto.poseArms.call(host, 0, 1, 0, dt);
    const v = host.arms[0].verts, j = v.length - 4;
    return [(v[j] + v[j + 2]) / 2, (v[j + 1] + v[j + 3]) / 2];
  };
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  for (let i = 0; i < 120; i++) tick();
  const before = tick();
  host.grip = { x: 0, y: 50 };
  const after = tick();
  const retargetJump = distance(before, after);
  for (let i = 0; i < 120; i++) tick();
  const settled = tick();
  host.grip = null;
  const released = tick();
  const releaseJump = distance(settled, released);
  const results = {
    retarget: { jump: retargetJump, maximum: 8, pass: retargetJump <= 8 },
    release: { jump: releaseJump, maximum: 8, pass: releaseJump <= 8 },
    arrives: { error: distance(settled, [0, 50]), maximum: 0.1,
      pass: distance(settled, [0, 50]) <= 0.1 },
  };
  if (Object.values(results).some(result => !result.pass)) {
    throw new Error(`Octopus arm snapped during a transition: ${JSON.stringify(results)}`);
  }
  return results;
}
