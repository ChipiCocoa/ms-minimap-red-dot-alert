// Alert delivery: desktop notification, audible chime and an on-page flash.
// Each channel is independent so the user can keep only what they want.

export function notificationsSupported() {
  return typeof Notification !== 'undefined';
}

export function notificationPermission() {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

export function createAlerts({ onFlash }) {
  let audioContext = null;
  let serviceWorker = null;

  async function showNotification({ title, body, tag }) {
    if (notificationPermission() !== 'granted') return;

    const options = {
      body,
      tag,
      renotify: true,
      requireInteraction: false,
      silent: true, // The chime is handled separately so it can be switched off.
    };

    // A service worker notification survives the tab being hidden or minimised
    // on platforms where a page-scoped Notification would be dropped.
    try {
      if (serviceWorker) {
        await serviceWorker.showNotification(title, options);
        return;
      }
    } catch {
      // Fall through to the page-scoped notification.
    }
    new Notification(title, options);
  }

  // Rising for an arrival, falling for a fault: the two must be tellable apart
  // by ear, since the whole point is that nobody is looking at the screen.
  const CHIMES = {
    alert: [880, 1320],
    fault: [660, 440],
  };

  function playChime(kind) {
    if (!audioContext) return;
    if (audioContext.state === 'suspended') audioContext.resume();

    const now = audioContext.currentTime;
    (CHIMES[kind] ?? CHIMES.alert).forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = now + index * 0.16;

      oscillator.type = 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.28, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);

      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.16);
    });
  }

  return {
    /**
     * Must be called from a user gesture so audio is allowed to start. The
     * audio context is created before the first await so the gesture is not
     * spent, and nothing here rejects: failing to set up a channel must never
     * stop capture from starting.
     */
    async prepare() {
      if (!audioContext) {
        const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
        if (AudioContextClass) audioContext = new AudioContextClass();
      }

      try {
        if (audioContext?.state === 'suspended') await audioContext.resume();
      } catch {
        // An audio context that will not start just means no chime.
      }

      if (!serviceWorker && 'serviceWorker' in navigator) {
        try {
          serviceWorker = await navigator.serviceWorker.ready;
        } catch {
          serviceWorker = null;
        }
      }
    },

    fire({ title, body, tag, kind = 'alert', channels }) {
      if (channels.notifySystem) showNotification({ title, body, tag });
      if (channels.notifySound) playChime(kind);
      if (channels.notifyFlash) onFlash(title, kind);
    },
  };
}
