// Alert delivery: desktop notification, audible chime and an on-page flash.
// Each channel is independent so the user can keep only what they want.

const NOTIFICATION_TAG = 'artale-red-dot';

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

  async function showNotification(count, threshold) {
    if (notificationPermission() !== 'granted') return;

    const title = `小地圖出現 ${count} 個紅點`;
    const options = {
      body: `已達到警戒值 ${threshold}，可能有其他玩家進入地圖。`,
      tag: NOTIFICATION_TAG,
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

  function playChime() {
    if (!audioContext) return;
    if (audioContext.state === 'suspended') audioContext.resume();

    const now = audioContext.currentTime;
    [880, 1320].forEach((frequency, index) => {
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
    /** Must be called from a user gesture so audio is allowed to start. */
    async prepare() {
      if (!audioContext) {
        const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
        if (AudioContextClass) audioContext = new AudioContextClass();
      }
      if (audioContext?.state === 'suspended') await audioContext.resume();

      if (!serviceWorker && 'serviceWorker' in navigator) {
        try {
          serviceWorker = await navigator.serviceWorker.ready;
        } catch {
          serviceWorker = null;
        }
      }
    },

    fire({ count, threshold, channels }) {
      if (channels.notifySystem) showNotification(count, threshold);
      if (channels.notifySound) playChime();
      if (channels.notifyFlash) onFlash(count);
    },
  };
}
