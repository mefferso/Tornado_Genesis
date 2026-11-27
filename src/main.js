import * as T from 'three';
import './style.css';
import { ProceduralAtmosphere, diagnose, toRender } from './atmosphere.js';
import { cameras, createNavigation } from './navigation.js';
import { createVolume } from './volume.js';
import { createDiagnostics, fields, fieldRegions } from './diagnostics.js';
import { advanceTime, boundedTime, duration, formatTime, references, stageAt, stages } from './timeline.js';

const el = id => document.getElementById(id);
const value = id => el(id).value;
const number = id => el(id).valueAsNumber;
const check = id => el(id).checked;
const on = (id, event, listener) => el(id).addEventListener(event, listener);
const button = (id, action) => on(id, 'click', action);
const fill = (id, options) => el(id).replaceChildren(...options.map(([key, label]) => new Option(label, key)));
const presets = {
  classic: ['Classic supercell', 'zeta', 0, 100, false, false, false, false, 100, 75],
  environment: ['Environmental vorticity', 'streamwise', 0, 500, true, true, false, false, 22, 20],
  tilting: ['Tilting and stretching', 'tilting', 0, 3000, true, true, false, false, 32, 24],
  svc: ['Streamwise vorticity current', 'streamwise', 1, 250, true, true, true, false, 20, 15],
  surface: ['Near-surface tornadogenesis', 'zeta', 1, 25, true, false, true, true, 42, 25],
  outflow: ['Outflow and downdrafts', 'w', 0, 250, true, false, true, false, 34, 44],
  tornado: ['Mature tornado circulation', 'zeta', 2, 25, true, false, false, true, 60, 25],
};
const quality = { Low: [.49, .62], Balanced: [.79, .42], High: [1, .31] };
const features = [
  ['Updraft tower', s => [340,205,s.top * 545], s => s.convection > .19 && check('clouds')],
  ['Overshooting top', s => [3600,2840,(s.top + .94) * 1000], s => s.convection > .84 && check('clouds')],
  ['Anvil', s => [13000,5500,(s.top + .45) * 1000], s => s.convection > .62 && check('clouds')],
  ['Forward-flank precipitation', () => [11200,6200,3100], s => s.outflow > .30 && check('rain')],
  ['Rain-free base', () => [1500,-1900,1250], s => s.convection > .60 && check('clouds')],
  ['Rear-flank downdraft', s => [-4200 + s.occlusion * 4900,480 - s.occlusion * 3650,1300], s => s.outflow > .46],
  ['Wall cloud', s => [s.x + 175,s.y + 80,1120], s => s.low > .64 && check('clouds')],
  ['Tornado circulation', s => [s.x,s.y,185], s => s.vortex > .26 && check('circulation')],
  ...[5,10,15].map(km => [km + ' km AGL', () => [-390,0,km * 1000], () => check('axes')]),
];
const annotations = features.map(([label]) => {
  const node = document.createElement('span');
  node.className = 'annotation';
  node.textContent = label;
  el('annotations').append(node);
  return node;
});
fill('camera', Object.entries(cameras).map(([id,[label]]) => [id,label]));
fill('preset', [['custom','Custom settings'], ...Object.entries(presets).map(([id,[label]]) => [id,label])]);
fill('stage', stages.map(([,title],i) => [i,title]));
fill('field', Object.entries(fields).map(([id,[label,units]]) => [id, label + ' (' + units + ')']));
fill('region', fieldRegions.map(({ label },i) => [i,label]));
fill('slice-preset', [['','Custom'], ...[10,25,50,100,250,500,750,1000,2000,3000,5000,10000]
  .map(m => [m, m < 1000 ? m + ' m' : m / 1000 + ' km'])]);
el('camera').value = 'wide';
el('preset').value = 'classic';
el('field').value = 'zeta';
el('slice-preset').value = '100';

const provider = new ProceduralAtmosphere();
let time = 59 * 60;
let playing = false;
let state = provider.atTime(time);
let stageIndex = -1;
let config;
let dirty = true;
let lastDiagnosticTime = -Infinity;

