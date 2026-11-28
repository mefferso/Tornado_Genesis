import * as T from 'three';
import { diagnose, toRender } from './atmosphere.js';
import { sampleSurfaces, sampleScalar } from './fieldGeometry.js';
import { createAirflow } from './flow.js';

const fields = {
  zeta: ['Vertical vorticity ζ', 's⁻¹', [.012,.08,2.6]],
  horizontal: ['Horizontal vorticity magnitude', 's⁻¹', [.025,.16,.60], true],
  streamwise: ['Streamwise vorticity', 's⁻¹', [.023,.14,.55]],
  crosswise: ['Crosswise vorticity', 's⁻¹', [.023,.14,.55]],
  convergence: ['Horizontal convergence', 's⁻¹', [.012,.09,.35]],
  tilting: ['Vertical tilting term', 's⁻²', [.00022,.005,.14]],
  stretching: ['Vertical stretching term', 's⁻²', [.00022,.005,.14]],
  w: ['Vertical velocity', 'm s⁻¹', [26,32,38]],
  speed: ['Storm-relative horizontal speed', 'm s⁻¹', [45,62,95], true],
};
export { fields };
export const fieldRegions = [
  { label: 'Storm · 46 km', width: 46000, x: 5000, y: 2500 },
  { label: 'Mesocyclone · 10 km', width: 10000 },
  { label: 'Tornado · 1.6 km', width: 1600 },
];
const palette = [[23,137,215], [22,31,51], [255,153,82]];

