import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readPng } from './helpers/png.js';
import { createImage, fillRect } from './helpers/synthetic.js';
import { detectRedDots } from '../src/detect.js';

const RED = [255, 0, 0];

const fixture = (name) => readPng(fileURLToPath(new URL(`fixtures/${name}`, import.meta.url)));

test('counts the single red dot in a real minimap screenshot', () => {
  const result = detectRedDots(fixture('minimap-one-dot.png'));
  assert.equal(result.count, 1);
});

test('reports the bounding box and area of each detected dot', () => {
  const { blobs } = detectRedDots(fixture('minimap-one-dot.png'));
  assert.deepEqual(blobs, [{ x: 254, y: 56, width: 10, height: 10, area: 84, dots: 1 }]);
});

test('counts every dot when several players are on the minimap', () => {
  const image = createImage(120, 90);
  fillRect(image, 10, 10, 5, 5, RED);
  fillRect(image, 60, 40, 5, 5, RED);
  fillRect(image, 100, 80, 5, 5, RED);

  assert.equal(detectRedDots(image).count, 3);
});

test('ignores the orange torches and brown scenery of the map itself', () => {
  const image = createImage(60, 60);
  const scenery = [[226, 115, 4], [213, 62, 6], [199, 76, 6], [170, 68, 0], [136, 51, 17]];
  scenery.forEach((colour, index) => fillRect(image, 5 + index * 10, 20, 6, 6, colour));

  assert.equal(detectRedDots(image).count, 0);
});

test('ignores the yellow marker that represents the local player', () => {
  const image = createImage(60, 60);
  fillRect(image, 20, 20, 5, 5, [255, 255, 0]);

  assert.equal(detectRedDots(image).count, 0);
});

test('ignores stray pixels smaller than the minimum dot area', () => {
  const image = createImage(60, 60);
  fillRect(image, 10, 10, 1, 1, RED);
  fillRect(image, 30, 30, 1, 2, RED);

  assert.equal(detectRedDots(image).count, 0);
});

test('ignores red regions larger than the maximum dot area', () => {
  const image = createImage(60, 60);
  fillRect(image, 5, 5, 40, 40, RED);

  assert.equal(detectRedDots(image).count, 0);
});

test('counts a merged blob as one dot by default', () => {
  const image = createImage(60, 60);
  fillRect(image, 10, 10, 5, 5, RED);
  fillRect(image, 30, 30, 10, 5, RED);

  assert.equal(detectRedDots(image).count, 2);
});

test('estimates how many players a merged blob contains when splitting is enabled', () => {
  const image = createImage(80, 60);
  fillRect(image, 5, 5, 5, 5, RED);
  fillRect(image, 25, 5, 5, 5, RED);
  fillRect(image, 45, 5, 5, 5, RED);
  fillRect(image, 20, 30, 10, 5, RED);

  const { count, blobs } = detectRedDots(image, { splitMergedBlobs: true });

  assert.equal(count, 5);
  assert.deepEqual(blobs.map((blob) => blob.dots), [1, 1, 1, 2]);
});
