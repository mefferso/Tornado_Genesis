import * as T from 'three';
import { diagnose, stormMotion, toRender } from './atmosphere.js';
import { traceFlow } from './fieldGeometry.js';

export const flowScales = {
  region: ['Seed region', 'Environmental inflow · Updraft side · Forward flank · Rear flank'],
  altitude: ['Altitude', '0 m AGL · 12 km AGL'],
  speed: ['Horizontal wind speed', '0 · 75 m/s'],
  w: ['Vertical velocity', 'Downdraft −30 · 0 · Updraft +30 m/s'],
  zeta: ['Vertical vorticity', 'Anticyclonic −0.08 · 0 · Cyclonic +0.08 s⁻¹'],
  streamwise: ['Streamwise vorticity', 'Opposing −0.12 · 0 · Aligned +0.12 s⁻¹'],
};
const palette = Object.fromEntries(Object.entries({
  cyan: '#61e8e5', orange: '#ffd088', blue: '#5fa7ff', violet: '#d69bf5',
  ivory: '#e2ece9', green: '#92e5a2', magenta: '#fa7ca8',
}).map(([key, value]) => [key, new T.Color(value)]));

function flowColor(point, provider, state, config, region) {
  const key = config.flowColor;
  if (key === 'region') return palette[region];
  if (key === 'altitude') return palette.cyan.clone().lerp(palette.violet, Math.min(1, point[2] / 12000));
  if (key === 'speed') {
    const [u, v] = provider.velocity(...point, state);
    const magnitude = config.groundFlow && config.flowMode !== 'parcel'
      ? Math.hypot(u + stormMotion[0], v + stormMotion[1]) : Math.hypot(u, v);
    return palette.green.clone().lerp(palette.orange, Math.min(1, magnitude / 75));
  }
  const limit = { w: 30, zeta: .08, streamwise: .12 }[key];
  const scalar = key === 'w' ? provider.velocity(...point, state)[2] : diagnose(provider, ...point, state)[key];
  return palette.ivory.clone().lerp(palette[scalar < 0 ? 'blue' : 'orange'], Math.min(1, Math.abs(scalar) / limit));
}

const vertexShader = `
attribute vec3 opposite, tint;
attribute vec3 edge;
uniform float width;
varying vec3 tintOut;
varying vec2 edgeOut;
void main() {
  vec3 p=(modelViewMatrix*vec4(position,1.)).xyz;
  vec3 q=(modelViewMatrix*vec4(opposite,1.)).xyz;
  vec3 axis=normalize(q-p+vec3(1.e-7));
  vec3 lateral=normalize(cross(axis,normalize(-p+vec3(1.e-7)))+vec3(1.e-7));
  gl_Position=projectionMatrix*vec4(p+lateral*edge.x*(1.-2.*edge.z)*width,1.);
  tintOut=tint;
  edgeOut=edge.xy;
}
`;
const fragmentShader = `
uniform float opacity, phase;
uniform int style;
varying vec3 tintOut;
varying vec2 edgeOut;
void main() {
  if(style==1 && fract(edgeOut.y*7.-phase)>.62) discard;
  float edge=1.-smoothstep(.65,1.,abs(edgeOut.x));
  gl_FragColor=vec4(tintOut, opacity*mix(.38,1.,edge));
  #include <colorspace_fragment>
}
`;

function addStrip(mesh, a, b, c0, c1, n0, n1) {
  if (Math.hypot(...a.map((x, i) => x - b[i])) < .0001) return;
  const ends = [[toRender(...a), toRender(...b), c0, n0], [toRender(...b), toRender(...a), c1, n1]];
  for (const [end, side] of [[0,-1],[0,1],[1,-1],[0,1],[1,1],[1,-1]]) {
    const [p, q, color, along] = ends[end];
    mesh.position.push(...p);
    mesh.opposite.push(...q);
    mesh.tint.push(color.r, color.g, color.b);
    mesh.edge.push(side, along, end);
  }
}

function arrow(mesh, a, b, color) {
  const axis = new T.Vector3(...b).sub(new T.Vector3(...a));
  const length = axis.length();
  if (length < .1) return;
  axis.divideScalar(length);
  const cross = new T.Vector3(-axis.y, axis.x, 0);
  if (cross.lengthSq() < .0001) cross.set(1, 0, 0);
  cross.normalize();
  const normal = new T.Vector3().crossVectors(axis, cross);
  for (const basis of [cross, normal]) {
    for (const side of [-1, 1]) {
      const point = new T.Vector3(...b).addScaledVector(axis, -.28 * length).addScaledVector(basis, side * .15 * length);
      addStrip(mesh, point.toArray(), b, color, color, 0, 0);
    }
  }
}

