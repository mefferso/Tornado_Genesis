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
