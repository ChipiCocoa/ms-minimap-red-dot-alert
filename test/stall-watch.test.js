import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStallWatch } from '../src/stall-watch.js';

const watcher = () => createStallWatch({ stallAfterMs: 3000 });

test('stays quiet while frames keep arriving', () => {
  const watch = watcher();
  watch.feed(0);

  assert.equal(watch.check(1000), false);
  watch.feed(1200);
  assert.equal(watch.check(2000), false);
  assert.equal(watch.stalled, false);
});

test('reports a stall once frames stop for longer than the limit', () => {
  const watch = watcher();
  watch.feed(0);

  assert.equal(watch.check(2999), false);
  assert.equal(watch.check(3000), true);
  assert.equal(watch.stalled, true);
});

test('reports each stall only once', () => {
  const watch = watcher();
  watch.feed(0);
  watch.check(3000);

  assert.equal(watch.check(4000), false);
  assert.equal(watch.check(9000), false);
});

test('reports recovery when a frame arrives after a stall', () => {
  const watch = watcher();
  watch.feed(0);
  watch.check(3000);

  assert.equal(watch.feed(3500), true);
  assert.equal(watch.stalled, false);
});

test('does not report recovery for a frame that never followed a stall', () => {
  const watch = watcher();
  watch.feed(0);

  assert.equal(watch.feed(500), false);
});

test('reports a stall when capture starts but no frame ever arrives', () => {
  const watch = watcher();
  watch.feed(0);

  assert.equal(watch.check(5000), true);
});