export function createAirflow(provider, scene) {
  const material = new T.ShaderMaterial({
    vertexShader, fragmentShader, transparent: true, depthWrite: false, depthTest: false, side: T.DoubleSide,
    uniforms: { phase: { value: 0 }, opacity: { value: .7 }, width: { value: .008 }, style: { value: 0 } },
  });
  const lines = new T.Mesh(new T.BufferGeometry(), material);
  lines.renderOrder = 7;
  scene.add(lines);
  const capacity = 300;
  const part = new Float32Array(capacity * 3), tint = new Float32Array(capacity * 3);
  const points = new T.Points(new T.BufferGeometry(), new T.PointsMaterial({
    vertexColors: true, size: 3, sizeAttenuation: false, transparent: true, depthTest: false, depthWrite: false,
  }));
  points.geometry.setAttribute('position', new T.BufferAttribute(part, 3).setUsage(T.DynamicDrawUsage));
  points.geometry.setAttribute('color', new T.BufferAttribute(tint, 3).setUsage(T.DynamicDrawUsage));
  points.frustumCulled = false;
  points.renderOrder = 11;
  scene.add(points);
  let paths = [];

  function rebuild(state, config, region) {
    paths = [];
    const mesh = { position: [], opposite: [], tint: [], edge: [] };
    const count = Math.min(capacity, Math.round(config.flowDensity * (config.quality === 'Low' ? 1.2 : 2.4)));
    const step = [20, 7, .72][config.region];
    const parcel = config.flowMode === 'parcel';
    const frame = config.groundFlow && !parcel ? stormMotion : [0, 0, 0];
    const visible = p => !config.clip || (config.clip > 0 ? p[2] <= config.altitude : p[2] >= config.altitude);
    for (let i = 0; i < (parcel ? Math.min(count, 14) : count); i++) {
      const a = i * .61803398875 % 1;
      const b = i * .75487766625 % 1;
      const x = (region.x ?? state.x) + (a - .5) * region.width * (parcel ? .44 : 1);
      const y = (region.y ?? state.y) + (b - .5) * region.width * (parcel ? .44 : .79);
      const fraction = (i * .31182 + .071) % 1;
      const z = Math.min(config.flowTop - .01, config.flowTop * fraction ** (config.flowTop > 2000 ? 2.7 : 1));
      const seed = [x, y, z];
      const colorRegion = x > 3400 && y > 1100 ? 'blue' : x < -1300 && y > -2400
        ? 'violet' : Math.hypot(x - state.x, y - state.y) < 2700 ? 'orange' : 'cyan';
      if (config.flowMode === 'vectors') {
        const air = provider.velocity(...seed, state);
        const vector = air.map((value, j) => (value + frame[j]) * step);
        const fraction = vector[2] > 0 ? (config.flowTop - z) / vector[2] : vector[2] < 0 ? -z / vector[2] : 1;
        const end = seed.map((value, j) => value + Math.min(1, fraction) * vector[j]);
        const color = flowColor(seed, provider, state, config, colorRegion);
        if (visible(seed) && visible(end)) {
          addStrip(mesh, seed, end, color, color, 0, 0);
          arrow(mesh, seed, end, color);
        }
        continue;
      }
      const trailSteps = Math.round(5 + config.flowLength * .24);
      const times = parcel ? [] : undefined;
      const path = traceFlow(provider, state, seed, { steps: trailSteps, step, top: config.flowTop, frame, parcel, times });
      const colors = path.map((point, index) => {
        const sample = parcel ? provider.atTime(times[index]) : state;
        return flowColor(point, provider, sample, config, colorRegion);
      });
      paths.push({ path, colors });
      if (config.flowMode === 'particles' || !config.trails) continue;
      for (let j = 0; j < path.length - 1; j++) {
        if (!visible(path[j]) || !visible(path[j + 1])) continue;
        addStrip(mesh, path[j], path[j + 1], colors[j], colors[j + 1], j / trailSteps, (j + 1) / trailSteps);
        if ((config.flowMode === 'streamlines' || parcel) && j === Math.floor((path.length - 1) * .64)) {
          arrow(mesh, path[j], path[j + 1], colors[j + 1]);
        }
      }
    }
    const geometry = new T.BufferGeometry();
    for (const [key, data] of Object.entries(mesh)) {
      geometry.setAttribute(key, new T.Float32BufferAttribute(data, 3));
    }
    geometry.computeBoundingSphere();
    lines.geometry.dispose();
    lines.geometry = geometry;
  }
  return {
    update(state, config, region, changed) {
      lines.visible = config.airflow && (config.flowMode === 'vectors' || config.trails && config.flowMode !== 'particles');
      points.visible = config.airflow && ['particles', 'streamlines', 'parcel'].includes(config.flowMode);
      if (!config.airflow) return;
      if (changed) rebuild(state, config, region);
      const phase = state.seconds * config.flowSpeed * .009;
      material.uniforms.phase.value = phase * 5;
      material.uniforms.opacity.value = config.flowOpacity;
      material.uniforms.width.value = region.width * .00000035 * config.flowWidth * (config.flowMode === 'ribbons' ? 3.0 : 1);
      material.uniforms.style.value = Number(config.flowMode === 'dashes');
      points.material.opacity = config.flowOpacity;
      points.material.size = 1.5 + config.flowWidth * .8;
      points.material.depthTest = material.depthTest = !config.xray;
      points.material.depthWrite = material.depthWrite = !config.xray;
      if (!points.visible) return;
      for (const [i, { path, colors }] of paths.entries()) {
        const t = ((phase + i * .61803398875) % 1) * (path.length - 1);
        const index = Math.floor(t);
        const a = path[index], b = path[Math.min(path.length - 1, index + 1)];
        const p = a.map((v, j) => v + (t % 1) * (b[j] - v));
        const visible = !config.clip || (config.clip > 0 ? p[2] <= config.altitude : p[2] >= config.altitude);
        const c = colors[index];
        part.set(visible ? toRender(...p) : [0, -50, 0], i * 3);
        tint.set([c.r, c.g, c.b], i * 3);
      }
      points.geometry.setDrawRange(0, paths.length);
      points.geometry.attributes.position.needsUpdate = true;
      points.geometry.attributes.color.needsUpdate = true;
    },
  };
}
