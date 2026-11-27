// Computational coordinates are east, north, up (m). Time is elapsed seconds.
export const stormMotion = Object.freeze([13, 8, 0]);
export const toRender = (x, y, z) => [x / 1000, z / 1000, -y / 1000];
export const fromRender = (x, y, z) => [1000 * x, -1000 * z, 1000 * y];
const clamp = t => Math.max(0, Math.min(1, t));
const smooth = (a, b, value) => {
  const t = clamp((value - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const pulse = (a, b, c, d, t) => smooth(a, b, t) * (1 - smooth(c, d, t));
const square = x => x * x;

export class ProceduralAtmosphere {
  source = 'Procedural kinematics';
  atTime(seconds) {
    const t = seconds / 60;
    const convection = smooth(5, 29, t) * (1 - .65 * smooth(79, 90, t));
    const mid = pulse(15, 31, 80, 94, t);
    const outflow = smooth(27, 46, t) * (1 - .35 * smooth(82, 92, t));
    const patches = pulse(42, 51, 68, 87, t);
    const low = pulse(47, 61, 79, 90, t);
    const vortex = pulse(59, 71, 77, 88, t);
    const funnel = pulse(66, 73, 78, 86, t);
    const dust = pulse(63, 70, 79, 87, t);
    const occlusion = smooth(76, 88, t);
    const x = 180 * Math.sin(t * .17) + occlusion * 1250;
    const y = 130 * Math.cos(t * .14) + occlusion * 900;
    const radius = 105 + 640 * (1 - vortex);
    const top = 1.4 + 12.35 * smooth(5, 33, t) - 2.5 * occlusion;
    const cloud = smooth(5, 11, t) * (1 - .58 * smooth(80, 90, t));

    // Gaussian vertical velocity paired with its radial continuity integral.
    const drafts = [
      [0, 0, .27, .22, 2700, 43 * convection, 6400, 5100, 720],
      [11500, 6500, .14, .15, 5300, -14 * outflow, 3400, 4400, 450],
      [-3500 + occlusion * 4900, 700 - occlusion * 3800, -.12, .08, 2000, -16 * outflow, 1700, 2300, 280],
      [x, y, .09, .06, 1110, 13 * low, 790, 1400, 360],
      [x, y, .075, .05, Math.max(radius * 1.6, 210), 29 * vortex, 280, 1100, 115],
    ];
    const rotations = [
      [0, 0, .27, .22, 3050, 24 * mid, 5100, 3900],
      [-4800, 2100, .19, .20, 2500, -8 * mid, 4900, 2800],
      [x, y, .09, .06, 1390, 24 * low, 930, 1300],
      [x, y, .075, .05, radius, 66 * vortex, 0, 1400 + 120 * vortex],
      [-2050 + 1130 * low, -850 + 450 * low, 0, 0, 450, 7 * patches, 45, 180],
      [-750 + 550 * low, -1400 + 700 * low, 0, 0, 330, 8 * patches, 45, 195],
      [1800 - 750 * low, 800 - 340 * low, 0, 0, 450, 8 * patches, 35, 170],
      [-1650, 310, 0, 0, 420, -5 * patches, 40, 140],
    ];
    return { seconds, convection, outflow, low, vortex, funnel, dust, occlusion, x, y, radius, top, cloud, drafts, rotations };
  }

  velocity(x, y, z, state, out = [0, 0, 0]) {
    z = Math.max(0, z);
    const turn = 1 - Math.exp(-z / 940);
    let u = -16 + 24 * turn + 19 * (1 - Math.exp(-z / 6400));
    let v = 19 - 2 * turn + 5 * (1 - Math.exp(-z / 5700));
    let w = 0;
    for (const [cx, cy, tx, ty, r, amplitude, h, depth, base] of state.drafts) {
      if (!amplitude) continue;
      const dx = x - cx - tx * z;
      const dy = y - cy - ty * z;
      const s = (dx * dx + dy * dy) / (r * r);
      const radial = Math.exp(-s);
      const profile = amplitude * Math.exp(-square((z - h) / depth));
      const ground = Math.exp(-z / base);
      const vertical = profile * (1 - ground);
      const gradient = profile * (ground / base - 2 * (z - h) / (depth * depth) * (1 - ground));
      const factor = -.5 * gradient * (s < 1e-5 ? 1 - s / 2 : -Math.expm1(-s) / s);
      w += vertical * radial;
      u += dx * factor + tx * vertical * radial;
      v += dy * factor + ty * vertical * radial;
    }
    for (const [cx, cy, tx, ty, r, amplitude, h, depth] of state.rotations) {
      if (!amplitude) continue;
      const dx = (x - cx - tx * z) / r;
      const dy = (y - cy - ty * z) / r;
      const weight = 2 * amplitude * Math.exp(-square((z - h) / depth)) / (1 + dx * dx + dy * dy);
      u -= dy * weight;
      v += dx * weight;
    }
    // Shallow forward-flank shear anomaly. Its streamwise component is diagnosed below.
    const corridorY = 550 + .30 * x;
    const current = state.outflow * Math.exp(-square((x - 5000) / 5100) - square((y - corridorY) / 520)
      - square((z - 115) / 310));
    out[0] = u - 13 * current;
    out[1] = v - 4 * current;
    out[2] = w;
    return out;
  }
}

// Second-order finite differences. Use a one-sided vertical stencil next to terrain.
export function diagnose(provider, x, y, z, state, step = 5) {
  const air = (a, b, c) => provider.velocity(a, b, c, state);
  const c = air(x, y, z);
  const airWest = air(x - step, y, z);
  const airSouth = air(x, y - step, z);
  const dx = air(x + step, y, z).map((value, i) => (value - airWest[i]) / (2 * step));
  const dy = air(x, y + step, z).map((value, i) => (value - airSouth[i]) / (2 * step));
  const up = air(x, y, z + step);
  const down = z >= step ? air(x, y, z - step) : air(x, y, z + 2 * step);
  const dz = up.map((value, i) => (z >= step ? value - down[i] : 4 * value - 3 * c[i] - down[i]) / (2 * step));
  const xi = dy[2] - dz[1];
  const eta = dz[0] - dx[2];
  const zeta = dx[1] - dy[0];
  const speed = Math.hypot(c[0], c[1]);
  const east = speed > 1e-6 ? c[0] / speed : 0;
  const north = speed > 1e-6 ? c[1] / speed : 0;
  return {
    u: c[0], v: c[1], w: c[2], speed, xi, eta, zeta,
    horizontal: Math.hypot(xi, eta), streamwise: xi * east + eta * north,
    crosswise: -xi * north + eta * east, convergence: -dx[0] - dy[1],
    tilting: xi * dx[2] + eta * dy[2], stretching: zeta * dz[2],
  };
}
