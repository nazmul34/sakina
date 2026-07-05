import {
  computeDailyPrayerTimes,
  getCurrentPrayer,
  getNextPrayer,
  PRAYER_NAMES,
} from './prayerTimes';

/** A fixed location so times are deterministic regardless of the CI machine. */
const MECCA = { latitude: 21.4225, longitude: 39.8262 };

describe('getCurrentPrayer', () => {
  // Probe a full day at 3-hour steps so we cross every prayer boundary plus both
  // night wrap-arounds (before Fajr, and after Isha).
  const hours = [0, 3, 6, 9, 12, 15, 18, 21, 23];

  it('always ends exactly when the next prayer begins, and contains now', () => {
    for (const hour of hours) {
      const now = new Date(Date.UTC(2026, 6, 5, hour, 30, 0));
      const current = getCurrentPrayer(MECCA, now);
      const next = getNextPrayer(MECCA, now);

      // The current prayer runs until the next one starts.
      expect(current.end.getTime()).toBe(next.time.getTime());
      // `now` sits inside [start, end): the prayer has begun and hasn't ended.
      expect(current.start.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(now.getTime()).toBeLessThan(current.end.getTime());
      // It's one of the five prayers.
      expect(PRAYER_NAMES).toContain(current.name);
    }
  });

  it('is Isha overnight, wrapping to the next Fajr (timezone-agnostic)', () => {
    // A minute after Isha we're in the overnight window: the current prayer is
    // Isha and the next is Fajr, whichever calendar day the runner lands on.
    const isha = computeDailyPrayerTimes(
      MECCA,
      new Date(Date.UTC(2026, 6, 5, 12, 0, 0)),
    ).byName.isha;
    const overnight = new Date(isha.getTime() + 60_000);

    expect(getCurrentPrayer(MECCA, overnight).name).toBe('isha');
    expect(getNextPrayer(MECCA, overnight).name).toBe('fajr');
  });
});
