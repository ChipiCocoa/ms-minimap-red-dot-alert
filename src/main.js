// Wires the UI to the capture loop, the detector and the alert channels.

import { createAlertGate } from './alert-gate.js';
import {
  createAlerts,
  notificationPermission,
  notificationsSupported,
  requestNotificationPermission,
} from './alerts.js';
import { createCapture } from './capture.js';
import { createKeepAwake } from './keep-awake.js';
import { rectFromPoints } from './region.js';
import { DEFAULT_SETTINGS, loadSettings, normalizeSettings, saveSettings } from './settings.js';

const el = (id) => document.getElementById(id);

const ui = {
  statusPill: el('statusPill'),
  sourceMode: el('sourceMode'),
  dotCount: el('dotCount'),
  statThreshold: el('statThreshold'),
  statFps: el('statFps'),
  statLastAlert: el('statLastAlert'),
  statHidden: el('statHidden'),
  startButton: el('startButton'),
  stopButton: el('stopButton'),
  testButton: el('testButton'),
  clearRegionButton: el('clearRegionButton'),
  permissionButton: el('permissionButton'),
  permissionState: el('permissionState'),
  resetButton: el('resetButton'),
  previewWrap: el('previewWrap'),
  video: el('preview'),
  overlay: el('overlay'),
  regionInfo: el('regionInfo'),
};

const SCALAR_FIELDS = ['threshold', 'cooldownSeconds', 'sampleFps', 'stableFrames'];
const TOGGLE_FIELDS = ['notifySystem', 'notifySound', 'notifyFlash'];
const DETECT_NUMBER_FIELDS = ['hueTolerance', 'minSaturation', 'minValue', 'minArea', 'maxArea', 'mergeThreshold'];
const DETECT_TOGGLE_FIELDS = ['splitMergedBlobs'];

let settings = loadSettings(localStorage);
let gate = createGate();
let lastResult = null;
let dragStart = null;
let dragCurrent = null;
let flashTimer = null;
let hiddenFrames = 0;
let frameErrors = 0;
let sourceLabel = '';
const frameTimestamps = [];

const overlayContext = ui.overlay.getContext('2d');
const keepAwake = createKeepAwake();

const alerts = createAlerts({
  onFlash: (count) => {
    document.body.classList.remove('alerting');
    void document.body.offsetWidth; // Restart the animation on a repeat alert.
    document.body.classList.add('alerting');
    document.title = `🔴 ${count} 個紅點！`;

    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      document.body.classList.remove('alerting');
      document.title = '小地圖紅點警報';
    }, 4000);
  },
});

const capture = createCapture({
  video: ui.video,
  onResult: handleResult,
  onStop: handleStopped,
  onError: handleCaptureError,
});

// A frame that fails to process no longer stops sampling, so the failure has to
// be visible instead: a silent watcher is worse than no watcher.
function handleCaptureError(error) {
  frameErrors++;
  console.warn('capture', error);
  ui.sourceMode.textContent = `偵測發生錯誤（已略過 ${frameErrors} 幀）：${error?.message ?? error}`;
}

function gateOptions() {
  return {
    threshold: settings.threshold,
    stableFrames: settings.stableFrames,
    cooldownMs: settings.cooldownSeconds * 1000,
  };
}

function createGate() {
  return createAlertGate(gateOptions());
}

function persist() {
  settings = normalizeSettings(settings);
  saveSettings(localStorage, settings);
  capture.setDetectOptions(settings.detect);
  capture.setRegion(settings.region);
  ui.statThreshold.textContent = String(settings.threshold);
}

function fillForm() {
  for (const field of SCALAR_FIELDS) el(field).value = String(settings[field]);
  for (const field of TOGGLE_FIELDS) el(field).checked = settings[field];
  for (const field of DETECT_NUMBER_FIELDS) el(field).value = String(settings.detect[field]);
  for (const field of DETECT_TOGGLE_FIELDS) el(field).checked = settings.detect[field];
  ui.statThreshold.textContent = String(settings.threshold);
  describeRegion();
}

function bindForm() {
  for (const field of SCALAR_FIELDS) {
    el(field).addEventListener('change', (event) => {
      settings[field] = Number(event.target.value);
      persist();
      fillForm();
      // Reconfigured rather than rebuilt: a settings tweak must not clear the
      // cooldown and re-alert on a dot that has been there all along.
      gate.configure(gateOptions());
      if (field === 'sampleFps') capture.setFps(settings.sampleFps);
    });
  }

  for (const field of TOGGLE_FIELDS) {
    el(field).addEventListener('change', (event) => {
      settings[field] = event.target.checked;
      persist();
    });
  }

  for (const field of DETECT_NUMBER_FIELDS) {
    el(field).addEventListener('change', (event) => {
      settings.detect[field] = Number(event.target.value);
      persist();
      // Normalisation can adjust a field other than the one edited, so the
      // whole form is refilled rather than just this input.
      fillForm();
    });
  }

  for (const field of DETECT_TOGGLE_FIELDS) {
    el(field).addEventListener('change', (event) => {
      settings.detect[field] = event.target.checked;
      persist();
    });
  }
}

