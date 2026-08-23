import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, loadSettings, normalizeSettings, saveSettings } from '../src/settings.js';

const fakeStorage = (initial = {}) => ({
  items: { ...initial },
  getItem(key) {
    return key in this.items ? this.items[key] : null;
  },
  setItem(key, value) {
    this.items[key] = String(value);
  },
});

test('falls back to defaults when nothing has been stored', () => {
  assert.deepEqual(normalizeSettings(undefined), DEFAULT_SETTINGS);
});

test('keeps stored values that are inside the supported range', () => {
  const settings = normalizeSettings({ threshold: 3, sampleFps: 8, cooldownSeconds: 120 });

  assert.equal(settings.threshold, 3);
  assert.equal(settings.sampleFps, 8);
  assert.equal(settings.cooldownSeconds, 120);
});

test('clamps a threshold below one', () => {
  assert.equal(normalizeSettings({ threshold: 0 }).threshold, 1);
});

test('clamps the sample rate to the supported range', () => {
  assert.equal(normalizeSettings({ sampleFps: 99 }).sampleFps, 10);
  assert.equal(normalizeSettings({ sampleFps: 0 }).sampleFps, 1);
});

test('replaces values of the wrong type with the default', () => {
  assert.equal(normalizeSettings({ threshold: 'lots' }).threshold, DEFAULT_SETTINGS.threshold);
  assert.equal(normalizeSettings({ notifySound: 'yes' }).notifySound, DEFAULT_SETTINGS.notifySound);
});

test('keeps a stored region that describes a valid rect', () => {
  const region = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 };

  assert.deepEqual(normalizeSettings({ region }).region, region);
});

test('drops a stored region that is not a valid rect', () => {
  assert.equal(normalizeSettings({ region: { x: 0.1, y: 0.2 } }).region, null);
  assert.equal(normalizeSettings({ region: { x: -1, y: 0, width: 3, height: 0.5 } }).region, null);
});

test('clamps detector thresholds that would disable filtering', () => {
  const { detect } = normalizeSettings({ detect: { minSaturation: 5, hueTolerance: -3 } });

  assert.equal(detect.minSaturation, 1);
  assert.equal(detect.hueTolerance, 0);
});

test('loads defaults when storage is empty', () => {
  assert.deepEqual(loadSettings(fakeStorage()), DEFAULT_SETTINGS);
});

test('loads defaults when storage holds something that is not settings', () => {
  const storage = fakeStorage({ 'artale-red-dot-alert': 'not json at all' });

  assert.deepEqual(loadSettings(storage), DEFAULT_SETTINGS);
});

test('round-trips saved settings through storage', () => {
  const storage = fakeStorage();
  const settings = normalizeSettings({ threshold: 4, sampleFps: 6, notifyFlash: false });

  saveSettings(storage, settings);

  assert.deepEqual(loadSettings(storage), settings);
});
