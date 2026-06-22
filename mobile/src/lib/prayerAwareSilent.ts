/**
 * Prayer-aware silent — opt-in tightening of auto-silent around prayer windows
 * (F-01.10 / FR-1.10, consuming EPIC-05's prayer windows via FR-5.5).
 *
 * **Decision D-2 (EPIC-13): Phase 2 lean, opt-in.** Per the PRD, v1 stays
 * focused on reliable geofence-based silencing, so this ships **off by default**;
 * a user who wants tighter, prayer-timed behaviour near mosques turns it on. The
 * window source is the **computed prayer time + a jamaat offset**
 * ({@link ./prayerWindows}); crowdsourced jamaat times are a later refinement
 * (EPIC-08). When prayer times or location are unknown, the feature degrades
 * gracefully to plain geofence presence (this bridge simply returns "no active
 * window").
 *
 * This module is the **bridge the auto-silent logic consumes**: it owns the
 * persisted setting and the pure {@link evaluatePrayerAwareSilence} decision.
 * Acting on that decision in the background (scheduling the native ringer change
 * at window boundaries) is the remaining native step of F-01.10 and is tracked
 * separately — see `mobile/README.md` and `src/lib/geofencing/NOTES.md`. Keeping
 * the decision pure here means the native consumer (and tests) share one source
 * of truth.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import RingerControl from '../../modules/ringer-control';
import { getPrayerTimesConfig } from './prayerSettings';
import type { LatLng } from './geofencing/types';
import {
  DEFAULT_PRAYER_TIMES_CONFIG,
  type PrayerTimesConfig,
} from './prayerTimes';
import {
  currentPrayerWindow,
  DEFAULT_PRAYER_WINDOW_CONFIG,
  type PrayerWindow,
  type PrayerWindowConfig,
  upcomingPrayerWindows,
} from './prayerWindows';

const SETTINGS_KEY = 'sakina.prayer_aware_silent';

/** Whether prayer-aware tightening is on, and the window shape it uses. */
export interface PrayerAwareSilentSettings {
  readonly enabled: boolean;
  readonly window: PrayerWindowConfig;
}

/** Off by default (D-2: opt-in), with the conservative default window. */
export const DEFAULT_PRAYER_AWARE_SILENT: PrayerAwareSilentSettings = {
  enabled: false,
  window: DEFAULT_PRAYER_WINDOW_CONFIG,
};

function isValid(value: unknown): value is PrayerAwareSilentSettings {
  const s = value as Partial<PrayerAwareSilentSettings> | null;
  const w = s?.window as Partial<PrayerWindowConfig> | undefined;
  return (
    s !== null &&
    typeof s === 'object' &&
    typeof s.enabled === 'boolean' &&
    w !== undefined &&
    typeof w.jamaatOffsetMinutes === 'number' &&
    typeof w.preMinutes === 'number' &&
    typeof w.salahMinutes === 'number'
  );
}

/** Read persisted settings, falling back to the disabled default. */
export async function getPrayerAwareSilentSettings(): Promise<PrayerAwareSilentSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (isValid(parsed)) {
        return parsed;
      }
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_PRAYER_AWARE_SILENT;
}

async function savePrayerAwareSilentSettings(
  settings: PrayerAwareSilentSettings,
): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // best-effort
  }
}

/**
 * The auto-silent bridge: given the setting, the user's location and the current
 * time, return the prayer window that should be silenced **right now**, or
 * `null` if prayer-aware silencing should not currently apply.
 *
 * Pure and total — it never throws and degrades to `null` when the feature is
 * off or location is unknown, so a caller can treat `null` as "fall back to
 * plain geofence presence". This is what FR-5.5 means by "expose prayer windows
 * to the auto-silent logic": the logic asks this one question.
 */
export function evaluatePrayerAwareSilence(
  settings: PrayerAwareSilentSettings,
  location: LatLng | null,
  config: PrayerTimesConfig = DEFAULT_PRAYER_TIMES_CONFIG,
  now: Date = new Date(),
): PrayerWindow | null {
  if (!settings.enabled || location === null) {
    return null;
  }
  return currentPrayerWindow(location, now, config, settings.window);
}

/**
 * Push the prayer-aware setting and the upcoming window boundaries down to the
 * native auto-silent layer (F-01.10). Native can't compute prayer times (`adhan`
 * is JS-only), so JS precomputes a rolling list of window boundaries here and
 * hands native the epoch-ms `start`/`end` pairs to schedule ringer changes
 * against. Best-effort: the native module is absent in Expo Go / web, and a
 * failure here must never break the caller (arming, a settings toggle).
 *
 * When disabled (or location is unknown) we still push the flag with an empty
 * window list, so native stops gating and falls back to plain geofence presence.
 */
export async function pushPrayerWindowsToNative(
  settings: PrayerAwareSilentSettings,
  location: LatLng | null,
  config: PrayerTimesConfig = DEFAULT_PRAYER_TIMES_CONFIG,
): Promise<void> {
  try {
    if (settings.enabled && location !== null) {
      const windows = upcomingPrayerWindows(
        location,
        new Date(),
        config,
        settings.window,
      );
      RingerControl.setPrayerWindows(
        windows.map((w) => w.start.getTime()),
        windows.map((w) => w.end.getTime()),
      );
    } else {
      RingerControl.setPrayerWindows([], []);
    }
    RingerControl.setPrayerAware(settings.enabled);
  } catch {
    // Native module unavailable (Expo Go/web) or a transient failure — the JS
    // bridge is opportunistic; the persisted setting remains the source of truth.
  }
}

/**
 * Read the persisted prayer-aware setting and prayer-time config, then push both
 * (with freshly computed windows for `location`) to native. The convenience the
 * geofencing arming path uses, where only the location is on hand.
 */
export async function syncPrayerAwareSilentToNative(
  location: LatLng | null,
): Promise<void> {
  const [settings, config] = await Promise.all([
    getPrayerAwareSilentSettings(),
    getPrayerTimesConfig(),
  ]);
  await pushPrayerWindowsToNative(settings, location, config);
}

/**
 * React state bound to the persisted setting: seeds from the disabled default
 * (no flash), hydrates on mount, and writes through on update.
 */
export function usePrayerAwareSilentSettings(): readonly [
  PrayerAwareSilentSettings,
  (settings: PrayerAwareSilentSettings) => void,
] {
  const [settings, setSettings] = useState<PrayerAwareSilentSettings>(
    DEFAULT_PRAYER_AWARE_SILENT,
  );

  useEffect(() => {
    let active = true;
    void getPrayerAwareSilentSettings().then((loaded) => {
      if (active) {
        setSettings(loaded);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const update = useCallback((next: PrayerAwareSilentSettings) => {
    setSettings(next);
    void savePrayerAwareSilentSettings(next);
  }, []);

  return [settings, update] as const;
}