function describeRegion() {
  const region = settings.region;
  ui.clearRegionButton.disabled = !region;
  // Drives the callout over the preview, which only shows while sharing is
  // running and nothing has been framed yet.
  ui.previewWrap.classList.toggle('needs-region', !region);
  ui.regionInfo.classList.toggle('warn', !region);
  ui.regionInfo.textContent = region
    ? `已框選範圍：畫面的 ${(region.width * 100).toFixed(1)}% × ${(region.height * 100).toFixed(1)}%，`
      + `左上角在 ${(region.x * 100).toFixed(1)}%, ${(region.y * 100).toFixed(1)}%。`
    : '尚未框選範圍，目前偵測整個畫面。';
}

function setStatus(text, variant) {
  ui.statusPill.textContent = text;
  ui.statusPill.className = `pill pill-${variant}`;
}

function measureFps() {
  const now = performance.now();
  frameTimestamps.push(now);
  while (frameTimestamps.length && now - frameTimestamps[0] > 2000) frameTimestamps.shift();
  const span = now - frameTimestamps[0];
  const fps = span > 0 ? ((frameTimestamps.length - 1) * 1000) / span : 0;
  ui.statFps.textContent = `${fps.toFixed(1)} fps`;
}

function handleResult(result) {
  lastResult = result;
  measureFps();

  if (frameErrors > 0) {
    frameErrors = 0;
    ui.sourceMode.textContent = sourceLabel;
  }

  // Proof that sampling survives the tab being hidden, which is the state the
  // app spends almost all of its time in.
  if (document.hidden) {
    hiddenFrames++;
    ui.statHidden.textContent = `${hiddenFrames} 幀`;
  }

  ui.dotCount.textContent = String(result.count);
  ui.dotCount.classList.toggle('hot', result.count >= settings.threshold);
  setStatus(result.count >= settings.threshold ? `偵測到 ${result.count} 個紅點` : '偵測中', result.count >= settings.threshold ? 'alert' : 'live');

  if (gate.update(result.count, performance.now())) {
    alerts.fire({
      count: result.count,
      threshold: settings.threshold,
      channels: settings,
    });
    ui.statLastAlert.textContent = new Date().toLocaleTimeString('zh-TW', { hour12: false });
  }

  drawOverlay();
}

function handleStopped() {
  ui.startButton.disabled = false;
  ui.stopButton.disabled = true;
  ui.previewWrap.classList.remove('live');
  ui.sourceMode.textContent = '';
  ui.dotCount.textContent = '–';
  ui.dotCount.classList.remove('hot');
  ui.statFps.textContent = '0.0 fps';
  setStatus('待機中', 'idle');
  keepAwake.stop();
  frameTimestamps.length = 0;
  lastResult = null;
  drawOverlay();
}

function resizeOverlay() {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.round(ui.overlay.clientWidth * ratio);
  const height = Math.round(ui.overlay.clientHeight * ratio);
  if (width && height && (ui.overlay.width !== width || ui.overlay.height !== height)) {
    ui.overlay.width = width;
    ui.overlay.height = height;
  }
  drawOverlay();
}

function drawOverlay() {
  const { width, height } = ui.overlay;
  overlayContext.clearRect(0, 0, width, height);
  if (!width || !height) return;

  const preview = dragStart && dragCurrent ? rectFromPoints(dragStart, dragCurrent) : null;
  const region = preview ?? settings.region;

  if (region) {
    overlayContext.fillStyle = 'rgba(5, 7, 11, 0.55)';
    overlayContext.fillRect(0, 0, width, height);
    overlayContext.clearRect(
      region.x * width,
      region.y * height,
      region.width * width,
      region.height * height,
    );

    overlayContext.strokeStyle = preview ? '#ffffff' : '#4c8dff';
    overlayContext.lineWidth = 2;
    overlayContext.setLineDash(preview ? [6, 4] : []);
    overlayContext.strokeRect(
      region.x * width,
      region.y * height,
      region.width * width,
      region.height * height,
    );
    overlayContext.setLineDash([]);
  }

  if (!lastResult) return;

  const { blobs, rect, frameWidth, frameHeight } = lastResult;
  overlayContext.lineWidth = 2;
  overlayContext.font = `${Math.round(13 * (window.devicePixelRatio || 1))}px system-ui, sans-serif`;

  for (const blob of blobs) {
    const x = ((rect.x + blob.x) / frameWidth) * width;
    const y = ((rect.y + blob.y) / frameHeight) * height;
    const w = (blob.width / frameWidth) * width;
    const h = (blob.height / frameHeight) * height;
    const pad = 3;

    overlayContext.strokeStyle = '#35d07f';
    overlayContext.strokeRect(x - pad, y - pad, w + pad * 2, h + pad * 2);

    if (blob.dots > 1) {
      overlayContext.fillStyle = '#35d07f';
      overlayContext.fillText(`×${blob.dots}`, x + w + pad * 2, y + h);
    }
  }
}