function syncConfig(custom = false) {
  config = {};
  for (const id of ['slice','arrows','airflow','trails','clouds','rain','grid','axes','boundaries','dust','funnel','circulation']) {
    config[id] = check(id);
  }
  Object.assign(config, {
    field: value('field'), region: Number(value('region')), altitude: number('slice-alt') || 0, clip: Number(value('clip')),
    cloudOpacity: number('cloud-opacity') / 100, rainOpacity: number('rain-opacity') / 100,
    fieldOpacity: number('field-opacity') / 100, groundFlow: el('flow-frame').selectedIndex === 1,
    quality: value('quality'), marchStep: quality[value('quality')][1],
  });
  dirty = true;
  if (custom) el('preset').value = 'custom';
  el('slice-preview').hidden = !config.slice;
  el('view-frame').textContent = config.groundFlow ? 'GROUND-RELATIVE FLOW' : 'STORM-RELATIVE FLOW';
  const [, units, ranges, positive] = fields[config.field];
  const limit = ranges[config.region];
  const labels = [positive ? '0' : '−' + limit, ...(positive ? [] : ['0']), '+' + limit + ' ' + units];
  el('legend').replaceChildren(...labels.map(label => {
    const node = document.createElement('span');
    node.textContent = label;
    return node;
  }));
  el('color-scale').style.background = positive ? 'linear-gradient(90deg,#161f33,#ff9952)'
    : 'linear-gradient(90deg,#1789d7,#161f33,#ff9952)';
}
function setSliceAltitude(m) {
  el('slice-alt').value = Math.max(0, Math.min(15000, m));
  el('slice-preset').value = el('slice-alt').value;
  if (el('slice-preset').selectedIndex < 0) el('slice-preset').value = '';
}
function applyPreset(id) {
  if (!presets[id]) return;
  const [, field, region, altitude, slice, arrows, boundaries, circulation, cloud, rain] = presets[id];
  el('preset').value = id;
  el('field').value = field;
  el('region').value = region;
  setSliceAltitude(altitude);
  for (const [key, enabled] of Object.entries({ slice, arrows, boundaries, circulation, clouds: true, rain: true, airflow: true, trails: true })) {
    el(key).checked = enabled;
  }
  el('cloud-opacity').value = cloud;
  el('rain-opacity').value = rain;
  el('clip').value = 0;
  if (slice) el('slice-panel').open = true;
  syncConfig();
}

function updateDisplay() {
  const index = stageAt(time);
  el('seek').value = Math.floor(time);
  el('time').textContent = formatTime(time);
  el('seek').setAttribute('aria-valuetext', formatTime(time));
  if (index === stageIndex) return;
  const [, label, headline, story, guide, , ref] = stages[index];
  const [reference, doi] = references[ref];
  stageIndex = index;
  el('stage').value = index;
  el('stage-meta').textContent = 'Stage ' + (index + 1) + ' / ' + stages.length + ' · ' + label;
  el('story-title').textContent = headline;
  el('story').textContent = story;
  el('story-guide').textContent = guide;
  el('story-ref').textContent = reference;
  el('story-ref').href = 'https://doi.org/' + doi;
  for (const [i, marker] of Array.from(el('stage-marks').children).entries()) {
    marker.classList.toggle('current', i === index);
    if (i === index) marker.setAttribute('aria-current', 'step');
    else marker.removeAttribute('aria-current');
  }
}
function seek(seconds) {
  time = boundedTime(seconds);
  state = provider.atTime(time);
  dirty = true;
  updateDisplay();
}
function setPlaying(active) {
  playing = active;
  el('play').innerHTML = playing ? '❚❚ <span>Pause</span>' : '▶ <span>Play</span>';
  el('play').setAttribute('aria-pressed', String(playing));
}
function togglePlay() {
  if (!playing && time >= duration) seek(0);
  setPlaying(!playing);
}
for (const [i, [minute, label]] of stages.entries()) {
  const node = document.createElement('button');
  node.className = 'stage-mark';
  node.textContent = i + 1;
  node.title = label;
  node.setAttribute('aria-label', label);
  node.style.left = minute * 60 / duration * 100 + '%';
  node.onclick = () => seek(minute * 60);
  el('stage-marks').append(node);
}
el('references').replaceChildren(...Object.values(references).map(([title, doi]) => {
  const item = document.createElement('li'), link = document.createElement('a');
  link.href = 'https://doi.org/' + doi;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = title;
  item.append(link);
  return item;
}));

