import { Euler, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const cameras = {
  chaser: ['Ground-level chaser', [4.2,.055,4.6], [.35,1.42,0]],
  inflow: ['Southeast inflow', [14,2.8,12], [2,5,-2]],
  rear: ['Southwest rear flank', [-13,2.3,9], [0,3,-1]],
  forward: ['Northeast forward flank', [23,4.3,-15], [8,4,-5]],
  base: ['Beneath the mesocyclone', [.01,.06,0], [.45,2,-.42]],
  meso: ['Inside the low-level mesocyclone', [.02,.85,.16], [.58,1.3,-.45]],
  updraft: ['Inside the updraft', [1.3,5.3,-.8], [2.2,7,-1.7]],
  level: ['Horizontal at camera altitude', [10,2,7], [0,2,0]],
  overhead: ['Overhead', [4,15,.001], [4,0,0]],
  wide: ['Full supercell', [25,7,31], [5,5,-2.2]],
  tornado: ['Tornado circulation', [.83,.19,1.26], [0,.58,0]],
  surface: ['Near-ground vorticity', [-1.8,.055,1.85], [-.6,.14,.25]],
};

export function createNavigation(camera, canvas) {
  const orbit = new OrbitControls(camera, canvas);
  orbit.enableDamping = true;
  orbit.dampingFactor = .10;
  orbit.minDistance = .015;
  orbit.maxDistance = 115;
  orbit.maxPolarAngle = Math.PI - .012;
  orbit.minPolarAngle = .004;
  orbit.zoomToCursor = true;
  let mode = 'orbit';
  let transition = null;
  let drag = null;
  const keys = new Set();
  const euler = new Euler(0, 0, 0, 'YXZ');
  const forward = new Vector3();
  const right = new Vector3();
  const motion = new Vector3();
  const altitude = () => camera.position.y * 1000;
  const setAltitude = meters => {
    const next = Math.max(.003, Math.min(15, meters / 1000));
    orbit.target.y += next - camera.position.y;
    camera.position.y = next;
    transition = null;
  };
  const setMode = value => {
    mode = value;
    transition = null;
    orbit.enabled = mode === 'orbit';
    if (orbit.enabled) {
      camera.getWorldDirection(forward);
      orbit.target.copy(camera.position).addScaledVector(forward, 3);
      orbit.update();
    }
  };
  const preset = (id, state, immediate = false) => {
    const [, p, look] = cameras[id];
    const position = new Vector3(...p);
    const target = new Vector3(...look);
    if (['base', 'meso', 'tornado', 'surface'].includes(id)) {
      for (const point of [position, target]) {
        point.x += state.x / 1000;
        point.z -= state.y / 1000;
      }
    }
    if (id === 'level') position.y = target.y = camera.position.y;
    if (immediate) {
      camera.position.copy(position);
      orbit.target.copy(target);
      camera.lookAt(target);
      orbit.update();
      return;
    }
    camera.getWorldDirection(forward);
    const startTarget = mode === 'fly'
      ? camera.position.clone().addScaledVector(forward, 3) : orbit.target.clone();
    transition = { position, target, from: camera.position.clone(), startTarget, progress: 0 };
  };
  canvas.addEventListener('pointerdown', event => {
    if (mode !== 'fly') return;
    transition = null;
    canvas.setPointerCapture(event.pointerId);
    drag = [event.clientX, event.clientY];
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || mode !== 'fly') return;
    euler.setFromQuaternion(camera.quaternion);
    euler.y -= (event.clientX - drag[0]) * .003;
    euler.x = Math.max(-1.55, Math.min(1.55, euler.x - (event.clientY - drag[1]) * .003));
    camera.quaternion.setFromEuler(euler);
    drag = [event.clientX, event.clientY];
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(event, () => { drag = null; });
  }
  window.addEventListener('keydown', event => {
    if (event.target.matches('input, select, textarea, button') || event.ctrlKey || event.metaKey
      || !['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown'].includes(event.code)) return;
    if (mode !== 'fly' && event.code.startsWith('Arrow')) return;
    keys.add(event.code);
    event.preventDefault();
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('wheel', event => {
    if (mode !== 'fly') return;
    event.preventDefault();
    camera.getWorldDirection(forward);
    camera.position.addScaledVector(forward, -.0025 * event.deltaY);
  }, { passive: false });
  return {
    altitude, setAltitude, preset, setMode,
    frame(dt, speed) {
      if (transition) {
        transition.progress = Math.min(1, transition.progress + dt * 1.8);
        const t = transition.progress ** 2 * (3 - 2 * transition.progress);
        camera.position.lerpVectors(transition.from, transition.position, t);
        orbit.target.lerpVectors(transition.startTarget, transition.target, t);
        camera.lookAt(orbit.target);
        if (t === 1) transition = null;
      } else if (mode === 'orbit') {
        orbit.update();
      }
      if (keys.size) {
        transition = null;
        camera.getWorldDirection(forward);
        if (mode === 'orbit') forward.y = 0;
        forward.normalize();
        right.crossVectors(forward, camera.up).normalize();
        motion.set(0, 0, 0);
        const along = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
        motion.addScaledVector(forward, along);
        motion.addScaledVector(right, Number(keys.has('KeyD')) - Number(keys.has('KeyA')));
        motion.y += Number(keys.has('KeyE')) - Number(keys.has('KeyQ'));
        motion.normalize().multiplyScalar(dt * speed);
        camera.position.add(motion);
        if (mode === 'orbit') orbit.target.add(motion);
      }
      camera.position.y = Math.max(.003, Math.min(15, camera.position.y));
      camera.updateMatrixWorld();
    },
  };
}
