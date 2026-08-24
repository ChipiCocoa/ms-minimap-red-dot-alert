import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFramePump } from '../src/frame-pump.js';

test('delivers the first frame it is given', () => {
  const seen = [];
  const pump = createFramePump({ minIntervalMs: 100, onFrame: (frame) => seen.push(frame) });

  pump.push('a', 0);

  assert.deepEqual(seen, ['a']);
});

test('drops frames that arrive faster than the sample interval', () => {
  const seen = [];
  const pump = createFramePump({ minIntervalMs: 100, onFrame: (frame) => seen.push(frame) });

  pump.push('a', 0);
  pump.push('b', 50);
  pump.push('c', 100);

  assert.deepEqual(seen, ['a', 'c']);
});

test('keeps sampling after a frame handler throws', () => {
  const seen = [];
  const pump = createFramePump({
    minIntervalMs: 0,
    onFrame: (frame) => {
      seen.push(frame);
      if (frame === 'b') throw new Error('boom');
    },
    onError: () => {},
  });

  pump.push('a', 0);
  pump.push('b', 1);
  pump.push('c', 2);

  assert.deepEqual(seen, ['a', 'b', 'c']);
});

test('reports a frame handler failure instead of swallowing it', () => {
  const errors = [];
  const pump = createFramePump({
    minIntervalMs: 0,
    onFrame: () => { throw new Error('boom'); },
    onError: (error) => errors.push(error.message),
  });

  pump.push('a', 0);

  assert.deepEqual(errors, ['boom']);
});