on('stage','change', () => seek(stages[Number(value('stage'))][0] * 60));
on('seek','input', () => seek(number('seek')));
button('play', togglePlay);
button('restart', () => seek(0));
button('back', () => { setPlaying(false); seek(time - 10); });
button('next', () => { setPlaying(false); seek(time + 10); });
button('suggested', () => applyPreset(stages[stageIndex][5]));
on('preset','change', () => applyPreset(value('preset')));
on('slice-preset','change', () => {
  if (value('slice-preset')) setSliceAltitude(Number(value('slice-preset')));
  syncConfig(true);
});
on('slice-alt','change', () => { setSliceAltitude(number('slice-alt') || 0); syncConfig(true); });
for (const id of ['slice','arrows','airflow','trails','clouds','rain','grid','axes','boundaries','dust','funnel','circulation',
  'cloud-opacity','rain-opacity','field-opacity','field','region','clip','flow-frame','quality']) {
  on(id, 'input', () => syncConfig(!['grid','axes','quality'].includes(id)));
}
button('methods', () => el('about').showModal());
button('close-methods', () => el('about').close());
button('fullscreen', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    el('fullscreen').textContent = 'Fullscreen unavailable';
  }
});
document.addEventListener('fullscreenchange', () => {
  el('fullscreen').textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
});
window.addEventListener('keydown', event => {
  if (event.target.matches('input, select, textarea, button') || el('about').open || event.ctrlKey || event.metaKey) return;
  const action = { Space: 'play', ArrowLeft: 'back', ArrowRight: 'next', KeyR: 'reset', KeyF: 'fullscreen' }[event.code];
  if (action && !event.repeat) {
    event.preventDefault();
    el(action).click();
  }
});

