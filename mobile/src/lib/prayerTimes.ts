/**
 * On-device prayer-time computation (FR-5.1, EPIC-05).
 *
 * The five daily prayer times are derived from the user's coordinates and the
 * date using the `adhan` library — pure astronomical math with **no network
 * call**, so prayer times work fully offline (the explicit acceptance criterion
 * for F-05.1, and the reason the PRD §6.1 picked an on-device library over a
 * backend endpoint).
 *
 * This module is deliberately the *computation layer only*. It accepts the
 * calculation method and Asr juristic method as a parameter and falls back to a
 * documented default; wiring those choices to a settings UI and persisting them
 * in DeviceSettings is F-05.2, and the home-screen countdown that consumes the
 * output is F-05.3. Keeping the math isolated and side-effect-free lets those
 * layers — and the Prayer-aware silent mode (F-05.5) — build on a single source
 * of truth without re-deriving times.
 */

import {
  CalculationMethod,
  Coordinates,
  Madhab,
  PrayerTimes as AdhanPrayerTimes,
  type CalculationParameters,
} from 'adhan';

import type { LatLng } from './geofencing/types';

/** The five obligatory daily prayers, in chronological order. */
export const PRAYER_NAMES = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

/** One of the five daily prayers. Sunrise is computed by `adhan` but isn't a prayer. */
export type PrayerName = (typeof PRAYER_NAMES)[number];

/**
 * Supported calculation methods, keyed to the `adhan` presets the PRD §6.1
 * lists (Muslim World League, Umm al-Qura, Karachi, …). F-05.2 exposes these as
 * a user choice; this union keeps that selection type-safe.
 */
export type CalculationMethodKey =
  | 'MuslimWorldLeague'
  | 'Egyptian'
  | 'Karachi'
  | 'UmmAlQura'
  | 'Dubai'
  | 'MoonsightingCommittee'
  | 'NorthAmerica'
  | 'Kuwait'
  | 'Qatar'
  | 'Singapore'
  | 'Tehran'
  | 'Turkey';

/**
 * Asr juristic method. `'standard'` (Shafi/Maliki/Hanbali) takes the shadow at
 * 1× object length; `'hanafi'` at 2×, giving a later Asr.
 */
export type AsrMethod = 'standard' | 'hanafi';

/** How prayer times are calculated. Both fields are user-selectable in F-05.2. */
export interface PrayerTimesConfig {
  /** Twilight-angle preset used for Fajr and Isha. */
  readonly method: CalculationMethodKey;
  /** Shadow ratio used for Asr. */
  readonly asr: AsrMethod;
}

/**
 * The default configuration, documented per the F-05.1 acceptance criteria.
 *
 * Muslim World League is the PRD's first-listed method and the most widely
 * applicable global default; Asr defaults to `'standard'`, matching `adhan`'s
 * own default and the majority juristic position. F-05.2 lets the user override
 * both and persists the choice in DeviceSettings.
 */
export const DEFAULT_PRAYER_TIMES_CONFIG: PrayerTimesConfig = {
  method: 'MuslimWorldLeague',
  asr: 'standard',
};

/** A single prayer and the absolute instant it begins. */
export interface PrayerTime {
  readonly name: PrayerName;
  /** Local-time `Date` for the prayer on the requested day. */
  readonly time: Date;
}

/**
 * The five daily prayer times for one location and day: an ordered list for
 * rendering plus a name→time map for direct lookup (e.g. the next-prayer
 * countdown in F-05.3). Both views reference the same `Date` instances.
 */
export interface DailyPrayerTimes {
  readonly date: Date;
  readonly location: LatLng;
  readonly config: PrayerTimesConfig;
  readonly times: readonly PrayerTime[];
  readonly byName: Readonly<Record<PrayerName, Date>>;
}

/**
 * Build the `adhan` calculation parameters for a config. Isolated so the
 * mapping from our small, serialisable config (what F-05.2 persists) to
 * `adhan`'s richer object lives in one place.
 */
function toCalculationParameters(
  config: PrayerTimesConfig,
): CalculationParameters {
  const params = CalculationMethod[config.method]();
  params.madhab = config.asr === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  return params;
}

/**
 * Compute the five daily prayer times for a location and day (FR-5.1).
 *
 * Pure and offline: given the same inputs it always returns the same times, and
 * it never touches the network. `date` defaults to now; only the calendar day
 * (in the device's local zone) matters — the time-of-day component is ignored by
 * `adhan`. `config` defaults to {@link DEFAULT_PRAYER_TIMES_CONFIG}.
 */
export function computeDailyPrayerTimes(
  location: LatLng,
  date: Date = new Date(),
  config: PrayerTimesConfig = DEFAULT_PRAYER_TIMES_CONFIG,
): DailyPrayerTimes {
  const coordinates = new Coordinates(location.latitude, location.longitude);
  const params = toCalculationParameters(config);
  const adhan = new AdhanPrayerTimes(coordinates, date, params);

  const byName: Record<PrayerName, Date> = {
    fajr: adhan.fajr,
    dhuhr: adhan.dhuhr,
    asr: adhan.asr,
    maghrib: adhan.maghrib,
    isha: adhan.isha,
  };

  const times = PRAYER_NAMES.map((name) => ({ name, time: byName[name] }));

  return { date, location, config, times, byName };
}
