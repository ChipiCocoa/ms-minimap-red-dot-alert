// Decides when a red-dot count deserves an alert. Pure state machine: time is
// passed in, so it can be unit tested without timers.

export const DEFAULT_ALERT_OPTIONS = {
  threshold: 1,
  stableFrames: 2,
  cooldownMs: 30000,
};

export function createAlertGate(options = {}) {
  const opts = { ...DEFAULT_ALERT_OPTIONS, ...options };

  let aboveStreak = 0;
  let belowStreak = 0;
  let armed = false;
  let pending = false;
  let lastNotifiedAt = null;

  const cooldownElapsed = (now) =>
    lastNotifiedAt === null || now - lastNotifiedAt >= opts.cooldownMs;

  return {
    /** Feeds one detection result in; returns true when an alert should fire. */
    update(count, now) {
      if (count >= opts.threshold) {
        aboveStreak++;
        belowStreak = 0;
      } else {
        belowStreak++;
        aboveStreak = 0;
      }

      // Both edges need the same number of stable frames, so a single noisy
      // frame neither raises a false alarm nor clears a real one.
      if (!armed && aboveStreak >= opts.stableFrames) {
        armed = true;
        pending = true;
      } else if (armed && belowStreak >= opts.stableFrames) {
        armed = false;
        pending = false;
      }

      // An alert raised during the cooldown is held, not dropped, so a player
      // who arrives just after the previous alert is still reported.
      if (armed && pending && cooldownElapsed(now)) {
        pending = false;
        lastNotifiedAt = now;
        return true;
      }

      return false;
    },
  };
}