export function paintSlice(size, context, provider, state, config) {
  const field = fields[config.field];
  const region = fieldRegions[config.region];
  const cx = region.x ?? state.x;
  const cy = region.y ?? state.y;
  const image = context.createImageData(size, size);
  const step = region.width / size;
  const range = field[2][config.region];
  for (let j = 0; j < size; j++) {
    const y = cy + region.width / 2 - (j + .5) * step;
    for (let i = 0; i < size; i++) {
      const x = cx - region.width / 2 + (i + .5) * step;
      const value = sampleScalar(provider, state, [x, y, config.altitude], config.field);
      const fraction = Math.min(Math.abs(value) / range, 1);
      const extreme = palette[value < 0 ? 0 : 2];
      const mid = palette[1];
      const offset = (j * size + i) * 4;
      for (let k = 0; k < 3; k++) image.data[offset + k] = mid[k] + (extreme[k] - mid[k]) * fraction;
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return { cx, cy, width: region.width, range };
}

function line(color, opacity = 1) {
  return new T.LineSegments(new T.BufferGeometry(),
    new T.LineBasicMaterial({ color, transparent: opacity < 1, opacity, depthTest: false, depthWrite: false }));
}

function setPositions(object, vertices) {
  const geometry = object.geometry;
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geometry.computeBoundingSphere();
}

export function createDiagnostics(provider, scene, miniMap) {
  const size = miniMap.width;
  const context = miniMap.getContext('2d');
  const texture = new T.CanvasTexture(miniMap);
  texture.colorSpace = T.SRGBColorSpace;
  const plane = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({
    map: texture, transparent: true, opacity: .58, depthTest: false, depthWrite: false, side: T.DoubleSide,
  }));
  plane.rotation.x = -Math.PI / 2;
  plane.renderOrder = 5;
  const horizontal = line(0xf7b462, .90);
  const airflow = createAirflow(provider, scene);
  const tornado = line(0xffbd74, .84);
  const bounds = line(0x6bd3ff, .89);
  const axes = line(0xdbedea, .66);
  const surfaces = [0, 1].map(() => new T.Mesh(new T.BufferGeometry(), new T.MeshLambertMaterial({
    side: T.FrontSide, transparent: true, depthTest: false, depthWrite: false,
  })));
  scene.add(...surfaces, new T.HemisphereLight(0xebf2ff, 0x718abd, 2.3));
  const key = new T.DirectionalLight(0xffedd9, 1.9);
  key.position.set(-3, 5, 4);
  scene.add(key);
  for (const [i, object] of [horizontal, tornado, bounds, axes, ...surfaces].entries()) {
    object.renderOrder = i + 6;
    scene.add(object);
  }
  scene.add(plane);
  const axisVertices = [0,.006,0,5,.006,0,0,.006,0,0,.006,-5,0,0,0,0,15,0];
  for (let km = 1; km <= 15; km++) {
    const tick = km % 5 ? .15 : .36;
    axisVertices.push(-tick,km,0,tick,km,0);
  }
  setPositions(axes, axisVertices);
  let slice;
  const layers = [plane, horizontal, tornado, bounds, axes, ...surfaces];
  const visible = (z, config) => !config.clip || (config.clip > 0 ? z <= config.altitude : z >= config.altitude);
  const pushSegment = (target, a, b, config) => {
    if (visible(a[2], config) && visible(b[2], config)) target.push(...toRender(...a), ...toRender(...b));
  };
  return {
    get slice() { return slice; },
    update(state, config, rebuild, rebuildSurface) {
      plane.visible = config.slice;
      horizontal.visible = config.arrows;
      airflow.update(state, config, fieldRegions[config.region], rebuild);
      for (const { material } of layers) {
        material.depthTest = !config.xray;
        material.depthWrite = !config.xray;
      }
      for (const [i, surface] of surfaces.entries()) {
        surface.visible = config.iso && config.isoOpacity > 0;
        surface.material.color.set(i ? config.isoNegative : config.isoPositive);
        surface.material.opacity = config.isoOpacity;
      }
      if (config.iso && rebuildSurface) {
        const { x, y, width } = fieldRegions[config.region];
        const normals = [[], []];
        const vertices = sampleSurfaces(provider, state, {
          cx: x ?? state.x, cy: y ?? state.y, width, bottom: 0, top: config.isoTop, field: config.isoField,
          signed: !fields[config.isoField][3], threshold: config.isoThreshold, clip: config.clip, clipAltitude: config.altitude,
        }, normals);
        surfaces.forEach((surface, i) => {
          setPositions(surface, vertices[i]);
          surface.geometry.setAttribute('normal', new T.Float32BufferAttribute(normals[i], 3));
        });
      }
      axes.visible = config.axes;
      bounds.visible = config.boundaries && state.outflow > .08;
      tornado.visible = config.circulation && state.tornadoWind > .03;
      plane.material.opacity = config.fieldOpacity;
      if (rebuild) {
        if (config.slice || config.arrows) {
          const region = fieldRegions[config.region];
          const x0 = region.x ?? state.x, y0 = region.y ?? state.y;
          if (config.slice) {
            slice = paintSlice(size, context, provider, state, config);
            texture.needsUpdate = true;
          }
          plane.position.set(...toRender(x0, y0, Math.max(2, config.altitude)));
          plane.scale.setScalar(region.width / 1000);
          if (config.arrows) {
            const vertices = [];
            const spacing = region.width / 14;
            for (let y = -6; y <= 6; y++) {
              for (let x = -6; x <= 6; x++) {
                const a = [x0 + x * spacing, y0 + y * spacing, Math.max(2, config.altitude)];
                const { xi, eta, horizontal: mag } = diagnose(provider, ...a.slice(0, 2), config.altitude, state);
                const scale = .82 * spacing / (mag + fields.horizontal[2][config.region] * .32);
                const b = [a[0] + xi * scale, a[1] + eta * scale, a[2]];
                vertices.push(...toRender(...a), ...toRender(...b));
                const angle = Math.atan2(eta, xi);
                for (const sign of [-1, 1]) {
                  const end = [b[0] - .24 * mag * scale * Math.cos(angle + sign * .52),
                    b[1] - .24 * mag * scale * Math.sin(angle + sign * .52), a[2]];
                  vertices.push(...toRender(...b), ...toRender(...end));
                }
              }
            }
            setPositions(horizontal, vertices);
          }
        }
        if (bounds.visible) {
          const vertices = [];
          for (let i = 0; i < 48; i++) {
            const position = (k, rear) => {
              const t = k / 48;
              if (!rear) return [state.x + t * 18100, state.y + 580 + t * 4700 + Math.sin(t * 3.1) * 650, 12];
              const angle = 2.38 + (3.15 + state.occlusion * .85) * t;
              return [state.x - 650 + (2800 + 850 * t) * Math.cos(angle),
                state.y - 250 + 2900 * Math.sin(angle), 12];
            };
            pushSegment(vertices, position(i, false), position(i + 1, false), config);
            pushSegment(vertices, position(i, true), position(i + 1, true), config);
          }
          setPositions(bounds, vertices);
        }
        if (tornado.visible) {
          const vertices = [];
          for (let level = 0; level < 6; level++) {
            const z = 12 + level * 220;
            const r = state.radius;
            for (let i = 0; i < 44; i++) {
              const from = i * Math.PI / 22;
              const to = (i + 1) * Math.PI / 22;
              const p = angle => [state.x + r * Math.cos(angle) + .075 * z,
                state.y + r * Math.sin(angle) + .05 * z, z];
              pushSegment(vertices, p(from), p(to), config);
            }
          }
          setPositions(tornado, vertices);
        }
      }
    },
  };
}
