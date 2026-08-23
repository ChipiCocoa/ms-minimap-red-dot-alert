// Supplies frames from a screen-capture track at a bounded rate.
//
// The tab running this app is hidden while the game is in the foreground, and
// a hidden tab gets no rendering callbacks and heavily throttled timers. So the
// preferred path reads VideoFrames straight off the capture track, which is
// driven by the capture pipeline rather than by the page being painted. The
// video-element path only exists for browsers without that API.

export function supportsTrackProcessor() {
  return typeof globalThis.MediaStreamTrackProcessor === 'function';
}

function createProcessorSource({ track, minIntervalMs, onFrame, onEnd }) {
  const processor = new MediaStreamTrackProcessor({ track });
  const reader = processor.readable.getReader();
  let stopped = false;
  let lastFrameAt = 0;

  (async () => {
    while (!stopped) {
      let result;
      try {
        result = await reader.read();
      } catch {
        break;
      }
      if (result.done) break;

      const frame = result.value;
      try {
        const now = performance.now();
        if (now - lastFrameAt >= minIntervalMs) {
          lastFrameAt = now;
          onFrame(frame, frame.displayWidth, frame.displayHeight);
        }
      } finally {
        frame.close();
      }
    }
    if (!stopped) onEnd();
  })();

  return {
    mode: 'track-processor',
    stop() {
      stopped = true;
      reader.cancel().catch(() => {});
    },
  };
}

function createVideoSource({ video, minIntervalMs, onFrame }) {
  let stopped = false;
  let lastFrameAt = 0;
  let timer = null;

  const grab = () => {
    if (stopped || !video.videoWidth) return;
    const now = performance.now();
    if (now - lastFrameAt < minIntervalMs) return;
    lastFrameAt = now;
    onFrame(video, video.videoWidth, video.videoHeight);
  };

  if (typeof video.requestVideoFrameCallback === 'function') {
    const step = () => {
      if (stopped) return;
      grab();
      video.requestVideoFrameCallback(step);
    };
    video.requestVideoFrameCallback(step);
  }

  // Runs alongside the frame callback: the callback stops in a hidden tab and
  // the timer keeps going (throttled) while the page is kept awake.
  timer = setInterval(grab, minIntervalMs);

  return {
    mode: 'video-element',
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}

/**
 * Starts delivering frames. `onFrame(source, width, height)` is called with a
 * drawable that is only valid for the duration of the call.
 */
export function createFrameSource({ track, video, fps, onFrame, onEnd = () => {} }) {
  const minIntervalMs = 1000 / fps - 1;

  return supportsTrackProcessor()
    ? createProcessorSource({ track, minIntervalMs, onFrame, onEnd })
    : createVideoSource({ video, minIntervalMs, onFrame });
}