function pointerPosition(event) {
  const bounds = ui.overlay.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) / bounds.width,
    y: (event.clientY - bounds.top) / bounds.height,
  };
}

function bindRegionSelection() {
  ui.overlay.addEventListener('pointerdown', (event) => {
    if (!capture.isRunning()) return;
    ui.overlay.setPointerCapture(event.pointerId);
    dragStart = pointerPosition(event);
    dragCurrent = dragStart;
    drawOverlay();
  });

  ui.overlay.addEventListener('pointermove', (event) => {
    if (!dragStart) return;
    dragCurrent = pointerPosition(event);
    drawOverlay();
  });

  ui.overlay.addEventListener('pointerup', (event) => {
    if (!dragStart) return;
    const region = rectFromPoints(dragStart, pointerPosition(event));
    dragStart = null;
    dragCurrent = null;

    if (region) {
      settings.region = region;
      persist();
      describeRegion();
    }
    drawOverlay();
  });

  ui.clearRegionButton.addEventListener('click', () => {
    settings.region = null;
    persist();
    describeRegion();
    drawOverlay();
  });
}

function refreshPermissionState() {
  if (!notificationsSupported()) {
    ui.permissionState.textContent = '這個瀏覽器不支援系統通知';
    ui.permissionButton.hidden = true;
    return;
  }

  const state = notificationPermission();
  ui.permissionButton.hidden = state !== 'default';
  ui.permissionState.textContent = {
    granted: '系統通知已允許',
    denied: '系統通知被封鎖，請到瀏覽器網站設定開啟',
    default: '尚未授權系統通知',
  }[state] ?? '';
}

function bindButtons() {
  ui.startButton.addEventListener('click', async () => {
    ui.startButton.disabled = true;

    // getDisplayMedia needs the click's transient activation and other calls
    // can spend it, so it goes first and everything else waits its turn. The
    // audio context is only created here, before the first await, because
    // creating it later would leave it suspended.
    const preparing = alerts.prepare();

    try {
      capture.setRegion(settings.region);
      capture.setDetectOptions(settings.detect);
      capture.setFps(settings.sampleFps);
      gate = createGate();
      hiddenFrames = 0;
      frameErrors = 0;
      ui.statHidden.textContent = '0 幀';

      const mode = await capture.start();
      if (mode === 'video-element') {
        keepAwake.start();
        sourceLabel = '相容模式：請讓此視窗保持可見';
      } else {
        sourceLabel = '背景取樣模式';
      }
      ui.sourceMode.textContent = sourceLabel;

      ui.stopButton.disabled = false;
      ui.previewWrap.classList.add('live');
      setStatus('偵測中', 'live');
      resizeOverlay();

      await preparing;

      // Asked for as part of starting, once capture has taken the gesture it
      // needed. Capture is already running by now, so a rejected prompt must
      // not surface as a capture failure; the state simply stays 'default' and
      // the button in the settings panel is the way back to it.
      await requestNotificationPermission().catch(() => {});
      refreshPermissionState();
    } catch (error) {
      ui.startButton.disabled = false;
      if (error?.name !== 'NotAllowedError') {
        ui.sourceMode.textContent = `無法開始擷取：${error?.message ?? error}`;
      }
    }
  });

  ui.stopButton.addEventListener('click', () => capture.stop());

  ui.testButton.addEventListener('click', async () => {
    await requestNotificationPermission();
    refreshPermissionState();
    await alerts.prepare();
    alerts.fire({ count: settings.threshold, threshold: settings.threshold, channels: settings });
  });

  ui.permissionButton.addEventListener('click', async () => {
    await requestNotificationPermission();
    refreshPermissionState();
  });

  ui.resetButton.addEventListener('click', () => {
    const region = settings.region;
    settings = normalizeSettings({ ...DEFAULT_SETTINGS, region });
    persist();
    fillForm();
    gate.configure(gateOptions());
    capture.setFps(settings.sampleFps);
  });
}

ui.video.addEventListener('loadedmetadata', () => {
  ui.previewWrap.style.setProperty('--preview-aspect', `${ui.video.videoWidth} / ${ui.video.videoHeight}`);
  resizeOverlay();
});

new ResizeObserver(resizeOverlay).observe(ui.overlay);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

fillForm();
bindForm();
bindButtons();
bindRegionSelection();
refreshPermissionState();
persist();
