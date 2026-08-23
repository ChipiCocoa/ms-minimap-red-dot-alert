import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAlertGate } from '../src/alert-gate.js';

test('waits for the count to stay above the threshold before notifying', () => {
  const gate = createAlertGate({ threshold: 1, stableFrames: 2, cooldownMs: 30000 });

  assert.equal(gate.update(1, 0), false);
});

test('notifies once the threshold has been stable for the required frames', () => {
  const gate = createAlertGate({ threshold: 1, stableFrames: 2, cooldownMs: 30000 });

  gate.update(1, 0);

  assert.equal(gate.update(1, 250), true);
});

test('stays quiet while the count remains above the threshold', () => {
  const gate = createAlertGate({ threshold: 1, stableFrames: 2, cooldownMs: 30000 });
  gate.update(1, 0);
  gate.update(1, 250);

  assert.equal(gate.update(2, 500), false);
  assert.equal(gate.update(1, 750), false);
});

test('treats a single dropped frame as noise rather than the player leaving', () => {
  const gate = createAlertGate({ threshold: 1, stableFrames: 2, cooldownMs: 30000 });
  gate.update(1, 0);
  gate.update(1, 250);

  gate.update(0, 500);

  assert.equal(gate.update(1, 750), false);
  assert.equal(gate.update(1, 1000), false);
});

test('notifies again after the player leaves and returns past the cooldown', () => {
  const gate = createAlertGate({ threshold: 1, stableFrames: 2, cooldownMs: 30000 });
  gate.update(1, 0);
  gate.update(1, 250);
  gate.update(0, 500);
  gate.update(0, 750);

  assert.equal(gate.update(1, 31000), false);
  assert.equal(gate.update(1, 31250), true);
});

test('suppresses a repeat alert inside the cooldown window', () => {
  const gate = createAlertGate({ threshold: 1, stableFrames: 2, cooldownMs: 30000 });
  gate.update(1, 0);
  gate.update(1, 250);
  gate.update(0, 500);
  gate.update(0, 750);

  assert.equal(gate.update(1, 1000), false);
  assert.equal(gate.update(1, 1250), false);
});

test('delivers the suppressed alert when the cooldown expires and dots remain', () => {
  const gate = createAlertGate({ threshold: 1, stableFrames: 2, cooldownMs: 30000 });
  gate.update(1, 0);
  gate.update(1, 250);
  gate.update(0, 500);
  gate.update(0, 750);
  gate.update(1, 1000);
  gate.update(1, 1250);

  assert.equal(gate.update(1, 30250), true);
});

test('honours a threshold higher than one', () => {
  const gate = createAlertGate({ threshold: 3, stableFrames: 2, cooldownMs: 30000 });

  assert.equal(gate.update(2, 0), false);
  assert.equal(gate.update(2, 250), false);
  assert.equal(gate.update(3, 500), false);
  assert.equal(gate.update(3, 750), true);
});
