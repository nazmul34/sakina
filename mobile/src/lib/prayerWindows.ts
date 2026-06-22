/**
 * Prayer windows — the bridge from on-device prayer times to prayer-aware
 * silent (FR-5.5, EPIC-05 → F-01.10, EPIC-01).
 *
 * A "prayer window" is the span around a prayer during which auto-silent can be
 * *tightened* near a mosque: from a few minutes before jamaat (congregation)
 * until the end of typical salah (PRD §6.1 synergy note). Jamaat times aren't
 * known precisely without crowdsourced data (EPIC-08), so we approximate jamaat
 * as the computed adhan time plus a configurable offset; the window then extends
 * a little before it and a typical salah length after.
 *
 * This module is pure and offline — it only shapes time spans from the prayer
 * times {@link computeDailyPrayerTimes} already produces. The opt-in setting and
 * the decision the auto-silent layer actually calls live in
 * {@link ./prayerAwareSilent}.
 */

import type { LatLng } from './geofencing/types';
import {
  computeDailyPrayerTimes,
  DEFAULT_PRAYER_TIMES_CONFIG,
  type PrayerName,
  type PrayerTimesConfig,
} from './prayerTimes';

/** Tunables that turn a prayer's adhan time into a silence window. */
export interface PrayerWindowConfig {
  /** Minutes after adhan that jamaat is assumed to begin (no crowdsourced data). */
  readonly jamaatOffsetMinutes: number;
  /** Minutes before jamaat to start the window (silence a little early). */
  readonly preMinutes: number;
  /** Typical salah length in minutes; how far past jamaat the window runs. */
  readonly salahMinutes: number;
}

/**
 * Conservative defaults: jamaat ~10 min after adhan, silence from 5 min before,
 * for a ~20 min salah. The PRD's example is "5 min before jamaat to end of
 * typical salah"; these are tunable as field data (or crowdsourced times) arrive.
 */
export const DEFAULT_PRAYER_WINDOW_CONFIG: PrayerWindowConfig = {
  jamaatOffsetMinutes: 10,
  preMinutes: 5,
  salahMinutes: 20,
};

/** A computed silence window for one prayer. */
export interface PrayerWindow {
  readonly name: PrayerName;
  readonly start: Date;
  readonly end: Date;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/**
 * The five prayer windows for a location and day, in chronological order. Pure
 * and offline.
 */
export function computePrayerWindows(
  location: LatLng,
  date: Date = new Date(),
  config: PrayerTimesConfig = DEFAULT_PRAYER_TIMES_CONFIG,
  windowConfig: PrayerWindowConfig = DEFAULT_PRAYER_WINDOW_CONFIG,
): readonly PrayerWindow[] {
  const { times } = computeDailyPrayerTimes(location, date, config);
  return times.map(({ name, time }) => {
    const jamaat = addMinutes(time, windowConfig.jamaatOffsetMinutes);
    return {
      name,
      start: addMinutes(jamaat, -windowConfig.preMinutes),
      end: addMinutes(jamaat, windowConfig.salahMinutes),
    };
  });
}

/**
 * The prayer window `now` currently falls inside, or `null` if none. This is the
 * primitive the auto-silent decision is built on: "are we in a prayer window
 * right now?" Pure and offline; falls back to `null` rather than throwing.
 */
export function currentPrayerWindow(
  location: LatLng,
  now: Date = new Date(),
  config: PrayerTimesConfig = DEFAULT_PRAYER_TIMES_CONFIG,
  windowConfig: PrayerWindowConfig = DEFAULT_PRAYER_WINDOW_CONFIG,
): PrayerWindow | null {
  const windows = computePrayerWindows(location, now, config, windowConfig);
  const t = now.getTime();
  return (
    windows.find((w) => t >= w.start.getTime() && t <= w.end.getTime()) ?? null
  );
}
