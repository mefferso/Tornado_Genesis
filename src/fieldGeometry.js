import { diagnose, toRender } from './atmosphere.js';
import { duration } from './timeline.js';

const interpolate = (a, b, f) => a.map((value, i) => value + (b[i] - value) * f);

export function traceFlow(provider, snapshot, seed, { steps, step, top, frame, parcel = false, times }) {
  let p = seed;
  const path = [p];
  times?.push(snapshot.seconds);
  const air = [0, 0, 0];
  for (let j = 0; j < steps; j++) {
    const now = snapshot.seconds + j * step;
    const dt = parcel ? Math.min(step, duration - now) : step;
    if (dt <= 0) break;
    const start = parcel ? provider.atTime(now) : snapshot;
    const middle = parcel ? provider.atTime(now + dt * .5) : snapshot;
    const a = provider.velocity(...p, start, air);
    const mid = p.map((value, i) => value + (a[i] + frame[i]) * dt * .5);
    const b = provider.velocity(...mid, middle, air);
    const next = p.map((value, i) => value + (b[i] + frame[i]) * dt);
    const boundary = next[2] > top ? top : next[2] < 0 ? 0 : undefined;
    if (boundary !== undefined) {
      const fraction = (boundary - p[2]) / (next[2] - p[2]);
      path.push(interpolate(p, next, fraction));
      times?.push(now + fraction * dt);
      break;
    }
    path.push(next);
    times?.push(now + dt);
    p = next;
  }
  return path;
}

export function surfaceCrossing(a, b, valueA, valueB, threshold) {
  return interpolate(a, b, (threshold - valueA) / (valueB - valueA));
}

export function sampleScalar(provider, state, point, field) {
  if (field === 'w' || field === 'speed') {
    const [u, v, w] = provider.velocity(...point, state);
    return field === 'w' ? w : Math.hypot(u, v);
  }
  return diagnose(provider, ...point, state)[field];
}

const tetrahedra = [[0,1,3,7],[0,3,2,7],[0,2,6,7],[0,6,4,7],[0,4,5,7],[0,5,1,7]];

export function sampleSurfaces(provider, state, options, normals = [[], []]) {
  const { cx, cy, width, bottom, top, field, signed, threshold, clipAltitude, clip } = options;
  const limit = Math.max(bottom, clip > 0 ? Math.min(top, clipAltitude) : top);
  const base = Math.min(top, clip < 0 ? Math.max(bottom, clipAltitude) : bottom);
  const vertices = [[], []];
  if (limit <= base) return vertices;
  const nx = 25, nz = 16;
  const samples = [];
  const index = (i, j, k) => (k * nx + j) * nx + i;
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < nx; j++) {
      for (let i = 0; i < nx; i++) {
        const point = [cx + width * (i / (nx - 1) - .5), cy + width * (j / (nx - 1) - .5),
          base + (limit - base) * k / (nz - 1)];
        samples.push([point, sampleScalar(provider, state, point, field)]);
      }
    }
  }
  const dx = width / (nx - 1), dz = (limit - base) / (nz - 1);
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < nx; j++) {
      for (let i = 0; i < nx; i++) {
        const difference = (n, m, stride, spacing) => {
          const node = index(i, j, k);
          const before = Number(n > 0), after = Number(n < m - 1);
          return (samples[node + after * stride][1] - samples[node - before * stride][1]) / ((after + before) * spacing);
        };
        samples[index(i, j, k)].push([difference(i, nx, 1, dx), difference(j, nx, nx, dx), difference(k, nz, nx * nx, dz)]);
      }
    }
  }
  function triangle(a, b, c, surface) {
    const u = b[0].map((v, i) => v - a[0][i]);
    const v = c[0].map((v, i) => v - a[0][i]);
    const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (cross.reduce((sum, component, i) => sum + component * (a[1][i] + b[1][i] + c[1][i]), 0) < 0) {
      [b, c] = [c, b];
    }
    for (const [point, normal] of [a, b, c]) {
      vertices[surface].push(...point);
      normals[surface].push(...normal);
    }
  }
  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < nx - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const first = index(i, j, k);
        const corners = [0,1,nx,nx+1,nx*nx,nx*nx+1,nx*nx+nx,nx*nx+nx+1].map(offset => samples[first + offset]);
        for (let signIndex = 0; signIndex < (signed ? 2 : 1); signIndex++) {
          const sign = signIndex ? -1 : 1;
          const level = sign * threshold;
          if (corners.every(([, v]) => v < level) || corners.every(([, v]) => v >= level)) continue;
          for (const indices of tetrahedra) {
            const above = [], below = [];
            for (const corner of indices) (corners[corner][1] >= level ? above : below).push(corners[corner]);
            if (!above.length || !below.length) continue;
            const polygon = above.flatMap(a => below.map(b => {
              const point = toRender(...surfaceCrossing(a[0], b[0], a[1], b[1], level));
              const gradient = toRender(...surfaceCrossing(a[2], b[2], a[1], b[1], level));
              const size = Math.hypot(...gradient) || 1;
              return [point, gradient.map(value => -sign * value / size)];
            }));
            triangle(polygon[0], polygon[1], polygon[2], signIndex);
            if (polygon.length === 4) triangle(polygon[1], polygon[3], polygon[2], signIndex);
          }
        }
      }
    }
  }
  return vertices;
}
