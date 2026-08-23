import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rectFromPoints, toPixelRect } from '../src/region.js';

function assertRect(actual, expected) {
  assert.ok(actual, 'expected a rect');
  for (const key of ['x', 'y', 'width', 'height']) {
    assert.ok(
      Math.abs(actual[key] - expected[key]) < 1e-9,
      `${key}: expected ${expected[key]}, got ${actual[key]}`,
    );
  }
}

test('builds a rect from two points dragged towards the bottom right', () => {
  assertRect(rectFromPoints({ x: 0.2, y: 0.1 }, { x: 0.6, y: 0.5 }), {
    x: 0.2,
    y: 0.1,
    width: 0.4,
    height: 0.4,
  });
});

test('builds the same rect when the drag goes towards the top left', () => {
  assertRect(rectFromPoints({ x: 0.6, y: 0.5 }, { x: 0.2, y: 0.1 }), {
    x: 0.2,
    y: 0.1,
    width: 0.4,
    height: 0.4,
  });
});

test('clamps a drag that runs off the edge of the preview', () => {
  assertRect(rectFromPoints({ x: -0.2, y: -0.1 }, { x: 1.4, y: 0.5 }), {
    x: 0,
    y: 0,
    width: 1,
    height: 0.5,
  });
});

test('returns null for a drag too small to be a minimap', () => {
  assert.equal(rectFromPoints({ x: 0.4, y: 0.4 }, { x: 0.404, y: 0.6 }), null);
});

test('maps a normalised region onto source pixels', () => {
  const region = { x: 0.25, y: 0.5, width: 0.5, height: 0.25 };

  assert.deepEqual(toPixelRect(region, 800, 600), { x: 200, y: 300, width: 400, height: 150 });
});

test('keeps the pixel rect inside the source frame', () => {
  const region = { x: 0.99, y: 0.99, width: 0.5, height: 0.5 };

  assert.deepEqual(toPixelRect(region, 100, 100), { x: 99, y: 99, width: 1, height: 1 });
});