function prepareView() {
  const canvas = el('storm');
  const renderer = new T.WebGLRenderer({ canvas, antialias: false, alpha: false });
  renderer.autoClear = false;
  const camera = new T.PerspectiveCamera(53, 1, .001, 230);
  const scene = new T.Scene();
  const volume = createVolume();
  const diagnostics = createDiagnostics(provider, scene, el('slice-map'));
  const nav = createNavigation(camera, canvas);
  nav.preset('wide', state, true);
  function chooseCamera(id) {
    el('camera').value = id;
    nav.preset(id, state);
    el('view-label').textContent = cameras[id][0].toUpperCase();
  }
  on('camera', 'change', () => chooseCamera(value('camera')));
  on('camera-alt', 'change', () => nav.setAltitude(number('camera-alt') || 3));
  on('navigation', 'change', () => nav.setMode(value('navigation')));
  button('reset', () => chooseCamera('wide'));
  let dimensions;
  function resize() {
    const viewport = el('viewport');
    const [width, height] = [viewport.clientWidth, viewport.clientHeight];
    if (!width || !height) return;
    const [ratio] = quality[config.quality];
    const key = [width,height,ratio].join('/');
    if (dimensions === key) return;
    dimensions = key;
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const projected = new T.Vector3(), cameraRelative = new T.Vector3(), forward = new T.Vector3();
  function updateOverlay() {
    camera.getWorldDirection(forward);
    const bearing = (Math.atan2(forward.x, -forward.z) * 180 / Math.PI + 360) % 360;
    el('compass-needle').style.transform = 'rotate(' + -bearing + 'deg)';
    el('bearing').textContent = String(Math.round(bearing) % 360).padStart(3,'0') + '°';
    const altitude = Math.round(nav.altitude());
    if (document.activeElement !== el('camera-alt')) el('camera-alt').value = altitude;
    el('view-alt').textContent = altitude < 1000 ? altitude + ' m AGL' : (altitude / 1000).toFixed(3) + ' km AGL';
    const placed = [];
    features.forEach(([, position, enabled], i) => {
      const point = position(state);
      const [, , z] = point;
      projected.set(...toRender(...point));
      cameraRelative.copy(projected).sub(camera.position);
      const front = cameraRelative.dot(forward) > 0;
      projected.project(camera);
      const overlaps = placed.some(([a,b]) => Math.abs(a - projected.x) < .23 && Math.abs(b - projected.y) < .10);
      const clip = config.clip && (config.clip > 0 ? z > config.altitude : z < config.altitude);
      const show = (i >= features.length - 3 || check('labels')) && enabled(state) && !clip && front && !overlaps
        && Math.abs(projected.x) < .84 && Math.abs(projected.y) < .86;
      const node = annotations[i];
      node.hidden = !show;
      if (show) {
        node.style.left = 50 + projected.x * 50 + '%';
        node.style.top = 50 - projected.y * 50 + '%';
        placed.push([projected.x, projected.y]);
      }
    });
  }
  let sliceProbe;
  function inspect() {
    const slice = diagnostics.slice;
    if (!sliceProbe || !slice || !config.slice) return;
    const [fractionX, fractionY] = sliceProbe;
    const x = slice.cx + (fractionX - .5) * slice.width;
    const y = slice.cy + (.5 - fractionY) * slice.width;
    const [, units] = fields[config.field];
    const result = diagnose(provider, x, y, config.altitude, state)[config.field];
    el('probe').textContent = (x / 1000).toFixed(2) + ' E, ' + (y / 1000).toFixed(2) + ' N km · ' + result.toPrecision(3) + ' ' + units;
  }
  on('slice-map', 'pointermove', event => {
    const rect = el('slice-map').getBoundingClientRect();
    sliceProbe = [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height];
    inspect();
  });
  on('slice-map', 'focus', () => { sliceProbe = [.5, .5]; inspect(); });
  on('slice-map', 'keydown', event => {
    const direction = { ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1] }[event.code];
    if (!direction) return;
    event.stopPropagation();
    event.preventDefault();
    sliceProbe = (sliceProbe ?? [.5,.5]).map((part, i) => Math.min(1, Math.max(0, part + .02 * direction[i])));
    inspect();
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    renderer.setAnimationLoop(null);
    el('loading').hidden = true;
    el('viewport-error').hidden = false;
    el('viewport-error').textContent = 'WebGL context was lost. Reload to rebuild the 3D scene.';
  });
  let lastFrame = 0, fpsOrigin = null, frameCount = 0, lastRebuild = 0;
  renderer.setAnimationLoop(now => {
    const elapsed = lastFrame ? (now - lastFrame) / 1000 : 0;
    lastFrame = now;
    if (playing) {
      time = advanceTime(time, Math.min(elapsed, .20) * Number(value('play-speed')), check('loop'));
      state = provider.atTime(time);
      if (time >= duration && !check('loop')) setPlaying(false);
      updateDisplay();
    }
    resize();
    nav.frame(Math.min(elapsed, .055), Number(value('movement')));
    const rebuild = dirty || Math.abs(time - lastDiagnosticTime) >= 5 && now - lastRebuild >= 115;
    diagnostics.update(state, config, rebuild);
    if (rebuild) {
      lastDiagnosticTime = time;
      lastRebuild = now;
      dirty = false;
      inspect();
    }
    volume.update(camera, state, config);
    renderer.clear();
    renderer.render(volume.scene, camera);
    renderer.clearDepth();
    renderer.render(scene, camera);
    el('loading').hidden = true;
    updateOverlay();
    if (fpsOrigin === null) fpsOrigin = now;
    frameCount++;
    if (now - fpsOrigin >= 1000) {
      el('fps').textContent = Math.max(.1, Math.round(frameCount * 1000 / (now - fpsOrigin) * 10) / 10) + ' FPS';
      fpsOrigin = now;
      frameCount = 0;
    }
  });
}
syncConfig();
updateDisplay();
try {
  prepareView();
} catch (error) {
  console.error(error);
  el('loading').hidden = true;
  el('viewport-error').hidden = false;
  el('viewport-error').textContent = 'The 3D scene requires WebGL 2. Enable hardware acceleration or try another browser.';
}
