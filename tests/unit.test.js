import { traceFlow, surfaceCrossing, sampleSurfaces } from '../src/fieldGeometry.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProceduralAtmosphere, diagnose, toRender, fromRender } from '../src/atmosphere.js';
import { stages, stageAt, duration, advanceTime, boundedTime, formatTime } from '../src/timeline.js';

const near = (actual, expected, tolerance = 1e-8) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} expected near ${expected}`);
const provider = new ProceduralAtmosphere();

test('east, north and up retain a right-handed transform when rendered in km', () => {
  assert.deepEqual(toRender(1000, 2000, 3000), [1, 3, -2]);
  assert.deepEqual(fromRender(...toRender(-115, 529, 3)), [-115, 529, 3]);
});

test('curl, convergence and tendency terms of a known affine field', () => {
  const analytic = { velocity: (x, y, z) => [10 + 2*y + 3*z, 15 + 4*x + 5*z, 6*x + 7*y + 8*z] };
  for (const z of [0, 2, 25]) {
    const d = diagnose(analytic, 0, 0, z, null);
    near(d.xi, 2); near(d.eta, -3); near(d.zeta, 2);
    near(d.convergence, 0); near(d.tilting, -9); near(d.stretching, 16);
    near(Math.hypot(d.streamwise, d.crosswise), d.horizontal);
  }
  const convergent = { velocity: (x, y, z) => [-3*x, -2*y, 5*z] };
  near(diagnose(convergent, 0, 0, 0, null).convergence, 5);
});

test('terrain is impermeable and ambient flow has streamwise vorticity', () => {
  for (const [minute] of stages) {
    const state = provider.atTime(minute * 60);
    for (const [x,y] of [[0,0], [state.x,state.y], [-3500,500], [12000,5000]]) {
      assert.equal(provider.velocity(x,y,0,state)[2], 0);
    }
  }
  const d = diagnose(provider, 20000, -12000, 100, provider.atTime(0));
  near(d.zeta, 0);
  assert.ok(d.streamwise > .01);
});

test('deep rotation, surface tightening, and delayed condensation are separable', () => {
  const aloft = provider.atTime(34 * 60);
  const genesis = provider.atTime(64 * 60);
  const mature = provider.atTime(73 * 60);
  const dissipated = provider.atTime(duration);
  const surface = state => diagnose(provider, state.x, state.y, 25, state).zeta;
  assert.ok(diagnose(provider, 1_377, 1_122, 5100, aloft).zeta > .01);
  assert.ok(Math.abs(surface(aloft)) < .015);
  assert.ok(surface(genesis) > surface(aloft) + .04);
  assert.equal(genesis.funnel, 0);
  assert.ok(surface(mature) > surface(genesis) && mature.funnel > .9);
  assert.ok(Math.abs(surface(dissipated)) < .004 && dissipated.funnel === 0);
});

test('lifecycle is continuous around markers and repeatable after seeking', () => {
  const sample = time => provider.velocity(250, 330, 70, provider.atTime(time));
  for (const [minute] of stages.slice(1)) {
    const before = sample(minute * 60 - .01);
    const after = sample(minute * 60 + .01);
    assert.ok(Math.hypot(...after.map((value,i) => value - before[i])) < .030);
  }
  const then = sample(4171);
  sample(15);
  assert.deepEqual(sample(4171), then);
});

test('stage boundaries, timer text, clamping and loop wrapping', () => {
  for (const [i,[minute]] of stages.entries()) {
    assert.equal(stageAt(minute * 60), i);
    if (i) assert.equal(stageAt(minute * 60 - 1), i - 1);
  }
  assert.equal(boundedTime(-10), 0);
  assert.equal(advanceTime(duration - 1, 4, false), duration);
  assert.equal(advanceTime(duration - 1, 4, true), 3);
  assert.equal(formatTime(64 * 60 + 3), '64:03');
});

test('vortex texture phase is deterministic and accelerates with circulation', () => {
  const provider = new ProceduralAtmosphere();
  const phase = t => provider.atTime(t).vortexPhase;
  assert.ok(Number.isFinite(phase(4320)));
  assert.equal(phase(4320), phase(4320));
  assert.ok(phase(4330) - phase(4320) > phase(3850) - phase(3840));
  assert.ok(phase(4330) > phase(4320));
});

test('flow tracing distinguishes frozen snapshots from forward parcels and respects the ROI', () => {
  const provider = { atTime: seconds => ({ seconds }), velocity: (x, y, z, state) => [state.seconds, 2, 10] };
  const setup = { steps: 3, step: 2, top: 25, frame: [0, 0, 0] };
  const frozen = traceFlow(provider, { seconds: 4 }, [0, 0, 0], setup);
  const times = [];
  const parcel = traceFlow(provider, { seconds: 4 }, [0, 0, 0], { ...setup, parcel: true, times });
  assert.deepEqual(frozen, [[0,0,0],[8,4,20],[10,5,25]]);
  assert.deepEqual(parcel, [[0,0,0],[10,4,20],[13.5,5,25]]);
  assert.deepEqual(times, [4, 6, 6.5]);
  assert.equal(traceFlow(provider, { seconds: 5400 }, [0, 0, 0], { ...setup, parcel: true }).length, 1);
});

test('threshold crossing interpolates signed diagnostic values in ENU', () => {
  assert.deepEqual(surfaceCrossing([0,10,50], [40,10,50], -.4, -.1, -.25), [20,10,50]);
  assert.deepEqual(surfaceCrossing([0,0,0], [0,0,40], 0, 2, 1), [0,0,20]);
});

test('isosurfaces use the shared diagnostic and retain both signs in render coordinates', () => {
  const provider = { velocity: (x, y, z) => [0, 0, x / 10] };
  const options = {
    cx: 0, cy: 0, width: 1000, bottom: 0, top: 500, field: 'w',
    signed: true, threshold: 20, clip: 1, clipAltitude: 250,
  };
  const normals = [[], []];
  const [positive, negative] = sampleSurfaces(provider, {}, options, normals);
  assert.equal(normals[0][0], -1);
  assert.equal(normals[1][0], 1);
  for (const [vertices, east] of [[positive, .2], [negative, -.2]]) {
    assert.ok(vertices.length > 0);
    for (let i = 0; i < vertices.length; i += 3) {
      assert.ok(Math.abs(vertices[i] - east) < 1e-9);
      assert.ok(vertices[i + 1] >= 0 && vertices[i + 1] <= .25);
    }
  }
});

test('tornado winds can be suppressed independently of condensation and debris', () => {
  const provider = new ProceduralAtmosphere();
  const original = provider.atTime(4380);
  provider.includeTornadoWind = false;
  const without = provider.atTime(4380);
  assert.equal(without.funnel, original.funnel);
  assert.equal(without.dust, original.dust);
  assert.equal(without.vortexPhase, original.vortexPhase);
  assert.equal(without.rotations[3][5], 0);
  assert.equal(without.drafts[4][5], 0);
  assert.deepEqual(without.rotations[2], original.rotations[2]);
});
